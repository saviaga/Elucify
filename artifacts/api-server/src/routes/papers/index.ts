import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, papersTable, paperSectionsTable } from "@workspace/db";
import { openai as replitOpenai } from "@workspace/integrations-openai-ai-server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import {
  CreatePaperBody,
  GetPaperParams,
  GetPaperSectionParams,
  GeneratePaperSectionParams,
} from "@workspace/api-zod";
import { SECTION_PROMPTS, ALL_SECTION_KEYS } from "./prompts";

const router: IRouter = Router();

// Gemini request counter — resets on server restart
let geminiRequestCount = 0;

// ──────────────────────────────────────────────────────────────
// Server-side rate limiter: prevent runaway auto-generation loops
// Max 3 attempts per (paperId, sectionKey) within a 60-second window.
// Resets automatically once the window expires.
// ──────────────────────────────────────────────────────────────
const sectionAttempts = new Map<string, { count: number; windowStart: number }>();
const MAX_ATTEMPTS = 3;
const ATTEMPT_WINDOW_MS = 60_000;

function checkAndRecordAttempt(paperId: number, sectionKey: string): boolean {
  const key = `${paperId}:${sectionKey}`;
  const now = Date.now();
  const entry = sectionAttempts.get(key);
  if (!entry || now - entry.windowStart > ATTEMPT_WINDOW_MS) {
    sectionAttempts.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return false;
  }
  entry.count++;
  return true;
}

function resetAttempts(paperId: number, sectionKey: string) {
  sectionAttempts.delete(`${paperId}:${sectionKey}`);
}

// Diagnostic: raw fetch to Gemini to see exact response body/headers
router.post("/test-gemini", async (req: Request, res: Response): Promise<void> => {
  const { apiKey } = req.body as { apiKey?: string };
  if (!apiKey) { res.status(400).json({ error: "apiKey required" }); return; }
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [{ role: "user", content: "Say hello." }],
        max_tokens: 10,
        stream: false,
      }),
    });
    const body = await r.text();
    const headers: Record<string, string> = {};
    r.headers.forEach((v, k) => { headers[k] = v; });
    res.json({ status: r.status, headers, body });
  } catch (e: any) {
    res.json({ error: e.message });
  }
});

