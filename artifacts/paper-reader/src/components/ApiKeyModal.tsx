import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, Eye, EyeOff, CheckCircle2, Trash2, KeyRound, Sparkles, ExternalLink } from 'lucide-react';
import { useApiKey, type AiProvider, PROVIDER_META } from '@/hooks/use-api-key';

interface ApiKeyModalProps {
  open: boolean;
  onClose: () => void;
}

export function ApiKeyModal({ open, onClose }: ApiKeyModalProps) {
  const { config, saveConfig, clearConfig } = useApiKey();

  const [provider, setProvider] = useState<AiProvider>(config?.provider ?? 'openai');
  const [apiKey, setApiKey] = useState(config?.apiKey ?? '');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!open) return null;

  const handleSave = () => {
    saveConfig(provider, apiKey);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 900);
  };

  const handleClear = () => {
    clearConfig();
    setApiKey('');
    setSaved(false);
  };

  const meta = PROVIDER_META[provider];

  const modal = (
    <div
      className="fixed inset-0 z-[9999]"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-2xl shadow-2xl w-[calc(100vw-2rem)] max-w-md p-6 z-10 max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 font-serif font-semibold text-foreground text-lg">
            <Settings className="w-5 h-5 text-primary" />
            API Key Settings
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          Use your own API key to generate summaries. Your key is stored only in your browser and sent directly to the AI provider — never to our servers.
        </p>

        {/* Free Gemini tip */}
        <div className="mb-5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Free tier — no credit card needed</span>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed mb-3">
            We recommend Google's Gemini: 1,000 requests/day, one of the best AI models available, and <strong>no credit card required</strong>. Genuinely free — more than enough for daily personal use.
          </p>
          <ol className="text-xs text-emerald-700 dark:text-emerald-400 space-y-1 mb-3 list-none">
            <li><span className="font-semibold">1.</span> Sign in to <strong>aistudio.google.com</strong> with your Google account</li>
            <li><span className="font-semibold">2.</span> Click <strong>"Get API Key"</strong> and copy it</li>
            <li><span className="font-semibold">3.</span> Select <strong>Gemini</strong> below, paste your key, and save</li>
          </ol>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setProvider('gemini');
                setApiKey('');
                window.open('https://aistudio.google.com/apikey', '_blank', 'noopener');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Get free Gemini key
            </button>
          </div>
        </div>

        {/* Provider dropdown */}
        <div className="mb-4">
          <label className="text-sm font-medium text-foreground mb-2 block">Provider</label>
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value as AiProvider);
              setApiKey('');
            }}
            className="w-full bg-background rounded-xl border border-border px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-sm appearance-none cursor-pointer"
          >
            {(Object.keys(PROVIDER_META) as AiProvider[]).map((p) => (
              <option key={p} value={p}>
                {PROVIDER_META[p].label}
              </option>
            ))}
          </select>
        </div>

        {/* API key input */}
        <div className="mb-5">
          <label className="text-sm font-medium text-foreground mb-2 block">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={meta.placeholder}
              className="w-full bg-background rounded-xl border border-border pl-4 pr-10 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {config && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive border border-border hover:border-destructive/40 hover:bg-destructive/5 transition-all duration-150"
            >
              <Trash2 className="w-4 h-4" />
              Remove key
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-sm shadow-primary/20"
          >
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Saved
              </>
            ) : (
              'Save Key'
            )}
          </button>
        </div>

        {config && (
          <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 mt-3 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Using your {PROVIDER_META[config.provider].label} key
          </p>
        )}

        {!config && (
          <p className="text-xs text-center text-muted-foreground mt-3">
            No key set — using shared credits
          </p>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export function ApiKeyButton() {
  const [open, setOpen] = useState(false);
  const { config } = useApiKey();

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="API Key Settings"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors border text-sm font-medium ${
          config
            ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary border-border'
        }`}
      >
        {config ? (
          <>
            <KeyRound className="w-3.5 h-3.5 shrink-0" />
            <span>{PROVIDER_META[config.provider].label}</span>
          </>
        ) : (
          <>
            <Settings className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline text-xs">Add API Key</span>
          </>
        )}
      </button>
      <ApiKeyModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
