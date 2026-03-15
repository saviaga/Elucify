import { useState, useEffect } from "react";
import { ImageOff, ExternalLink, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface Figure {
  src: string;
  caption: string;
  label: string;
}

interface FiguresResponse {
  figures: Figure[];
  available: boolean;
  arxivId?: string;
  sourceUrl?: string;
}

interface PaperFiguresProps {
  paperId: number;
}

export function PaperFigures({ paperId }: PaperFiguresProps) {
  const [data, setData] = useState<FiguresResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLoading(true);
    setData(null);
    setImgErrors(new Set());

    fetch(`/api/papers/${paperId}/figures`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData({ figures: [], available: false }))
      .finally(() => setLoading(false));
  }, [paperId]);

  const validFigures = (data?.figures ?? []).filter((_, i) => !imgErrors.has(i));

  function handleImgError(index: number) {
    setImgErrors((prev) => new Set(prev).add(index));
  }

  function openLightbox(index: number) {
    setLightbox(index);
  }

  function closeLightbox() {
    setLightbox(null);
  }

  function prev() {
    if (lightbox === null) return;
    setLightbox((lightbox - 1 + validFigures.length) % validFigures.length);
  }

  function next() {
    if (lightbox === null) return;
    setLightbox((lightbox + 1) % validFigures.length);
  }

  useEffect(() => {
    if (lightbox === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") closeLightbox();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, validFigures.length]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
        <p className="text-sm">Fetching figures from arXiv…</p>
      </div>
    );
  }

  if (!data?.available) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
        <ImageOff className="w-10 h-10 opacity-40" />
        <div className="text-center space-y-1">
          <p className="text-base font-medium">No figures available</p>
          <p className="text-sm opacity-70">
            Figures can only be retrieved for papers added via an arXiv URL,<br />
            and only if arXiv has an HTML version of the paper.
          </p>
        </div>
      </div>
    );
  }

  if (validFigures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
        <ImageOff className="w-10 h-10 opacity-40" />
        <p className="text-sm">No figures found in the arXiv HTML version of this paper.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {data.sourceUrl && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Source:</span>
          <a
            href={data.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            {new URL(data.sourceUrl).hostname}
            <ExternalLink className="w-3 h-3" />
          </a>
          <span className="text-muted-foreground/50">· {validFigures.length} figure{validFigures.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {data.figures.map((fig, i) => {
          if (imgErrors.has(i)) return null;
          const validIdx = validFigures.indexOf(fig);
          return (
            <div
              key={i}
              className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
              onClick={() => openLightbox(validIdx)}
            >
              <div className="relative bg-muted/30 flex items-center justify-center min-h-[180px] overflow-hidden">
                <img
                  src={fig.src}
                  alt={fig.caption || fig.label}
                  className="w-full h-auto max-h-[260px] object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                  onError={() => handleImgError(i)}
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
              {fig.caption && (
                <div className="p-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {fig.caption}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox !== null && validFigures[lightbox] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            onClick={closeLightbox}
          >
            <X className="w-6 h-6" />
          </button>

          {validFigures.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                onClick={(e) => { e.stopPropagation(); prev(); }}
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                onClick={(e) => { e.stopPropagation(); next(); }}
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          <div
            className="max-w-5xl max-h-[90vh] flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={validFigures[lightbox].src}
              alt={validFigures[lightbox].caption}
              className="max-h-[75vh] max-w-full object-contain rounded-lg"
            />
            {validFigures[lightbox].caption && (
              <p className="text-sm text-white/80 text-center max-w-2xl leading-relaxed">
                {validFigures[lightbox].caption}
              </p>
            )}
            <p className="text-xs text-white/40">
              {lightbox + 1} / {validFigures.length} · Click outside or press Esc to close
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