router.post("/papers", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in to create papers." });
    return;
  }

  const parsed = CreatePaperBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { text, arxivUrl } = parsed.data;

  let paperText = text || "";

  if (arxivUrl && !paperText) {
    try {
      const arxivId = arxivUrl.replace(/^https?:\/\/arxiv\.org\/abs\//, "").replace(/^https?:\/\/arxiv\.org\/pdf\//, "").replace(/\.pdf$/, "").trim();
      const baseId = arxivId.replace(/v\d+$/, "");

      // Fetch metadata (title, authors, abstract) from arXiv API
      const absUrl = `https://export.arxiv.org/api/query?id_list=${arxivId}`;
      const response = await fetch(absUrl);
      const xmlText = await response.text();

      const titleMatch = xmlText.match(/<title>([\s\S]*?)<\/title>/g);
      const summaryMatch = xmlText.match(/<summary>([\s\S]*?)<\/summary>/);
      const authorMatches = xmlText.matchAll(/<name>([\s\S]*?)<\/name>/g);

      const title = titleMatch && titleMatch.length > 1 
        ? titleMatch[1].replace(/<\/?title>/g, "").trim() 
        : undefined;
      const abstract = summaryMatch ? summaryMatch[1].trim() : "";
      const authors: string[] = [];
      for (const match of authorMatches) {
        authors.push(match[1].trim());
      }

      // Try to fetch full paper text from arXiv HTML (much richer than abstract alone)
      let fullPaperContent = "";
      try {
        const htmlSources = [
          `https://arxiv.org/html/${baseId}`,
          `https://ar5iv.labs.arxiv.org/html/${baseId}`,
        ];
        for (const htmlUrl of htmlSources) {
          const htmlResp = await fetch(htmlUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; Elucify/1.0)" },
            signal: AbortSignal.timeout(15000),
          });
          if (!htmlResp.ok) continue;
          const html = await htmlResp.text();
          if (html.includes("No HTML for") || html.includes("We're sorry") || !html.includes("<p")) continue;

          // Strip non-content elements
          let clean = html
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
            .replace(/<header[\s\S]*?<\/header>/gi, " ")
            .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
            .replace(/<!--[\s\S]*?-->/g, " ");

          // Format headings
          clean = clean.replace(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi, (_: string, t: string) =>
            `\n\n## ${t.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()}\n\n`
          );
          // Format figure captions
          clean = clean.replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, (_: string, t: string) =>
            `\n[Figure caption: ${t.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()}]\n`
          );
          // Paragraphs
          clean = clean.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_: string, t: string) =>
            `${t.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()}\n`
          );
          // Strip remaining tags
          clean = clean.replace(/<[^>]+>/g, " ").replace(/\s{3,}/g, "\n\n").trim();

          if (clean.length > 2000) {
            // Cap at 80k chars to stay within model context limits
            fullPaperContent = clean.length > 80000 ? clean.slice(0, 80000) + "\n...[truncated]" : clean;
            break;
          }
        }
      } catch {
        // Fall back to abstract-only — non-fatal
      }

      if (fullPaperContent) {
        paperText = `Title: ${title || "Unknown"}\nAuthors: ${authors.join(", ")}\nAbstract: ${abstract}\n\n=== FULL PAPER CONTENT ===\n${fullPaperContent}\n\narXiv ID: ${arxivId}`;
      } else {
        paperText = `Title: ${title || "Unknown"}\nAuthors: ${authors.join(", ")}\nAbstract: ${abstract}\n\narXiv ID: ${arxivId}`;
      }

      const userId = (req.user as any)?.id ?? null;
      const [paper] = await db
        .insert(papersTable)
        .values({
          userId,
          title: title || null,
          authors: authors.length > 0 ? authors.join(", ") : null,
          inputText: paperText,
          arxivId: arxivId,
        })
        .returning();

      const sectionSummaries = ALL_SECTION_KEYS.map((key) => ({
        sectionKey: key,
        generated: false,
      }));

      res.status(201).json({ ...paper, sections: sectionSummaries });
      return;
    } catch {
      res.status(400).json({ error: "Failed to fetch arXiv paper. Please paste the text directly." });
      return;
    }
  }

  if (!paperText) {
    res.status(400).json({ error: "Please provide either paper text or an arXiv URL." });
    return;
  }

  // Extract title and authors from PDF text using AI
  let extractedTitle: string | null = null;
  let extractedAuthors: string | null = null;
  try {
    const excerpt = paperText.slice(0, 3000);
    const extraction = await replitOpenai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 256,
      messages: [
        {
          role: "system",
          content: `Extract the paper title and authors from the beginning of this academic paper text. Return ONLY valid JSON in this format: {"title": "...", "authors": "Author 1, Author 2"}. If you cannot find the title or authors, use null for those fields.`,
        },
        { role: "user", content: excerpt },
      ],
    });
    const raw = extraction.choices[0]?.message?.content?.trim() || "";
    const jsonStr = raw.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(jsonStr);
    extractedTitle = parsed.title || null;
    extractedAuthors = parsed.authors || null;
  } catch {
    // Fall back to null title/authors — better than crashing
  }

  const userId = (req.user as any)?.id ?? null;
  const [paper] = await db
    .insert(papersTable)
    .values({ userId, title: extractedTitle, authors: extractedAuthors, inputText: paperText })
    .returning();

  const sectionSummaries = ALL_SECTION_KEYS.map((key) => ({
    sectionKey: key,
    generated: false,
  }));

  res.status(201).json({ ...paper, sections: sectionSummaries });
});

router.get("/papers", async (_req: Request, res: Response): Promise<void> => {
  const papers = await db.select().from(papersTable).orderBy(papersTable.createdAt);

  const results = await Promise.all(
    papers.map(async (paper) => {
      const sections = await db
        .select({ sectionKey: paperSectionsTable.sectionKey })
        .from(paperSectionsTable)
        .where(eq(paperSectionsTable.paperId, paper.id));

      const generatedKeys = new Set(sections.map((s) => s.sectionKey));
      const sectionSummaries = ALL_SECTION_KEYS.map((key) => ({
        sectionKey: key,
        generated: generatedKeys.has(key),
      }));

      return { ...paper, sections: sectionSummaries };
    })
  );

  res.json(results);
});

