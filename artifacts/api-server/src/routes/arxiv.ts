import { Router } from "express";

const router = Router();

const CS_CATEGORIES = [
  "cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.NE",
  "cs.RO", "cs.IR", "cs.HC", "cs.CR", "cs.DS",
];

router.get("/arxiv/suggestions", async (req, res) => {
  try {
    const cat = CS_CATEGORIES[Math.floor(Math.random() * CS_CATEGORIES.length)];
    const start = Math.floor(Math.random() * 30); // randomise starting offset
    const url =
      `https://export.arxiv.org/api/query?search_query=cat:${cat}` +
      `&sortBy=submittedDate&sortOrder=descending&max_results=30&start=${start}`;

    const resp = await fetch(url, {
      headers: { "User-Agent": "Elucify/1.0 (research reader)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) throw new Error(`arXiv API ${resp.status}`);
    const xml = await resp.text();

    // Parse entries with regex — arXiv Atom is predictable
    const entries: { title: string; url: string; authors: string; category: string }[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match: RegExpExecArray | null;

    while ((match = entryRegex.exec(xml)) !== null) {
      const body = match[1];

      const idMatch = body.match(/<id>([^<]+)<\/id>/);
      const titleMatch = body.match(/<title>([^<]+)<\/title>/);
      const authorMatches = [...body.matchAll(/<name>([^<]+)<\/name>/g)];
      const categoryMatch = body.match(/<arxiv:primary_category[^>]+term="([^"]+)"/);

      if (!idMatch || !titleMatch) continue;

      const rawId = idMatch[1].trim();
      // Normalise to https://arxiv.org/abs/XXXXXX (strip version suffix)
      const idPart = rawId.replace(/v\d+$/, "").split("/abs/")[1] || rawId.split("/").pop()?.replace(/v\d+$/, "");
      if (!idPart) continue;

      const authors = authorMatches.slice(0, 2).map(m => m[1].trim()).join(", ")
        + (authorMatches.length > 2 ? " et al." : "");

      entries.push({
        title: titleMatch[1].trim().replace(/\s+/g, " "),
        url: `https://arxiv.org/abs/${idPart}`,
        authors,
        category: categoryMatch?.[1] ?? cat,
      });
    }

    // Pick 5 at random
    const shuffled = entries.sort(() => Math.random() - 0.5).slice(0, 5);
    res.json({ papers: shuffled });
  } catch (err) {
    console.error("arXiv suggestions error:", err);
    res.status(502).json({ papers: [] });
  }
});

export default router;
