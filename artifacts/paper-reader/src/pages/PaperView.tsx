import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { 
  FileText, AlignLeft,
  Lightbulb, BookA, HelpCircle, Target, GraduationCap, 
  BookOpen, BookMarked, Image,
  ArrowLeft, ChevronRight, Sparkles, AlertCircle, RefreshCw, StopCircle,
  MessageCircle, LogIn, X, Github
} from "lucide-react";
import { useGetPaper, useGetPaperSection } from "@workspace/api-client-react";
import { usePaperSectionStream } from "@/hooks/use-paper-stream";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { PaperChat } from "@/components/PaperChat";
import { PaperFigures } from "@/components/PaperFigures";
import { CollectionsDrawer } from "@/components/CollectionsDrawer";
import { motion, AnimatePresence } from "framer-motion";
import { ApiKeyButton } from "@/components/ApiKeyModal";
import { useApiKey, PROVIDER_META } from "@/hooks/use-api-key";
import { useUser } from "@/hooks/use-user";
import { UserMenu } from "@/components/UserMenu";

const SIDEBAR_SECTIONS = [
  { key: "paper", label: "Paper Overview", icon: FileText },
  { key: "summary", label: "Summary", icon: AlignLeft },
  { key: "conceptual-simplification", label: "Simplification", icon: Lightbulb },
  { key: "glossary", label: "Glossary", icon: BookA },
  { key: "knowledge-gaps", label: "Knowledge Gaps", icon: HelpCircle },
  { key: "open-problems", label: "Open Problems", icon: Target },
  { key: "figures", label: "Figures", icon: Image },
  { key: "continue-learning", label: "Continue Learning", icon: GraduationCap },
  { key: "chat", label: "Chat with Paper", icon: MessageCircle },
];