router.get("/papers/mine", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const userId = (req.user as any).id;
  const papers = await db
    .select()
    .from(papersTable)
    .where(eq(papersTable.userId, userId))
    .orderBy(desc(papersTable.createdAt));

  const results = await Promise.all(
    papers.map(async (paper) => {
      const sections = await db
        .select({ sectionKey: paperSectionsTable.sectionKey })
        .from(paperSectionsTable)
        .where(eq(paperSectionsTable.paperId, paper.id));

      const generatedCount = sections.length;
      const totalSections = ALL_SECTION_KEYS.length;

      return { ...paper, generatedCount, totalSections };
    })
  );

  res.json(results);
});

router.get("/papers/:id", async (req: Request, res: Response): Promise<void> => {
  const params = GetPaperParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [paper] = await db
    .select()
    .from(papersTable)
    .where(eq(papersTable.id, params.data.id));

  if (!paper) {
    res.status(404).json({ error: "Paper not found" });
    return;
  }

  const sections = await db
    .select({ sectionKey: paperSectionsTable.sectionKey })
    .from(paperSectionsTable)
    .where(eq(paperSectionsTable.paperId, paper.id));

  const generatedKeys = new Set(sections.map((s) => s.sectionKey));
  const sectionSummaries = ALL_SECTION_KEYS.map((key) => ({
    sectionKey: key,
    generated: generatedKeys.has(key),
  }));

  res.json({ ...paper, sections: sectionSummaries });
});

router.get("/papers/:id/sections/:sectionKey", async (req: Request, res: Response): Promise<void> => {
  const params = GetPaperSectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [section] = await db
    .select()
    .from(paperSectionsTable)
    .where(
      and(
        eq(paperSectionsTable.paperId, params.data.id),
        eq(paperSectionsTable.sectionKey, params.data.sectionKey)
      )
    );

  if (!section) {
    res.status(404).json({ error: "Section not generated yet" });
    return;
  }

  res.json(section);
});

