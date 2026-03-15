import { Router, type Request, type Response } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";

const router = Router();

const BASE_URL = process.env.BASE_URL
  || (process.env.REPLIT_DEPLOYMENT === "1" ? "https://elucify-clausaviaga.replit.app"
  : process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : `http://localhost:${process.env.PORT || 8080}`);

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string | null;
      name: string | null;
      avatarUrl: string | null;
      googleId: string | null;
      githubId: string | null;
    }
  }
}

passport.serializeUser((user: Express.User, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    done(null, user || null);
  } catch (err) {
    done(err, null);
  }
});

async function findOrCreateUser(opts: {
  googleId?: string;
  githubId?: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}) {
  const { googleId, githubId, email, name, avatarUrl } = opts;

  const conditions = [];
  if (googleId) conditions.push(eq(usersTable.googleId, googleId));
  if (githubId) conditions.push(eq(usersTable.githubId, githubId));
  if (email) conditions.push(eq(usersTable.email, email));

  const [existing] = conditions.length
    ? await db.select().from(usersTable).where(or(...conditions))
    : [];

  if (existing) {
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (googleId && !existing.googleId) updates.googleId = googleId;
    if (githubId && !existing.githubId) updates.githubId = githubId;
    if (name && !existing.name) updates.name = name;
    if (avatarUrl && !existing.avatarUrl) updates.avatarUrl = avatarUrl;

    if (Object.keys(updates).length) {
      const [updated] = await db
        .update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }

  const [created] = await db
    .insert(usersTable)
    .values({ googleId: googleId ?? null, githubId: githubId ?? null, email, name, avatarUrl })
    .returning();
  return created;
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/api/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value ?? null;
          const user = await findOrCreateUser({
            googleId: profile.id,
            email,
            name: profile.displayName ?? null,
            avatarUrl: profile.photos?.[0]?.value ?? null,
          });
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/api/auth/github/callback`,
        scope: ["user:email"],
      },
      async (_accessToken: string, _refreshToken: string, profile: any, done: Function) => {
        try {
          const email = profile.emails?.[0]?.value ?? null;
          const user = await findOrCreateUser({
            githubId: profile.id,
            email,
            name: profile.displayName || profile.username || null,
            avatarUrl: profile.photos?.[0]?.value ?? null,
          });
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}

router.get("/auth/google", (req: Request, res: Response, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(503).json({ error: "Google auth not configured" });
    return;
  }
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

router.get(
  "/auth/google/callback",
  (req: Request, res: Response, next) => {
    passport.authenticate("google", { failureRedirect: "/?auth=error" })(req, res, next);
  },
  (_req: Request, res: Response) => {
    res.redirect("/?auth=success");
  }
);

router.get("/auth/github", (req: Request, res: Response, next) => {
  if (!process.env.GITHUB_CLIENT_ID) {
    res.status(503).json({ error: "GitHub auth not configured" });
    return;
  }
  passport.authenticate("github", { scope: ["user:email"] })(req, res, next);
});

router.get(
  "/auth/github/callback",
  (req: Request, res: Response, next) => {
    passport.authenticate("github", { failureRedirect: "/?auth=error" })(req, res, next);
  },
  (_req: Request, res: Response) => {
    res.redirect("/?auth=success");
  }
);

router.get("/auth/me", (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

router.post("/auth/logout", (req: Request, res: Response) => {
  req.logout(() => {
    res.json({ success: true });
  });
});

router.get("/auth/providers", (_req: Request, res: Response) => {
  res.json({
    google: !!process.env.GOOGLE_CLIENT_ID,
    github: !!process.env.GITHUB_CLIENT_ID,
  });
});

export { passport };
export default router;
