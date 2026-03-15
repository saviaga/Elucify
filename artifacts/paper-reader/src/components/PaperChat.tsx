import { useState, useRef, useEffect, useCallback } from "react";
import { Send, StopCircle, Bot, User, Sparkles, KeyRound, Loader2 } from "lucide-react";
import { useApiKey, PROVIDER_META } from "@/hooks/use-api-key";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PaperChatProps {
  paperId: number;
}

export function PaperChat({ paperId }: PaperChatProps) {
  const { headers: apiKeyHeaders, config } = useApiKey();
  const [messages, setMessages] = useState<Message[]>([]);
  const [starters, setStarters] = useState<string[]>([]);
  const [startersLoading, setStartersLoading] = useState(true);
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    setStartersLoading(true);
    fetch(`/api/papers/${paperId}/chat-starters`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setStarters(data.questions || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setStartersLoading(false); });
    return () => { cancelled = true; };
  }, [paperId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: Message = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setStreamingContent("");
    setError(null);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/papers/${paperId}/chat`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...apiKeyHeaders,
        },
        body: JSON.stringify({ messages: updatedMessages }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Chat request failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) throw new Error(data.error);
            if (data.done) break;
            if (data.content) {
              accumulated += data.content;
              setStreamingContent(accumulated);
            }
          } catch (e) {
            if ((e as Error).message !== "Unexpected end of JSON input") throw e;
          }
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: accumulated }]);
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(e.message || "Something went wrong");
      }
    } finally {
      setStreamingContent("");
      setIsStreaming(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, isStreaming, paperId, apiKeyHeaders]);

  const stop = () => {
    abortRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const providerLabel = config
    ? `${PROVIDER_META[config.provider].label} · ${PROVIDER_META[config.provider].model}`
    : "Replit AI (shared)";

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 space-y-6">

        {/* Empty state with suggestions */}
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-serif font-semibold text-foreground text-lg">Chat with this paper</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Ask anything about the paper — methodology, results, implications, or how it compares to other work.
              </p>
              {!config && (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800">
                  <KeyRound className="w-3.5 h-3.5" />
                  Using shared credits — add your own API key for unlimited chat
                </div>
              )}
            </div>

            <div className="w-full max-w-lg space-y-2">
              <p className="text-xs font-medium text-muted-foreground text-center uppercase tracking-wider mb-3">
                Suggested questions
              </p>
              {startersLoading ? (
                <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Generating questions...</span>
                </div>
              ) : starters.length > 0 ? (
                starters.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => send(q)}
                    className="w-full text-left text-sm px-4 py-3 rounded-xl border border-border bg-background hover:bg-secondary hover:border-primary/30 transition-all duration-150 text-foreground leading-snug"
                  >
                    {q}
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Type a question below to get started.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}>
              {msg.role === "user"
                ? <User className="w-3.5 h-3.5" />
                : <Bot className="w-3.5 h-3.5" />
              }
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-muted/60 text-foreground rounded-tl-sm border border-border/40"
            }`}>
              {msg.role === "assistant"
                ? <MarkdownRenderer content={msg.content} />
                : <p className="whitespace-pre-wrap">{msg.content}</p>
              }
            </div>
          </div>
        ))}

        {/* Streaming bubble */}
        {isStreaming && (
          <div className="flex gap-3 flex-row">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm bg-muted/60 border border-border/40">
              {streamingContent
                ? <MarkdownRenderer content={streamingContent} />
                : (
                  <span className="flex gap-1 items-center text-muted-foreground">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>●</span>
                  </span>
                )
              }
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border/60 bg-card/80 backdrop-blur px-4 md:px-6 py-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Sparkles className="w-3 h-3 text-primary" />
          <span>{providerLabel}</span>
        </div>
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Ask anything about this paper..."
            rows={1}
            className="flex-1 resize-none bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 max-h-32 overflow-y-auto disabled:opacity-50"
            style={{ height: "auto", minHeight: "44px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
            }}
          />
          {isStreaming ? (
            <button
              onClick={stop}
              className="p-3 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors shrink-0"
              title="Stop"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => send(input)}
              disabled={!input.trim()}
              className="p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-primary/20 shrink-0"
              title="Send (Enter)"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
