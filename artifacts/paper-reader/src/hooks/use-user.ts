import { useState, useEffect, useCallback } from "react";

export interface AuthUser {
  id: number;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  googleId: string | null;
  githubId: string | null;
}

export interface AuthProviders {
  google: boolean;
  github: boolean;
}

export function useUser() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [providers, setProviders] = useState<AuthProviders>({ google: false, github: false });

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        setUser(await res.json());
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/providers");
      if (res.ok) setProviders(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchUser();
    fetchProviders();
  }, [fetchUser, fetchProviders]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  return { user, providers, logout, refetch: fetchUser };
}
