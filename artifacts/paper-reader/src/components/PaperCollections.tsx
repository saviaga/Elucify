import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, FolderOpen, Lock, Loader2, Check } from "lucide-react";

interface Collection {
  id: number;
  name: string;
  paperCount: number;
  hasPaper: boolean;
  createdAt: string;
}

interface PaperCollectionsProps {
  paperId: number;
  isLoggedIn: boolean;
}

export function PaperCollections({ paperId, isLoggedIn }: PaperCollectionsProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/collections?paperId=${paperId}`, { credentials: "include" });
      if (res.ok) setCollections(await res.json());
    } catch {}
    setLoading(false);
  }, [paperId]);

  useEffect(() => {
    if (isLoggedIn) load();
    else setLoading(false);
  }, [isLoggedIn, load]);

  const toggle = async (collection: Collection) => {
    setToggling(collection.id);
    const method = collection.hasPaper ? "DELETE" : "POST";
    try {
      await fetch(`/api/papers/${paperId}/collections/${collection.id}`, {
        method,
        credentials: "include",
      });
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collection.id
            ? { ...c, hasPaper: !c.hasPaper, paperCount: c.paperCount + (c.hasPaper ? -1 : 1) }
            : c
        )
      );
    } catch {}
    setToggling(null);
  };

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
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
      } else {
        const err = await res.json();
        setError(err.error || "Failed to create collection");
      }
    } catch {
      setError("Failed to create collection");
    }
    setCreating(false);
  };

  const deleteCollection = async (id: number) => {
    setDeleting(id);
    try {
      await fetch(`/api/collections/${id}`, { method: "DELETE", credentials: "include" });
      setCollections((prev) => prev.filter((c) => c.id !== id));
      setConfirmDeleteId(null);
    } catch {}
    setDeleting(null);
  };

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
          <Lock className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          Sign in to organise papers into collections.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Add this paper to one or more collections to keep your reading organised.
      </p>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : collections.length === 0 && !showInput ? (
        <div className="flex flex-col items-center gap-3 py-10 border border-dashed border-border rounded-xl text-center">
          <FolderOpen className="w-8 h-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No collections yet. Create one below.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {collections.map((col) => (
            <div
              key={col.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-background hover:bg-secondary/40 transition-colors group"
            >
              {/* Checkbox toggle */}
              <button
                onClick={() => toggle(col)}
                disabled={toggling === col.id}
                className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-all ${
                  col.hasPaper
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/50"
                } disabled:opacity-50`}
              >
                {toggling === col.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : col.hasPaper ? (
                  <Check className="w-3 h-3" />
                ) : null}
              </button>

              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground truncate">{col.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {col.paperCount} {col.paperCount === 1 ? "paper" : "papers"}
                </span>
              </div>

              {/* Delete */}
              {confirmDeleteId === col.id ? (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-destructive font-medium">Delete?</span>
                  <button
                    onClick={() => deleteCollection(col.id)}
                    disabled={deleting === col.id}
                    className="p-1 rounded text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {deleting === col.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="p-1 rounded text-muted-foreground hover:bg-muted text-xs font-medium"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(col.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                  title="Delete collection"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create collection */}
      {showInput ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
              if (e.key === "Escape") { setShowInput(false); setNewName(""); }
            }}
            autoFocus
            placeholder="Collection name..."
            className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          <button
            onClick={create}
            disabled={creating || !newName.trim()}
            className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save
          </button>
          <button
            onClick={() => { setShowInput(false); setNewName(""); setError(null); }}
            className="px-3 py-2.5 rounded-xl text-sm text-muted-foreground border border-border hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="flex items-center gap-2 text-sm font-medium text-foreground border border-border rounded-xl px-4 py-2.5 hover:bg-secondary hover:border-primary/30 transition-all"
        >
          <Plus className="w-4 h-4 text-primary" />
          Create Collection
        </button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
