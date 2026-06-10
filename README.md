# jobX — AI Resume Builder (Python / FastAPI edition)

> **Same design. Same features. Same flow.**  
> Backend migrated from TypeScript/Express → **Python 3.12 + FastAPI**.  
> Frontend stays **React 18 + Vite** (standalone, no monorepo).  
> Database: **MongoDB Atlas**.  
> AI: **Groq** via the **OpenAI Python SDK** (`meta-llama/llama-4-scout-17b-16e-instruct` ~120 B).

---

## Project structure

```
jobx-python/
├── backend/                   # FastAPI server
│   ├── main.py                # Entry point — uvicorn app
│   ├── app/
│   │   ├── config.py          # pydantic-settings (reads .env)
│   │   ├── database.py        # Motor async MongoDB client
│   │   ├── models.py          # Pydantic request / response models
│   │   ├── groq_client.py     # OpenAI SDK → Groq with fallback logic
│   │   ├── templates.py       # 12 built-in template definitions
│   │   └── routes/
│   │       ├── health.py      # GET  /api/healthz
│   │       ├── templates.py   # GET  /api/templates
│   │       ├── resumes.py     # CRUD /api/resumes
│   │       └── ai.py          # POST /api/ai/{summary,improve,skills,grammar,score,parse}
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                  # React 18 + Vite (standalone)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.ts         # ← replaces @workspace/api-client-react
│   │   │   │                  #   React Query hooks + fetch calls
│   │   │   ├── types.ts       # All shared TS types (inlined, no workspace)
│   │   │   ├── defaults.ts    # emptyData / defaultTheme / sampleData
│   │   │   ├── docxExport.ts  # DOCX export helper
│   │   │   └── fileImport.ts  # PDF / DOCX text extraction
│   │   ├── pages/             # landing, dashboard, templates, builder, preview
│   │   ├── components/        # AppShell, SortableList, RichText, ui/*
│   │   ├── templates/         # ResumeRender (12 template renderers)
│   │   └── hooks/
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts         # Proxies /api → backend in dev
│   └── .env.example
```

---

## Quick start

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.12+ |
| Node.js | 20+ |
| npm / pnpm / yarn | any |
| MongoDB Atlas account | free tier works |
| Groq API key | [console.groq.com](https://console.groq.com/keys) |

---

### 1 — Clone & configure

```bash
git clone <your-repo>
cd jobx-python
```

**Backend env**

```bash
cd backend
cp .env.example .env
# Edit .env — fill in MONGODB_URI and GROQ_API_KEY
```

**Frontend env**

```bash
cd ../frontend
cp .env.example .env
# In development the Vite proxy handles /api automatically.
# For production set VITE_API_URL=https://your-api-domain.com
```

---

### 2 — Start the backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run (hot-reload)
python main.py
# or:  uvicorn main:app --reload --port 3001
```

API will be at **http://localhost:3001**  
Interactive docs at **http://localhost:3001/docs**

---

### 3 — Start the frontend

```bash
cd frontend
npm install          # or: pnpm install / yarn
npm run dev
```

App will open at **http://localhost:5173**

The Vite dev server proxies `/api/*` to `http://localhost:3001` automatically.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | ✅ | — | Atlas connection string |
| `MONGODB_DB` | | `resumebuilder` | Database name |
| `MONGODB_COLLECTION` | | `resumes` | Collection name |
| `GROQ_API_KEY` | ✅ | — | Your Groq API key |
| `GROQ_BASE_URL` | | `https://api.groq.com/openai/v1` | Groq endpoint |
| `GROQ_MODEL` | | `meta-llama/llama-4-scout-17b-16e-instruct` | Primary model (~120 B) |
| `GROQ_FALLBACK_MODEL` | | `llama-3.3-70b-versatile` | Used if primary is unavailable |
| `PORT` | | `3001` | Server port |
| `CORS_ORIGINS` | | `http://localhost:5173,...` | Comma-separated allowed origins |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `""` (same origin) | Backend URL for production builds |

---

## API endpoints

All routes mounted under `/api` — identical to the original Express server.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/healthz` | Health check |
| `GET` | `/api/templates` | List 12 resume templates |
| `GET` | `/api/resumes` | List all resumes (summary) |
| `POST` | `/api/resumes` | Create a new resume |
| `GET` | `/api/resumes/{id}` | Get a resume |
| `PUT` | `/api/resumes/{id}` | Update a resume |
| `DELETE` | `/api/resumes/{id}` | Delete a resume |
| `POST` | `/api/ai/summary` | Generate professional summary |
| `POST` | `/api/ai/improve` | Improve a bullet point |
| `POST` | `/api/ai/skills` | Suggest ATS skills |
| `POST` | `/api/ai/grammar` | Fix grammar & tone |
| `POST` | `/api/ai/score` | ATS score (Groq + heuristic fallback) |
| `POST` | `/api/ai/parse` | Parse raw resume text → structured data |

---

## Production deployment

### Backend (Render.com)

To run the backend on **Render**, we highly recommend deploying via a **Web Service using a Dockerfile** (since Playwright Chromium requires specific OS-level shared libraries).

1. Select **Docker** as the runtime environment on Render.
2. The provided [Dockerfile](file:///c:/Users/walkingtree/Music/jobx/Jobx/backend/Dockerfile) in the `backend/` folder installs Python, pip packages, and executes `playwright install --with-deps chromium` automatically during build.
3. Configure the following Environment Variables in the Render Dashboard:
   - `MONGODB_URI`: Your MongoDB Atlas URI.
   - `GROQ_API_KEY`: Your Groq API Key.
   - `CORS_ORIGINS`: Your Vercel frontend URL (e.g., `https://jobx-delta.vercel.app`).

### Frontend (Vercel)

1. Deploy the `frontend/` directory to **Vercel**.
2. Configure the following Environment Variable in your Vercel Project Settings:
   - `VITE_API_URL`: Set this to your deployed Render backend URL (e.g., `https://jobx-2.onrender.com`).
3. Vercel will automatically build the static assets with the correct backend endpoint.


---

## What changed vs the original

| | Original | This version |
|-|----------|-------------|
| **Backend runtime** | Node.js 20 | Python 3.12 |
| **Web framework** | Express 4 | FastAPI 0.115 |
| **Validation** | Zod | Pydantic v2 |
| **DB driver** | mongodb (Node) | Motor 3 (async) |
| **AI SDK** | Custom fetch → Groq | OpenAI Python SDK → Groq |
| **AI model** | llama-3.3-70b-versatile | meta-llama/llama-4-scout (≈120 B) |
| **Frontend** | Vite workspace monorepo | Standalone Vite app |
| **API client** | orval-generated hooks | Hand-written React Query hooks |
| **Design / UI** | ← unchanged | ← unchanged |
| **All 12 templates** | ← unchanged | ← unchanged |
| **All AI features** | ← unchanged | ← unchanged |
| **DOCX / PDF export** | ← unchanged | ← unchanged |
