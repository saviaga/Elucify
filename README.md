# Elucify

**Understand complex research — in minutes, not hours.**

Elucify is an AI-powered research paper reader that transforms dense academic papers into clear, structured insights. Upload a PDF or paste an arXiv link and get an interactive dashboard with summaries, glossaries, figures, and more — powered by your choice of AI provider.

![Elucify screenshot](docs/screenshot.png)

---

## Features

Elucify breaks every paper into **9 analysis modules**, accessible from the sidebar:

| Module | Description |
|---|---|
| **Paper Overview** | Abstract, authors, metadata at a glance |
| **Summary** | Deep section-by-section walkthrough with key takeaways and inline figures |
| **Simplification** | Core ideas explained in plain language |
| **Glossary** | Definitions of all technical terms and jargon |
| **Knowledge Gaps** | What the paper leaves unanswered |
| **Open Problems** | Future research directions suggested by the paper |
| **Figures** | All paper figures in a browsable grid with lightbox |
| **Continue Learning** | Curated concepts and resources to go deeper |
| **Chat with Paper** | Ask any question and get answers grounded in the paper |

Additional capabilities:
- **Google & GitHub OAuth** — sign in to save papers to your account
- **Collections** — organize papers into named groups
- **Bring your own API key** — use OpenAI, Anthropic, Gemini, or DeepSeek
- **Free tier friendly** — works with Gemini's free tier (1,000 req/day, no credit card required)
- **arXiv integration** — paste any arXiv URL and Elucify fetches the full paper text automatically

---

## How to Use

### 1. Sign In
Click **Sign in** in the top-right corner and authenticate with Google or GitHub.

### 2. Add Your API Key
Click **Add API Key** and choose your preferred AI provider:

- **Gemini** (recommended for free usage) — get a free key at [aistudio.google.com](https://aistudio.google.com/app/apikey)
- **OpenAI** — [platform.openai.com](https://platform.openai.com/api-keys)
- **Anthropic** — [console.anthropic.com](https://console.anthropic.com/)
- **DeepSeek** — [platform.deepseek.com](https://platform.deepseek.com/)

Your key is stored locally in your browser and never sent to Elucify's servers.

### 3. Upload a Paper
From the home screen, either:
- **Upload a PDF** — drag and drop or click to browse
- **Paste an arXiv URL** — e.g. `https://arxiv.org/abs/2212.08073`

Click **Generate Interactive Dashboard** and Elucify will process the paper.

### 4. Explore the Analysis
Navigate the sidebar to switch between modules. Each section is generated on demand and cached — so switching back is instant. Hit **Regenerate** on any section to get a fresh analysis.

### 5. Chat with the Paper
Open **Chat with Paper** to ask follow-up questions. Elucify answers using the full paper text as context, so responses are grounded and specific.

### 6. Organize with Collections
Click **Collections** in the nav bar to create named groups and add papers to them. Useful for keeping research by topic or project.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (via Drizzle ORM) |
| Auth | Google OAuth 2.0, GitHub OAuth |
| AI | OpenAI, Anthropic, Google Gemini, DeepSeek (streaming) |
| Monorepo | pnpm workspaces |

---

## Self-Hosting

### Prerequisites
- Node.js 18+
- pnpm
- PostgreSQL database

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/elucify.git
cd elucify

# Install dependencies
pnpm install

# Set environment variables
cp .env.example .env
# Fill in your values (see below)

# Push database schema
pnpm --filter @workspace/db run db:push

# Start the API server
pnpm --filter @workspace/api-server run dev

# Start the frontend
pnpm --filter @workspace/paper-reader run dev
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/elucify

# Session
SESSION_SECRET=your-random-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

> **Note:** AI provider API keys are supplied by each user from the browser — no server-side AI keys are required.

---

## License

MIT
