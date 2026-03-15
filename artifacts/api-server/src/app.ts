import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "path";
import { existsSync } from "fs";
import { pool } from "@workspace/db";
import authRouter, { passport } from "./routes/auth";
import router from "./routes";

const PgSession = connectPgSimple(session);

const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
const isDevDomain = !!process.env.REPLIT_DEV_DOMAIN;

const app: Express = express();

app.set("trust proxy", 1);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(
  session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "paper-reader-dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: isProduction || isDevDomain,
      sameSite: (isProduction || isDevDomain) ? "none" : "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/api", authRouter);
app.use("/api", router);

// Serve the built frontend when the dist directory exists (production & Paper Reader preview)
const staticDir = path.resolve(process.cwd(), "artifacts/paper-reader/dist/public");
if (existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.use((_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
