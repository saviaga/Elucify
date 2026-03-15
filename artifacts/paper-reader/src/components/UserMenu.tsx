import { useState } from "react";
import { createPortal } from "react-dom";
import { LogIn, LogOut, User, X, Github, Chrome } from "lucide-react";
import { useUser } from "@/hooks/use-user";

export function UserMenu() {
  const { user, providers, logout } = useUser();
  const [open, setOpen] = useState(false);

  if (user === undefined) {
    return <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />;
  }

  if (user) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary transition-colors"
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name ?? "User"} className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
          )}
          <span className="hidden sm:inline text-sm font-medium text-foreground max-w-[120px] truncate">
            {user.name ?? user.email ?? "Account"}
          </span>
        </button>

        {open && createPortal(
          <div
            className="fixed inset-0 z-[9999]"
            onClick={() => setOpen(false)}
          >
            <div
              className="absolute right-4 top-14 bg-card border border-border rounded-xl shadow-xl w-56 p-1 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2.5 border-b border-border mb-1">
                {user.avatarUrl && (
                  <img src={user.avatarUrl} alt={user.name ?? ""} className="w-10 h-10 rounded-full mb-2" />
                )}
                <p className="text-sm font-semibold text-foreground truncate">{user.name ?? "User"}</p>
                {user.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {user.googleId ? "Google" : "GitHub"} account
                </p>
              </div>
              <button
                type="button"
                onClick={() => { logout(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <LogIn className="w-4 h-4" />
        <span className="hidden sm:inline">Sign in</span>
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999]"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-2xl shadow-2xl w-[calc(100vw-2rem)] max-w-sm p-6 z-10">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-serif font-semibold text-foreground text-lg">Sign in</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Create an account to save your papers and analysis history.
            </p>

            <div className="flex flex-col gap-3">
              {providers.google ? (
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
              ) : (
                <div className="flex items-center gap-3 w-full py-3 px-4 rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground cursor-not-allowed">
                  <Chrome className="w-5 h-5 opacity-40" />
                  Google (not configured)
                </div>
              )}

              {providers.github ? (
                <a
                  href="/api/auth/github"
                  className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-border hover:bg-secondary transition-colors text-sm font-medium text-foreground"
                >
                  <Github className="w-5 h-5" />
                  Continue with GitHub
                </a>
              ) : (
                <div className="flex items-center gap-3 w-full py-3 px-4 rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground cursor-not-allowed">
                  <Github className="w-5 h-5 opacity-40" />
                  GitHub (not configured)
                </div>
              )}
            </div>

            {!providers.google && !providers.github && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-4 text-center">
                No OAuth providers are configured yet. Add your Google or GitHub credentials in settings.
              </p>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
