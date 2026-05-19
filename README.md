# FlapKap GTM Agent

AI-powered cold email campaign builder for FlapKap BDRs. Upload a leads sheet → agent checks HubSpot ownership → generates industry-segmented campaign copy → BDR gives feedback via chat → one-click launch to SmartLead.

## Architecture

```
frontend (Next.js / Vercel)
    ↕ HTTP + SSE
backend (FastAPI / Railway)
    ↕ Anthropic API (Claude claude-opus-4-7 with tool use)
    ↕ HubSpot Private App API
    ↕ SmartLead API
```

## Quick Start (local dev)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Copy and fill in your keys
copy .env.example .env

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

# Copy and set the backend URL
copy .env.local.example .env.local
# Edit .env.local: NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
```

Open http://localhost:3000

## Environment Variables

### Backend (`.env`)

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key (sk-ant-…) |
| `HUBSPOT_TOKEN` | HubSpot Private App token (pat-na1-…) |
| `SMARTLEAD_API_KEY` | SmartLead API key |

### Frontend (`.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL (e.g. https://your-app.railway.app) |

## Deploy to Railway (Backend)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Select the repo, set **Root Directory** to `backend`
4. Add environment variables: `ANTHROPIC_API_KEY`, `HUBSPOT_TOKEN`, `SMARTLEAD_API_KEY`
5. Railway auto-detects Python via `requirements.txt` and uses `railway.toml` for the start command
6. Copy the generated Railway URL

## Deploy to Vercel (Frontend)

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Set **Root Directory** to `frontend`
3. Add environment variable: `NEXT_PUBLIC_API_URL` = your Railway backend URL
4. Deploy

## Expected Leads Sheet Format

| Column | Required | Notes |
|---|---|---|
| `email` | ✅ | Must be present for the lead to be included |
| `first_name` | Recommended | Or `full_name` |
| `last_name` | Recommended | |
| `company` | Recommended | |
| `title` | Recommended | e.g. CFO, Owner |
| `industry` | Recommended | F&B, Retail, Automotive, etc. |
| `phone` | Optional | Passed to SmartLead |
| `linkedin` | Optional | Passed to SmartLead |

Column names are flexible — the parser recognizes common aliases (e.g. "Company Name", "Job Title", "Email Address").

## Agent Capabilities

The Claude claude-opus-4-7 agent has these tools:

| Tool | What it does |
|---|---|
| `check_hubspot_ownership` | Batch-checks emails against HubSpot CRM, returns owner names |
| `create_smartlead_campaign` | Creates a campaign in SmartLead and sets UAE business-hours schedule |
| `upload_email_sequence` | Uploads the 5-touchpoint email sequence to a campaign |
| `enroll_leads` | Adds leads with all their fields to a campaign |
| `launch_campaign` | Sets campaign status to START |

## Campaign Structure

Each industry gets its own campaign with 5 touchpoints:

| Touch | Day | Focus |
|---|---|---|
| 1 | 0 | Problem-focused intro |
| 2 | +3 | Social proof / case study |
| 3 | +7 | Objection handling (bank line) |
| 4 | +12 | Value-add / UAE market insight |
| 5 | +18 | Breakup email |