router.post("/papers/:id/sections/:sectionKey/generate", async (req: Request, res: Response): Promise<void> => {
  const params = GeneratePaperSectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { id, sectionKey } = params.data;

  const prompt = SECTION_PROMPTS[sectionKey];
  if (!prompt) {
    res.status(400).json({ error: `Unknown section: ${sectionKey}` });
    return;
  }

  const [paper] = await db
    .select()
    .from(papersTable)
    .where(eq(papersTable.id, id));

  if (!paper) {
    res.status(404).json({ error: "Paper not found" });
    return;
  }

  // Rate limit: refuse if this section has failed too many times recently
  if (!checkAndRecordAttempt(id, sectionKey)) {
    console.log(`[RateLimit] ✗ Blocked paper=${id} section="${sectionKey}" — 3 attempts in 60s`);
    res.status(429).json({
      error: "TOO_MANY_ATTEMPTS: Generation failed too many times in a row. Please wait 60 seconds before trying again."
    });
    return;
  }

  const userApiKey = req.headers["x-api-key"] as string | undefined;
  const userProvider = req.headers["x-provider"] as string | undefined;
  const userModel = req.headers["x-model"] as string | undefined;

  if (!userApiKey || !userProvider) {
    res.status(400).json({ error: "NO_API_KEY: Add your own API key to generate analysis. Click the key icon to get started." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    if (userApiKey && userProvider === "anthropic") {
      const anthropic = new Anthropic({ apiKey: userApiKey });
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-5",
        max_tokens: 8192,
        system: prompt,
        messages: [{ role: "user", content: paper.inputText }],
      });
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          const text = event.delta.text;
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }
    } else if (userApiKey && userProvider === "openai") {
      const userOpenai = new OpenAI({ apiKey: userApiKey });
      const stream = await userOpenai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 8192,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: paper.inputText },
        ],
        stream: true,
      });
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
    } else if (userApiKey && userProvider === "gemini") {
      geminiRequestCount++;
      const t0 = Date.now();
      const geminiInput = (paper.inputText ?? "").slice(0, 40000);
      console.log(`[Gemini] ▶ Request #${geminiRequestCount} — section: "${sectionKey}" | inputLen: ${geminiInput.length}`);

      // Use the native Gemini REST API directly (no OpenAI SDK shim)
      const geminiModel = userModel || "gemini-2.5-flash";
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?key=${userApiKey}&alt=sse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: prompt }] },
            contents: [{ role: "user", parts: [{ text: geminiInput }] }],
            generationConfig: { maxOutputTokens: 4096 },
          }),
        }
      );

      if (!geminiRes.ok) {
        const errBody = await geminiRes.text();
        console.log(`[Gemini] ✗ HTTP ${geminiRes.status} — ${errBody}`);
        let errMsg = `${geminiRes.status} error from Gemini`;
        try {
          const parsed = JSON.parse(errBody);
          const msg = parsed?.[0]?.error?.message ?? parsed?.error?.message ?? errBody;
          if (geminiRes.status === 429) {
            const details = parsed?.error?.details ?? parsed?.[0]?.error?.details ?? [];
            const quotaFailure = details.find((d: any) => d['@type']?.includes('QuotaFailure'));
            const violations: any[] = quotaFailure?.violations ?? [];
            const retryInfo = details.find((d: any) => d['@type']?.includes('RetryInfo'));
            const retryDelayStr: string = retryInfo?.retryDelay ?? "60s";
            const retrySeconds = Math.ceil(parseFloat(retryDelayStr)) || 60;
            const hasDaily = violations.some((v: any) => v.quotaId?.includes('PerDay'));
            const hasPerMinute = violations.some((v: any) => v.quotaId?.includes('PerMinute'));
            const dailyExhausted = (hasDaily && !hasPerMinute) || retrySeconds > 300;
            errMsg = dailyExhausted
              ? `RATE_LIMIT_DAILY: Your daily Gemini quota is exhausted and will reset in ~24 hours. Use a different provider in the meantime, or enable billing at aistudio.google.com.`
              : `RATE_LIMIT:${retrySeconds}: Per-minute quota temporarily full. Wait ${retrySeconds}s and try again.`;
          } else if (geminiRes.status === 401) {
            errMsg = `INVALID_KEY: ${msg}`;
          } else if (geminiRes.status === 400) {
            errMsg = `INVALID_REQUEST: ${msg}`;
          } else {
            errMsg = msg;
          }
        } catch { errMsg = errBody || errMsg; }
        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
        res.end();
        return;
      }

      // Parse SSE stream from Gemini
      const reader = geminiRes.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json || json === "[DONE]") continue;
          try {
            const obj = JSON.parse(json);
            const text = obj?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            if (text) {
              fullResponse += text;
              res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
            }
          } catch { /* skip malformed chunks */ }
        }
      }
      console.log(`[Gemini] ✓ Request #${geminiRequestCount} done in ${((Date.now() - t0) / 1000).toFixed(1)}s — section: "${sectionKey}"`);

    } else if (userApiKey && userProvider === "deepseek") {
      const deepseekClient = new OpenAI({
        apiKey: userApiKey,
        baseURL: "https://api.deepseek.com",
      });
      const stream = await deepseekClient.chat.completions.create({
        model: "deepseek-chat",
        max_tokens: 8192,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: paper.inputText },
        ],
        stream: true,
      });
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
    }

    await db
      .delete(paperSectionsTable)
      .where(
        and(
          eq(paperSectionsTable.paperId, id),
          eq(paperSectionsTable.sectionKey, sectionKey)
        )
      );

    await db.insert(paperSectionsTable).values({
      paperId: id,
      sectionKey,
      content: fullResponse,
    });

    resetAttempts(id, sectionKey);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error: any) {
    const status = error?.status ?? error?.statusCode ?? 0;
    const rawMessage = error instanceof Error ? error.message : "Generation failed";
    let message = rawMessage;

    // Log full error details to help diagnose API issues
    console.log(`[Gemini] ✗ FAILED — status=${status} message="${rawMessage}" headers=${JSON.stringify((error as any)?.headers ?? {})} body=${JSON.stringify((error as any)?.error ?? (error as any)?.body ?? {})} section="${req.params.sectionKey}"`);

    if (status === 429 || rawMessage.includes("429")) {
      message = "RATE_LIMIT: Your API quota has been reached. This happens when too many requests are made in a short period. Please wait 60 seconds and try again — or check your usage at the provider's dashboard.";
    } else if (status === 401 || rawMessage.includes("401") || rawMessage.toLowerCase().includes("invalid api key") || rawMessage.toLowerCase().includes("unauthorized")) {
      message = "INVALID_KEY: Your API key appears to be invalid or expired. Please check your key and update it in Settings.";
    } else if (status === 400 || rawMessage.includes("400")) {
      message = "INVALID_REQUEST: The request was rejected (400). This may be because the Gemini API is not enabled for your Google Cloud project, the model name is unsupported, or the paper content is malformed. Check your Google Cloud Console.";
    }

    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

router.delete("/papers/:id", async (req: Request, res: Response): Promise<void> => {
  const params = GetPaperParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { id } = params.data;
  const userId = (req.user as any)?.id ?? null;

  const [paper] = await db.select().from(papersTable).where(eq(papersTable.id, id));
  if (!paper) {
    res.status(404).json({ error: "Paper not found" });
    return;
  }

  // Only allow deletion by the paper's owner (or unauthenticated papers)
  if (paper.userId !== null && paper.userId !== userId) {
    res.status(403).json({ error: "Not authorised" });
    return;
  }

  await db.delete(paperSectionsTable).where(eq(paperSectionsTable.paperId, id));
  await db.delete(papersTable).where(eq(papersTable.id, id));

  res.status(200).json({ deleted: true });
});

router.get("/papers/:id/figures", async (req: Request, res: Response): Promise<void> => {
  const params = GetPaperParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { id } = params.data;
  const [paper] = await db.select().from(papersTable).where(eq(papersTable.id, id));
  if (!paper) {
    res.status(404).json({ error: "Paper not found" });
    return;
  }

  // Also try to extract arxivId from inputText if not stored
  let arxivId = paper.arxivId;
  if (!arxivId) {
    const match = paper.inputText.match(/arXiv ID:\s*([^\s\n]+)/);
    if (match) arxivId = match[1].trim();
  }

  if (!arxivId) {
    res.json({ figures: [], available: false });
    return;
  }

  try {
    // Strip version suffix (e.g. 2212.08073v2 -> 2212.08073)
    const baseId = arxivId.replace(/v\d+$/, "");

    // Helper: fetch HTML from a URL and return text if it's a valid paper page
    async function fetchPaperHtml(url: string): Promise<string | null> {
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Elucify/1.0)" },
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) return null;
      const text = await resp.text();
      // Invalid if it's an error/redirect page — check for figure content
      if (!text.includes("<figure") || text.includes("No HTML for") || text.includes("We're sorry")) return null;
      return text;
    }

    // Try arxiv.org/html first (official, preferred), fall back to ar5iv
    let html: string | null = null;
    let sourceUrl: string;
    let imageBaseUrl: string;

    const arxivHtmlUrl = `https://arxiv.org/html/${baseId}`;
    html = await fetchPaperHtml(arxivHtmlUrl);

    if (html) {
      sourceUrl = arxivHtmlUrl;
      // arXiv HTML uses bare relative filenames (e.g. "x1.png") relative to the paper directory
      imageBaseUrl = `https://arxiv.org/html/${baseId}/`;
    } else {
      // Fall back to ar5iv which auto-converts LaTeX
      const ar5ivUrl = `https://ar5iv.labs.arxiv.org/html/${baseId}`;
      html = await fetchPaperHtml(ar5ivUrl);
      if (!html) {
        res.json({ figures: [], available: false });
        return;
      }
      sourceUrl = ar5ivUrl;
      // ar5iv uses root-relative paths (e.g. "/html/2212.08073/assets/x1.png")
      imageBaseUrl = `https://ar5iv.labs.arxiv.org`;
    }

    const figures: { src: string; caption: string; label: string }[] = [];

    // Extract <figure> blocks
    const figureRegex = /<figure\b[^>]*>([\s\S]*?)<\/figure>/gi;
    let figResult: RegExpExecArray | null;
    let figIndex = 0;

    while ((figResult = figureRegex.exec(html)) !== null) {
      const figHtml = figResult[1];

      // Get first img src in this figure
      const imgMatch = figHtml.match(/<img\b[^>]+src="([^"]+)"/i);
      if (!imgMatch) continue;

      let src = imgMatch[1];
      // Resolve to absolute URL based on source
      if (src.startsWith("http")) {
        // already absolute
      } else if (src.startsWith("/")) {
        // root-relative (ar5iv style)
        src = imageBaseUrl + src;
      } else {
        // bare filename (arxiv.org/html style) — relative to paper directory
        src = imageBaseUrl + src;
      }

      // Skip icons, logos, and SVGs
      if (src.includes("icon") || src.includes("logo") || src.endsWith(".svg")) continue;

      // Extract and clean caption
      const captionMatch = figHtml.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
      let caption = captionMatch ? captionMatch[1] : "";
      caption = caption.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

      // Extract figure label
      const labelMatch = caption.match(/^(Figure\s*\d+[.:a-z]?)/i);
      const label = labelMatch ? labelMatch[1] : `Figure ${figIndex + 1}`;

      figures.push({ src, caption, label });
      figIndex++;

      if (figures.length >= 20) break; // Cap at 20 figures
    }

    res.json({ figures, available: true, arxivId: baseId, sourceUrl });
  } catch {
    res.json({ figures: [], available: false });
  }
});