export default function PaperView() {
  const { id } = useParams();
  const paperId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  
  const [activeSection, setActiveSection] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("section") || "paper";
  });
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const { config: apiKeyConfig } = useApiKey();
  const activeProviderLabel = apiKeyConfig
    ? PROVIDER_META[apiKeyConfig.provider].label
    : "Replit AI (shared)";
  
  // Fetch Paper Metadata
  const { data: paper, isLoading: paperLoading } = useGetPaper(paperId, {
    query: { enabled: !!paperId }
  });

  const { user, providers } = useUser();
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

  // Redirect unauthenticated users back to home (user===undefined means still loading)
  useEffect(() => {
    if (user === null) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const isChat = activeSection === "chat";
  const isFigures = activeSection === "figures";
  const isSpecialSection = isChat || isFigures;

  // Fetch Cached Section Data
  const { 
    data: sectionData, 
    isLoading: sectionLoading, 
    isFetching: sectionFetching,
    error: sectionError 
  } = useGetPaperSection(paperId, activeSection, {
    query: { 
      enabled: !!paperId && !!activeSection && !isSpecialSection,
      retry: false, // Don't retry 404s, we'll handle generation
    }
  });


  // Streaming Hook for Generation
  const { 
    streamSection, 
    stopStream,
    content: streamedContent, 
    isStreaming, 
    error: streamError 
  } = usePaperSectionStream(paperId, activeSection);

  // Countdown timer for per-minute rate limit / server-blocked errors
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  useEffect(() => {
    const isRateLimit = streamError?.startsWith("RATE_LIMIT:");
    const isTooMany = streamError?.startsWith("TOO_MANY_ATTEMPTS:");
    if (!isRateLimit && !isTooMany) { setRetryCountdown(null); return; }
    const seconds = isRateLimit ? (parseInt(streamError!.split(":")[1], 10) || 60) : 60;
    setRetryCountdown(seconds);
    const id = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev === null || prev <= 1) { clearInterval(id); return null; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [streamError]);

  // Open sign-in modal when a 401 error comes back from the generate endpoint
  useEffect(() => {
    const msg = streamError?.toLowerCase() ?? "";
    if (msg.includes("sign in") || msg.includes("not authenticated") || msg.includes("401")) {
      setShowSignInPrompt(true);
    }
  }, [streamError]);

  // Check if we need to auto-generate
  const sectionNotFound = sectionError && (sectionError as any)?.status === 404;
  
  // attemptKey is kept so the "Generate" button can clear it before streaming
  // (allows re-generating after a previous failure in this session)
  const attemptKey = `genAttempted_${paperId}_${activeSection}`;

  // Fetch figures for the Summary section so they can be injected inline
  const [summaryFigures, setSummaryFigures] = useState<{ src: string; caption: string; label: string }[]>([]);
  const isSummary = activeSection === "summary";

  useEffect(() => {
    if (!isSummary || !paperId) return;
    fetch(`/api/papers/${paperId}/figures`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.available && d.figures?.length) setSummaryFigures(d.figures); })
      .catch(() => {});
  }, [isSummary, paperId]);

  // Inject figure images inline into markdown after the first paragraph that references each figure
  function injectFiguresIntoMarkdown(markdown: string, figures: { src: string; caption: string; label: string }[]): string {
    if (!figures.length) return markdown;

    const figureMap = new Map<number, { src: string; caption: string; label: string }>();
    for (const fig of figures) {
      const num = fig.label.match(/\d+/);
      if (num) figureMap.set(parseInt(num[0]), fig);
    }
    if (!figureMap.size) return markdown;

    const blocks = markdown.split(/\n\n+/);
    const result: string[] = [];
    const inserted = new Set<number>();

    for (const block of blocks) {
      result.push(block);
      const refs = [...block.matchAll(/\b[Ff]ig(?:ure)?\.?\s*(\d+)/g)];
      for (const ref of refs) {
        const num = parseInt(ref[1]);
        if (!inserted.has(num) && figureMap.has(num)) {
          const fig = figureMap.get(num)!;
          const caption = fig.caption || fig.label;
          result.push(`![${caption}](${fig.src})`);
          inserted.add(num);
        }
      }
    }
    return result.join("\n\n");
  }

  // Determine what content to show
  const currentSectionInfo = SIDEBAR_SECTIONS.find(s => s.key === activeSection);
  const rawContent = isStreaming 
    ? streamedContent 
    : (sectionData?.content || "No content generated yet.");
  
  const displayContent = (isSummary && summaryFigures.length && !isStreaming)
    ? injectFiguresIntoMarkdown(rawContent, summaryFigures)
    : rawContent;
    
  const showSkeleton = paperLoading || (sectionLoading && !sectionNotFound && !isStreaming);

  if (paperLoading && !paper) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
        <p className="text-muted-foreground font-serif">Retrieving paper insights...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Top Navigation */}
      <header className="h-16 border-b border-border/60 bg-card/80 backdrop-blur-md sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Search</span>
          </Link>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2 text-foreground font-serif font-semibold">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="hidden sm:inline">Elucify</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollectionsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-lg border border-border/50 transition-colors"
            title="My Collections"
          >
            <BookMarked className="w-4 h-4" />
            <span className="hidden sm:inline">Collections</span>
          </button>
          {user && <ApiKeyButton />}
          <UserMenu />
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Main Content Area (Left side) */}
        <main className="flex-1 flex flex-col min-w-0 bg-background relative z-10 overflow-hidden order-2 md:order-1 border-r border-border/40">
          
          {/* Paper Meta Header */}
          <div className="shrink-0 p-6 md:p-10 border-b border-border/50 bg-gradient-to-b from-secondary/30 to-background">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-2 text-xs font-medium text-primary mb-4 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                AI Generated Analysis
              </div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4 leading-tight">
                {paper?.title || "Untitled Paper"}
              </h1>
              {paper?.authors && (
                <p className="text-muted-foreground text-sm md:text-base font-medium font-sans">
                  {paper.authors}
                </p>
              )}
            </div>
          </div>

          {/* Chat Section — Full Height */}
          {isChat && (
            <div className="flex-1 overflow-hidden">
              <PaperChat paperId={paperId} />
            </div>
          )}

          {/* Figures Section */}
          {isFigures && (
            <div className="flex-1 overflow-y-auto scroll-smooth p-6 md:p-10">
              <div className="max-w-4xl mx-auto pb-24">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border/40">
                  <Image className="w-6 h-6 text-primary/80" />
                  <h2 className="text-2xl font-serif font-semibold text-foreground">Figures</h2>
                </div>
                <PaperFigures paperId={paperId} />
              </div>
            </div>
          )}

          {/* Scrolling Content Area (all sections except chat and figures) */}
          {!isChat && !isFigures && <div className="flex-1 overflow-y-auto scroll-smooth p-6 md:p-10 relative">
            <div className="max-w-4xl mx-auto pb-24">
              
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/40">
                <h2 className="text-2xl font-serif font-semibold text-foreground flex items-center gap-3">
                  {currentSectionInfo?.icon && <currentSectionInfo.icon className="w-6 h-6 text-primary/80" />}
                  {currentSectionInfo?.label}
                </h2>
                
                {/* Generation Controls */}
                <div className="flex items-center gap-2">
                  {isStreaming ? (
                    <div className="flex items-center gap-3 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                      </span>
                      Generating via {activeProviderLabel}...
                      <button 
                        onClick={stopStream}
                        className="ml-2 hover:text-foreground text-primary/70 transition-colors"
                        title="Stop Generation"
                      >
                        <StopCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : sectionData && !sectionNotFound ? (
                    <button 
                      onClick={() => { sessionStorage.removeItem(attemptKey); streamSection(); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-colors border border-border"
                      title="Regenerate Section"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Regenerate
                    </button>
                  ) : null}
                </div>
              </div>

              {showSkeleton ? (
                <div className="space-y-6 animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-full"></div>
                  <div className="h-4 bg-muted rounded w-5/6"></div>
                  <div className="h-4 bg-muted rounded w-full"></div>
                  <div className="h-32 bg-muted rounded-xl w-full mt-8"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                  <div className="h-4 bg-muted rounded w-full"></div>
                </div>
              ) : streamError ? (
                <div className="p-6 bg-destructive/5 border border-destructive/20 rounded-xl flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-destructive shrink-0" />
                  <div>
                    {streamError.startsWith("RATE_LIMIT_DAILY:") ? (
                      <>
                        <h3 className="font-semibold text-destructive mb-1 font-serif">Daily Quota Exhausted</h3>
                        <p className="text-sm text-destructive/80 mb-1">Your Gemini free-tier daily quota has been used up.</p>
                        <p className="text-sm text-destructive/60 mb-4">It resets automatically every 24 hours. In the meantime, switch to a different provider (Anthropic, OpenAI, or DeepSeek) or <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="underline">enable billing in Google AI Studio</a> to continue.</p>
                      </>
                    ) : streamError.startsWith("RATE_LIMIT:") ? (
                      <>
                        <h3 className="font-semibold text-destructive mb-1 font-serif">Per-Minute Limit Reached</h3>
                        <p className="text-sm text-destructive/80 mb-1">Gemini's per-minute request quota is temporarily full.</p>
                        <p className="text-sm text-destructive/60 mb-4">
                          {retryCountdown !== null
                            ? <>Ready in <span className="font-mono font-semibold">{retryCountdown}s</span> — the button will re-enable automatically.</>
                            : <>Quota window reset — click Try Again.</>}
                        </p>
                      </>
                    ) : streamError.startsWith("TOO_MANY_ATTEMPTS:") ? (
                      <>
                        <h3 className="font-semibold text-destructive mb-1 font-serif">Too Many Attempts</h3>
                        <p className="text-sm text-destructive/80 mb-1">3 attempts were made in the last 60 seconds for this section.</p>
                        <p className="text-sm text-destructive/60 mb-4">
                          {retryCountdown !== null
                            ? <>Ready in <span className="font-mono font-semibold">{retryCountdown}s</span> — the button will re-enable automatically.</>
                            : <>Quota window reset — click Try Again.</>}
                        </p>
                      </>
                    ) : streamError.startsWith("INVALID_KEY:") ? (
                      <>
                        <h3 className="font-semibold text-destructive mb-1 font-serif">Invalid API Key</h3>
                        <p className="text-sm text-destructive/80 mb-4">Your API key was rejected. Please update it using the key icon in the top bar.</p>
                      </>
                    ) : streamError.startsWith("INVALID_REQUEST:") ? (
                      <>
                        <h3 className="font-semibold text-destructive mb-1 font-serif">Request Rejected (400)</h3>
                        <p className="text-sm text-destructive/80 mb-1">Gemini rejected the request. Common causes:</p>
                        <ul className="text-sm text-destructive/70 mb-4 list-disc list-inside space-y-1">
                          <li>The <strong>Gemini API is not enabled</strong> in your Google Cloud project — <a href="https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com" target="_blank" rel="noreferrer" className="underline">enable it here</a></li>
                          <li>The API key is from the wrong project</li>
                          <li>Billing or quota configuration issue</li>
                        </ul>
                      </>
                    ) : (
                      <>
                        <h3 className="font-semibold text-destructive mb-1 font-serif">Generation Failed</h3>
                        <p className="text-sm text-destructive/80 mb-4">{streamError}</p>
                      </>
                    )}
                    <button 
                      onClick={() => { streamSection(); }}
                      disabled={retryCountdown !== null}
                      className="px-4 py-2 bg-background border border-destructive/20 text-destructive hover:bg-destructive/10 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {retryCountdown !== null ? `Wait ${retryCountdown}s…` : "Try Again"}
                    </button>
                  </div>
                </div>
              ) : sectionNotFound && !isStreaming ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <Sparkles className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">This section hasn't been generated yet.</p>
                  <button
                    onClick={() => {
                      if (!user) { setShowSignInPrompt(true); return; }
                      sessionStorage.removeItem(attemptKey);
                      streamSection();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate
                  </button>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <MarkdownRenderer content={displayContent} />
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>}
        </main>

        {/* Sidebar Navigation (Right side on desktop) */}
        <aside className="w-full md:w-72 lg:w-80 border-t md:border-t-0 md:border-l border-border/60 bg-card/50 backdrop-blur flex flex-col shrink-0 order-1 md:order-2 h-48 md:h-auto overflow-hidden">
          <div className="p-4 border-b border-border/40 bg-card z-10 shrink-0">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest font-sans flex items-center gap-2">
              Analysis Modules
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-1 scroll-smooth">
            {SIDEBAR_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.key;
              // Check if we know this section is generated from the paper metadata summary array
              const isGenerated = paper?.sections?.some(s => s.sectionKey === section.key && s.generated);
              
              return (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all duration-200 group ${
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                      : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary-foreground/90" : "text-muted-foreground group-hover:text-primary"}`} />
                    <span className="text-sm font-medium truncate">{section.label}</span>
                  </div>
                  
                  {isActive ? (
                    <ChevronRight className="w-4 h-4 opacity-70" />
                  ) : isGenerated ? (
                    <div className="w-2 h-2 rounded-full bg-emerald-500/80 mr-1" title="Already generated" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

      </div>

      <CollectionsDrawer
        isOpen={collectionsOpen}
        onClose={() => setCollectionsOpen(false)}
        currentPaperId={paperId}
        isLoggedIn={!!user}
      />

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
                Create a free account to generate paper analysis and save your history.
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
