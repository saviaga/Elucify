import { useState, useEffect, useCallback } from "react";
import {
  X, FolderOpen, Plus, ChevronDown, ChevronRight,
  Trash2, FileText, Check, Loader2, BookMarked,
} from "lucide-react";
import { Link } from "wouter";

interface Collection {
  id: number;
  name: string;
  paperCount: number;
  hasPaper: boolean;
}

interface Paper {
  id: number;
  title: string | null;
  authors: string | null;
}

interface CollectionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentPaperId?: number | null;
  isLoggedIn: boolean;
}

export function CollectionsDrawer({
  isOpen,
  onClose,
  currentPaperId,
  isLoggedIn,
}: CollectionsDrawerProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [papersByCollection, setPapersByCollection] = useState<Record<number, Paper[]>>({});
  const [loadingPapers, setLoadingPapers] = useState<Set<number>>(new Set());
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [toggling, setToggling] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const fetchCollections = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const url = currentPaperId
        ? `/api/collections?paperId=${currentPaperId}`
        : `/api/collections`;
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) setCollections(await res.json());
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, currentPaperId]);

  useEffect(() => {
    if (isOpen) fetchCollections();
    else {
      setShowInput(false);
      setNewName("");
      setConfirmDelete(null);
    }
  }, [isOpen, fetchCollections]);

  const fetchPapers = async (collectionId: number) => {
    if (papersByCollection[collectionId]) return;
    setLoadingPapers((prev) => new Set(prev).add(collectionId));
    try {
      const res = await fetch(`/api/collections/${collectionId}/papers`, { credentials: "include" });
      if (res.ok) {
        const papers = await res.json();
        setPapersByCollection((prev) => ({ ...prev, [collectionId]: papers }));
      }
    } finally {
      setLoadingPapers((prev) => {
        const s = new Set(prev);
        s.delete(collectionId);
        return s;
      });
    }
  };

  const toggleExpand = (id: number) => {
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      fetchPapers(id);
    }
    setExpanded(next);
  };

  const togglePaper = async (collectionId: number, hasPaper: boolean) => {
    if (!currentPaperId) return;
    setToggling((prev) => new Set(prev).add(collectionId));
    try {
      const method = hasPaper ? "DELETE" : "POST";
      const res = await fetch(`/api/papers/${currentPaperId}/collections/${collectionId}`, {
        method,
        credentials: "include",
      });
      if (res.ok) {
        setCollections((prev) =>
          prev.map((c) =>
            c.id === collectionId
              ? { ...c, hasPaper: !hasPaper, paperCount: c.paperCount + (hasPaper ? -1 : 1) }
              : c
          )
        );
        setPapersByCollection((prev) => {
          const next = { ...prev };
          delete next[collectionId];
          return next;
        });
      }
    } finally {
      setToggling((prev) => {
        const s = new Set(prev);
        s.delete(collectionId);
        return s;
      });
    }
  };

  const createCollection = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const col = await res.json();
        setCollections((prev) => [...prev, col]);
        setNewName("");
        setShowInput(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const deleteCollection = async (id: number) => {
    const res = await fetch(`/api/collections/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setCollections((prev) => prev.filter((c) => c.id !== id));
      setConfirmDelete(null);
    }
  };

  const removePaperFromCollection = async (paperId: number, collectionId: number) => {
    const res = await fetch(`/api/papers/${paperId}/collections/${collectionId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setPapersByCollection((prev) => ({
        ...prev,
        [collectionId]: (prev[collectionId] || []).filter((p) => p.id !== paperId),
      }));
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId
            ? { ...c, paperCount: c.paperCount - 1, hasPaper: c.hasPaper && paperId !== currentPaperId ? c.hasPaper : false }
            : c
        )
      );
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed right-0 top-0 h-full w-80 bg-card border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-primary" />
            <span className="font-serif font-semibold text-foreground">Collections</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!isLoggedIn ? (
            <div className="p-8 text-center">
              <BookMarked className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Sign in to create and manage collections
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {currentPaperId && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Add this paper to
                  </p>
                  {collections.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No collections yet — create one below.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {collections.map((col) => (
                        <button
                          key={col.id}
                          onClick={() => togglePaper(col.id, col.hasPaper)}
                          disabled={toggling.has(col.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                            col.hasPaper
                              ? "bg-primary/10 border border-primary/30 text-foreground"
                              : "bg-secondary/50 border border-transparent hover:bg-secondary text-foreground"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              col.hasPaper ? "bg-primary border-primary" : "border-border"
                            }`}
                          >
                            {col.hasPaper && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                          </div>
                          <span className="flex-1 text-left truncate">{col.name}</span>
                          {toggling.has(col.id) && (
                            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-border/50 mt-4" />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {currentPaperId ? "Browse all" : "Your collections"}
                  </p>
                  <button
                    onClick={() => setShowInput((v) => !v)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New
                  </button>
                </div>

                {showInput && (
                  <div className="flex gap-1.5 mb-2">
                    <input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createCollection();
                        if (e.key === "Escape") {
                          setShowInput(false);
                          setNewName("");
                        }
                      }}
                      placeholder="Collection name..."
                      className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={createCollection}
                      disabled={creating || !newName.trim()}
                      className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {creating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}

                {collections.length === 0 ? (
                  <div className="text-center py-8">
                    <FolderOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No collections yet</p>
                    <button
                      onClick={() => setShowInput(true)}
                      className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      Create your first collection
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {collections.map((col) => (
                      <div key={col.id} className="rounded-lg border border-border/50 overflow-hidden">
                        <div className="flex items-center gap-1 px-3 py-2 bg-secondary/30 hover:bg-secondary/50 transition-colors">
                          <button
                            onClick={() => toggleExpand(col.id)}
                            className="flex items-center gap-2 flex-1 text-left min-w-0"
                          >
                            {expanded.has(col.id) ? (
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="text-sm font-medium text-foreground truncate">
                              {col.name}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0 ml-auto pr-1">
                              {col.paperCount}
                            </span>
                          </button>
                          {confirmDelete === col.id ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => deleteCollection(col.id)}
                                className="text-xs text-destructive hover:text-destructive/80 font-medium px-1"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="text-xs text-muted-foreground hover:text-foreground px-1"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(col.id)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {expanded.has(col.id) && (
                          <div className="border-t border-border/40">
                            {loadingPapers.has(col.id) ? (
                              <div className="flex items-center gap-2 px-3 py-2.5 text-muted-foreground">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span className="text-xs">Loading papers...</span>
                              </div>
                            ) : (papersByCollection[col.id] || []).length === 0 ? (
                              <p className="px-3 py-2.5 text-xs text-muted-foreground italic">
                                No papers in this collection
                              </p>
                            ) : (
                              <div className="divide-y divide-border/30">
                                {(papersByCollection[col.id] || []).map((paper) => (
                                  <div
                                    key={paper.id}
                                    className={`flex items-start gap-2 px-3 py-2 group ${
                                      paper.id === currentPaperId ? "bg-primary/5" : ""
                                    }`}
                                  >
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                    <Link
                                      href={`/papers/${paper.id}`}
                                      className="flex-1 min-w-0"
                                      onClick={onClose}
                                    >
                                      <p className="text-xs font-medium text-foreground hover:text-primary transition-colors leading-relaxed">
                                        {paper.title || "Untitled Paper"}
                                      </p>
                                      {paper.authors && (
                                        <p className="text-xs text-muted-foreground truncate">
                                          {paper.authors}
                                        </p>
                                      )}
                                    </Link>
                                    <button
                                      onClick={() =>
                                        removePaperFromCollection(paper.id, col.id)
                                      }
                                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0 mt-0.5"
                                      title="Remove from collection"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