router.get("/papers/:id/chat-starters", async (req: Request, res: Response): Promise<void> => {
  const params = GetPaperParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { id } = params.data;
  const [paper] = await db.select().from(papersTable).where(eq(papersTable.id, id));
  if (!paper) {
    res.status(404).json({ error: "Paper not found" });
    return;
  }

  try {
    const excerpt = paper.inputText.slice(0, 2500);
    const result = await replitOpenai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 512,
      messages: [
        {
          role: "system",
          content: `You are a research assistant. Based on the start of this academic paper, generate exactly 6 insightful discussion questions a reader might want to ask. Cover: core method/contribution, key results, limitations, comparisons to prior work, practical applications, and future directions. Return ONLY a JSON array of 6 question strings, no other text. Example format: ["Question 1?", "Question 2?", ...]`,
        },
        { role: "user", content: excerpt },
      ],
    });

    const raw = result.choices[0]?.message?.content?.trim() || "[]";
    const clean = raw.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    const questions = JSON.parse(clean);
    res.json({ questions: Array.isArray(questions) ? questions.slice(0, 6) : [] });
  } catch {
    res.json({ questions: [] });
  }
});

router.post("/papers/:id/chat", async (req: Request, res: Response): Promise<void> => {
  const params = GetPaperParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { id } = params.data;
  const { messages } = req.body as { messages: { role: string; content: string }[] };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  const [paper] = await db.select().from(papersTable).where(eq(papersTable.id, id));
  if (!paper) {
    res.status(404).json({ error: "Paper not found" });
    return;
  }

  const systemPrompt = `You are an expert research assistant helping the user understand a specific paper. Answer questions accurately based on the paper content. Elaborate with broader knowledge when helpful, but always ground your answers in what the paper says.

PAPER CONTENT:
${paper.inputText}`;

  const userApiKey = req.headers["x-api-key"] as string | undefined;
  const userProvider = req.headers["x-provider"] as string | undefined;
  const userModel = req.headers["x-model"] as string | undefined;

  if (!userApiKey || !userProvider) {
    res.status(400).json({ error: "NO_API_KEY: Add your own API key to use chat. Click the key icon to get started." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    if (userApiKey && userProvider === "anthropic") {
      const anthropic = new Anthropic({ apiKey: userApiKey });
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages as any,
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
        }
      }
    } else if (userApiKey && (userProvider === "openai" || userProvider === "gemini" || userProvider === "deepseek")) {
      const configs: Record<string, { baseURL?: string; model: string }> = {
        openai:   { model: "gpt-4o" },
        gemini:   { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", model: userModel || "gemini-2.0-flash" },
        deepseek: { baseURL: "https://api.deepseek.com", model: "deepseek-chat" },
      };
      const cfg = configs[userProvider];
      const client = new OpenAI({
        apiKey: userApiKey,
        ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}),
        maxRetries: userProvider === "gemini" ? 0 : 2,
      });
      const stream = await client.chat.completions.create({
        model: cfg.model,
        max_tokens: 4096,
        messages: [{ role: "system", content: systemPrompt }, ...messages as any],
        stream: true,
      });
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat failed";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

export default router;
