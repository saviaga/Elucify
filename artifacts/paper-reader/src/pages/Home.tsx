import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, Link } from "wouter";
import {
  BookOpen,
  Link as LinkIcon,
  FileUp,
  Sparkles,
  Loader2,
  ArrowRight,
  FileText,
  X,
  CheckCircle2,
  Clock,
  ChevronRight,
  BookMarked,
  Trash2,
  Check,
  Github,
  LogIn,
} from "lucide-react";
import { useCreatePaper } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import * as pdfjsLib from "pdfjs-dist";
import { ApiKeyButton } from "@/components/ApiKeyModal";
import { UserMenu } from "@/components/UserMenu";
import { useUser } from "@/hooks/use-user";
import { useMyPapers } from "@/hooks/use-my-papers";
import { CollectionsDrawer } from "@/components/CollectionsDrawer";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface PdfFile {
  name: string;
  pageCount: number;
  text: string;
}

async function extractTextFromPdf(file: File): Promise<PdfFile> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const texts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: unknown) => {
        const t = item as { str?: string };
        return t.str ?? "";
      })
      .join(" ");
    texts.push(pageText);
  }

  return {
    name: file.name,
    pageCount: pdf.numPages,
    text: texts.join("\n\n"),
  };
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, providers } = useUser();
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const { papers: myPapers, loading: papersLoading, refetch: refetchPapers } = useMyPapers(!!user);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [collectionsPaperId, setCollectionsPaperId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"pdf" | "url">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has("arxiv") ? "url" : "pdf";
  });
  const [arxivUrl, setArxivUrl] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("arxiv");
    return id ? `https://arxiv.org/abs/${id}` : "";
  });
  const [pdfFile, setPdfFile] = useState<PdfFile | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  type ArxivSuggestion = { title: string; url: string; authors: string; category: string };
  const [suggestions, setSuggestions] = useState<ArxivSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== "url") return;
    setSuggestionsLoading(true);
    fetch("/api/arxiv/suggestions", { credentials: "include" })
      .then(r => r.json())
      .then(d => setSuggestions(d.papers ?? []))
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false));
  }, [activeTab]);

  const createPaperMutation = useCreatePaper();

  const handleDelete = useCallback(async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`/api/papers/${id}`, { method: "DELETE", credentials: "include" });
      setConfirmDeleteId(null);
      refetchPapers();
    } catch {}
    setDeletingId(null);
  }, [refetchPapers]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".pdf") && file.type !== "application/pdf") {
      setParseError("Please upload a PDF file.");
      return;
    }
    setParseError(null);
    setIsParsing(true);
    try {
      const result = await extractTextFromPdf(file);
      if (!result.text.trim()) {
        setParseError("Could not extract text from this PDF. It may be a scanned image.");
        setIsParsing(false);
        return;
      }
      setPdfFile(result);
    } catch {
      setParseError("Failed to read the PDF. Please try another file.");
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clearPdf = () => {
    setPdfFile(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setShowSignInPrompt(true);
      return;
    }

    const payload =
      activeTab === "pdf"
        ? { text: pdfFile!.text }
        : { arxivUrl };

    if (activeTab === "pdf" && !pdfFile) return;
    if (activeTab === "url" && !arxivUrl.trim()) return;

    createPaperMutation.mutate({ data: payload }, {
      onSuccess: (data) => {
        setLocation(`/papers/${data.id}`);
      },
      onError: (error: any) => {
        if (error?.status === 401) {
          setShowSignInPrompt(true);
        }
      },
    });
  };

  const isSubmitDisabled =
    createPaperMutation.isPending ||
    isParsing ||
    (activeTab === "pdf" && !pdfFile) ||
    (activeTab === "url" && !arxivUrl.trim());

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[50vw] h-[50vw] rounded-full bg-accent/30 blur-3xl pointer-events-none" />

      <nav className="w-full px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 text-primary font-serif font-bold text-xl tracking-tight">
          <BookOpen className="w-6 h-6 text-primary" />
          Elucify
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setCollectionsPaperId(null); setCollectionsOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-lg border border-border/50 transition-colors"
            title="My Collections"
          >
            <BookMarked className="w-4 h-4" />
            <span className="hidden sm:inline">Collections</span>
          </button>
          {user && <ApiKeyButton />}
          <UserMenu />
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 z-10 w-full max-w-4xl mx-auto pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground mb-4 tracking-tight leading-tight">
            Understand complex research{" "}
            <br className="hidden md:block" />
            <span className="text-primary italic font-normal">
              in minutes, not hours.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-sans">
            Upload a PDF or provide an arXiv link. We'll generate an interactive
            dashboard with summaries, glossaries, open problems, and more.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="w-full max-w-2xl bg-card rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/60 overflow-hidden backdrop-blur-xl"
        >
          {/* Tabs */}
          <div className="flex border-b border-border/50 bg-secondary/30 p-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("pdf")}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-all duration-200 ${
                activeTab === "pdf"
                  ? "bg-card text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <FileUp className="w-4 h-4" />
              Upload PDF
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("url")}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-all duration-200 ${
                activeTab === "url"
                  ? "bg-card text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              arXiv URL
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 md:p-8">
            <AnimatePresence mode="wait">
              {activeTab === "pdf" ? (
                <motion.div
                  key="pdf"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="mb-6"
                >
                  {!pdfFile ? (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`h-48 md:h-56 flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 gap-3 select-none ${
                        isDragging
                          ? "border-primary bg-primary/5 scale-[1.01]"
                          : "border-border hover:border-primary/50 hover:bg-secondary/40 bg-background"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={handleInputChange}
                      />
                      {isParsing ? (
                        <>
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          <p className="text-sm text-muted-foreground">
                            Reading PDF...
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <FileUp className="w-6 h-6 text-primary" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">
                              Drop your PDF here, or{" "}
                              <span className="text-primary underline underline-offset-2">
                                browse
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Research papers, preprints, journal articles
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="h-48 md:h-56 flex flex-col items-center justify-center rounded-xl border border-border bg-secondary/20 gap-3 relative px-6">
                      <button
                        type="button"
                        onClick={clearPdf}
                        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5 justify-center">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate max-w-[22ch]">
                            {pdfFile.name}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {pdfFile.pageCount} page{pdfFile.pageCount !== 1 ? "s" : ""} · text extracted
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={clearPdf}
                        className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
                      >
                        Upload a different file
                      </button>
                    </div>
                  )}
                  {parseError && (
                    <p className="mt-2 text-xs text-destructive text-center">
                      {parseError}
                    </p>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="url"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="mb-6 h-48 md:h-56 flex flex-col justify-center"
                >
                  <label className="text-sm font-medium text-foreground mb-2 block font-serif">
                    Research URL
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <LinkIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <input
                      type="url"
                      value={arxivUrl}
                      onChange={(e) => setArxivUrl(e.target.value)}
                      placeholder="https://arxiv.org/abs/2103.00020"
                      className="w-full bg-background rounded-xl border border-border pl-11 pr-4 py-4 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 font-sans"
                      required={activeTab === "url"}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-primary" />
                    Supports arXiv abstract or direct PDF links
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* arXiv suggestions — shown only on the URL tab */}
            {activeTab === "url" && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">
                  Recent from arXiv · Computer Science
                </p>
                {suggestionsLoading ? (
                  <div className="flex gap-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-8 bg-muted/60 rounded-lg animate-pulse flex-1" />
                    ))}
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {suggestions.map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setArxivUrl(p.url)}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl border border-border/60 bg-background hover:bg-primary/5 hover:border-primary/30 transition-all duration-150 group"
                      >
                        <span className="block text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-1">
                          {p.title}
                        </span>
                        <span className="block text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted/60 text-muted-foreground">{p.category}</span>
                          {p.authors}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3.5 px-6 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {createPaperMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing Paper...
                </>
              ) : (
                <>
                  Generate Interactive Dashboard
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {createPaperMutation.isError && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm text-center">
                {createPaperMutation.error?.message ||
                  "Failed to analyze paper. Please try again."}
              </div>
            )}
          </form>
        </motion.div>
      </main>

      {user && (
        <section className="z-10 w-full max-w-4xl mx-auto px-4 pb-20">
          <div className="flex items-center gap-2 mb-5">
            <BookMarked className="w-5 h-5 text-primary" />
            <h2 className="font-serif font-semibold text-foreground text-xl">My Papers</h2>
            {myPapers.length > 0 && (
              <span className="ml-1 text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {myPapers.length}
              </span>
            )}
          </div>

          {papersLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : myPapers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
              No papers yet — upload one above to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myPapers.map((paper) => (
                <div key={paper.id} className="relative group">
                  <Link href={`/papers/${paper.id}`} className="block">
                    <div className="bg-card border border-border/60 rounded-xl p-4 pr-16 hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-serif font-semibold text-foreground text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                            {paper.title || "Untitled Paper"}
                          </h3>
                          {paper.authors && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{paper.authors}</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">
                            {paper.generatedCount}/{paper.totalSections} sections
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(paper.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${Math.round((paper.generatedCount / paper.totalSections) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Card actions */}
                  {confirmDeleteId === paper.id ? (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-background border border-destructive/30 rounded-lg px-2 py-1 shadow-md z-10">
                      <span className="text-xs text-destructive font-medium mr-0.5">Delete?</span>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(paper.id); }}
                        disabled={deletingId === paper.id}
                        className="p-0.5 rounded text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        title="Confirm delete"
                      >
                        {deletingId === paper.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(null); }}
                        className="p-0.5 rounded text-muted-foreground hover:bg-muted"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCollectionsPaperId(paper.id);
                          setCollectionsOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Add to collection"
                      >
                        <BookMarked className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(paper.id); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete paper"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <CollectionsDrawer
        isOpen={collectionsOpen}
        onClose={() => { setCollectionsOpen(false); setCollectionsPaperId(null); }}
        currentPaperId={collectionsPaperId}
        isLoggedIn={!!user}
      />

      {/* Sign-in required modal */}
      <AnimatePresence>
        {showSignInPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSignInPrompt(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <LogIn className="w-5 h-5 text-primary" />
                  <h2 className="font-serif font-semibold text-foreground text-lg">Sign in to continue</h2>
                </div>
                <button onClick={() => setShowSignInPrompt(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Create a free account to generate paper dashboards and save your analysis history.
              </p>

              <div className="flex flex-col gap-3">
                {providers?.google && (
                  <a
                    href="/api/auth/google"
                    className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-border hover:bg-secondary transition-colors text-sm font-medium text-foreground"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </a>
                )}
                {providers?.github && (
                  <a
                    href="/api/auth/github"
                    className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-border hover:bg-secondary transition-colors text-sm font-medium text-foreground"
                  >
                    <Github className="w-5 h-5" />
                    Continue with GitHub
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
