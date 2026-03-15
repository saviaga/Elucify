# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── paper-reader/       # React + Vite academic paper analysis dashboard
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations-openai-ai-server/  # OpenAI AI integration (server-side)
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace config
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package
```

## Paper Reader App

Academic paper analysis dashboard that helps users understand research papers through AI-generated structured explanations.

### Features
- Paste paper text or enter arXiv URL/ID
- AI generates multiple analysis sections per paper
- Sections: Paper, Summary, Paper to Video, Whiteboard, Paper Prompts, Conceptual Simplification, Glossary, Knowledge Gaps, Open Problems, Continue Learning, Related Papers, Authors, Collections, Tweets, Reddit
- SSE streaming for real-time content generation
- Results cached in PostgreSQL so sections don't regenerate on tab switch
- Sidebar navigation with icons for each section
- Markdown rendering for all generated content

### Architecture
- **Frontend**: React + Vite at `/` (port from env)
- **Backend**: Express API at `/api`
- **AI**: OpenAI gpt-5.2 via Replit AI Integrations proxy
- **DB Tables**: `papers` (id, title, authors, input_text, created_at), `paper_sections` (id, paper_id, section_key, content, created_at)

### API Endpoints
- `POST /api/papers` - Submit paper (text or arXiv URL)
- `GET /api/papers` - List all papers
- `GET /api/papers/:id` - Get paper by ID
- `GET /api/papers/:id/sections/:sectionKey` - Get cached section
- `POST /api/papers/:id/sections/:sectionKey/generate` - Generate section via SSE streaming

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/`.

- Routes: `src/routes/index.ts` mounts sub-routers
- Paper routes: `src/routes/papers/index.ts` - CRUD + AI generation
- Paper prompts: `src/routes/papers/prompts.ts` - Section prompt definitions
- Depends on: `@workspace/db`, `@workspace/api-zod`, `@workspace/integrations-openai-ai-server`

### `artifacts/paper-reader` (`@workspace/paper-reader`)

React + Vite frontend for paper analysis.

- Home page: paste text or arXiv URL
- Paper view: sidebar navigation with AI-generated sections
- Uses SSE streaming for section generation
- Depends on: `@workspace/api-client-react`, react-markdown, remark-gfm, lucide-react

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

- `src/schema/papers.ts` - Papers table
- `src/schema/paperSections.ts` - Paper sections table (cached AI output)

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config.

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/integrations-openai-ai-server`

OpenAI integration via Replit AI Integrations proxy. Provides pre-configured OpenAI SDK client.

- Env vars: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` (auto-provisioned)
