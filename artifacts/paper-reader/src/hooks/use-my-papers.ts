import { useState, useEffect, useCallback } from "react";

export interface MyPaper {
  id: number;
  title: string | null;
  authors: string | null;
  createdAt: string;
  generatedCount: number;
  totalSections: number;
}

export function useMyPapers(enabled: boolean) {
  const [papers, setPapers] = useState<MyPaper[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/papers/mine", { credentials: "include" });
      if (res.ok) setPapers(await res.json());
    } catch {}
    setLoading(false);
  }, [enabled]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { papers, loading, refetch: fetch_ };
}
