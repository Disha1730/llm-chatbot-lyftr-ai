# Lyftr AI Full-Stack Assignment: Resilient LLM Chatbot

A high-performance, resilient AI chatbot featuring multi-turn SQLite conversation persistence, automatic key failover across provider pools, and sub-millisecond response caching.

---

## 1. Live URLs

- **Frontend**: `https://llm-chatbot-lyftr-ai.vercel.app/`
- **Backend API**: `https://llm-chatbot-lyftr-ai.onrender.com`
- **Backend Health Check**: `https://llm-chatbot-lyftr-ai.onrender.com/health`

*(Replace with your live deployed URLs once pushed to hosting platforms)*

---

## 2. Run locally: with Docker and without

### Option A: With Docker (Recommended)

Ensure Docker and Docker Compose are installed and running.

1. **Clone the repository and copy the environment file**:
   ```bash
   cp .env.example .env
   ```
   *(Optionally, populate `LLM_API_KEYS` with your real provider API keys, or leave the mock defaults for local testing)*

2. **Start the whole stack with a single command**:
   ```bash
   make up
   ```
   This will build and start:
   - **Backend API** at [http://localhost:8000](http://localhost:8000)
   - **Frontend UI** at [http://localhost:3000](http://localhost:3000)
   - **SQLite Database** persisted in the named Docker volume `lyftr_sqlite_data` mounted at `/data/app.db`.

3. **View live logs**:
   ```bash
   make logs
   ```

4. **Stop the stack**:
   ```bash
   make down
   ```

---

### Option B: Without Docker (Local Development)

#### 1. Backend (FastAPI + SQLite)
Requires Python 3.10+:

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database & server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend API is now running at `http://localhost:8000`. You can inspect interactive Swagger documentation at `http://localhost:8000/docs`.

#### 2. Frontend (React + Vite + Tailwind CSS)
Requires Node.js 18+:

```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Start Vite development server
npm run dev
```
The frontend UI is now running at `http://localhost:3000`.

---

## 3. Design decisions: key fallback, caching, SQLite session storage

### A. Key Fallback & Auto-Failover
- **Key Pool Architecture**: The gateway accepts a comma-separated list of keys via `LLM_API_KEYS` mapped sequentially as `key_1`, `key_2`, ..., `key_N`.
- **Sequential Fallback**: When an upstream key triggers an HTTP 429 (Rate Limit), quota exhaustion, or 5xx server error, the gateway automatically intercepts the exception, records the attempt, and immediately fails over to the next key in the pool.
- **Failover Simulation Hook (`X-Simulate-Failure`)**: When `ENABLE_FAILURE_SIMULATION=true`, the `POST /chat` endpoint inspects the `X-Simulate-Failure` header (e.g. `key_1=429`, `key_1=500`, `*=429`). The gateway simulates the exact error status for specified keys without consuming actual API quotas or billing credits.
- **Graceful Error Handling**: If every key in the pool fails or is simulated to fail (`*=429`), the backend returns a clean HTTP 503 JSON response `{"detail": "all providers unavailable"}`. Nothing is added to the conversation history, and no stack trace or white screen is exposed to the user.

### B. Response Caching
- **Deterministic Cache Key**: The cache key is computed as a SHA-256 digest of `(model, json_serialized_full_messages)`:
  $$\text{Cache Key} = \text{SHA256}(\text{model} + \text{system\_prompt} + \text{history} + \text{new\_message})$$
- **Behavior & Latency**:
  - The first time a message is sent in a new session, it is evaluated via `LIVE_INFERENCE` and persisted in the cache.
  - The identical first message sent in a subsequent session immediately hits the cache, returning `resolution_source = "LLM_CACHE"`, identical reply text, stored input/output tokens, `key_id = null`, and `fallback_attempts = 0`.
  - Cache lookup executes in ~1ms (guaranteed orders of magnitude faster than a live call).
  - A differing prompt or divergent multi-turn history results in a cache miss and live inference.

### C. SQLite Session Storage
- **Isolated SQLite Storage**: Per the specification, session history is stored strictly in SQLite (no external Redis or Postgres dependencies).
- **Persistence Across Container Restarts**: The database file resides at `/data/app.db` mounted to a Docker named volume (`lyftr_sqlite_data`), ensuring complete data persistence across container restarts and updates.
- **Schema & Query Efficiency**:
  ```sql
  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_messages_session_id ON messages (session_id);
  ```
  Assistant metadata (`resolution_source`, `input_tokens`, `output_tokens`) is stored as a JSON string and parsed upon retrieval via `GET /sessions/{session_id}/messages`. System prompts are kept out of the messages table to strictly return only user and assistant messages.

---

## 4. Verification: how to see failover, cache hits and per-message token usage

### 1. Verification with Automated Tests
Run the comprehensive backend test suite:
```bash
# From repository root
make test
# Or directly inside backend/
cd backend && pytest -v
```
All 11 test suites test:
- Health check configuration (`GET /health`)
- Live inference and token tracking
- 422 input validation (empty message, missing session, string > 4000 characters)
- Cache hit vs cache miss behavior
- Key failover (`key_1=429` falling back to `key_2`)
- Total exhaustion returning 503 (`*=429`) with zero database writes
- Session history retrieval (`GET /sessions/{session_id}/messages`) and 404 behavior.

---

### 2. Manual Verification in the UI

1. **Verify Live Inference & Metadata**:
   - Open `http://localhost:3000`.
   - Send: `"What is the capital of France?"`.
   - Next to the assistant reply, inspect the metadata badges:
     - `meta-source`: `LIVE_INFERENCE`
     - `meta-model`: `gemini/gemini-2.0-flash`
     - `meta-latency`: Server response time (e.g. `740 ms`)
     - `meta-input-tokens`: Prompt tokens for this single turn
     - `meta-output-tokens`: Completion tokens for this single turn
     - `key_id`: `key_1`

2. **Verify Response Cache Hit**:
   - Click **New Session** in the top header (or refresh the page).
   - Send the identical message again: `"What is the capital of France?"`.
   - Inspect the metadata badges:
     - `meta-source`: `LLM_CACHE` (green chip)
     - `meta-latency`: Substantially lower (e.g. `2 ms` vs `740 ms`)
     - `key_id`: `null`
     - `fallback_attempts`: `0`
     - Identical reply text and token counts.

3. **Verify Key Failover (`key_1=429` or `key_1=500`)**:
   - In the **Failover Test Hook** dropdown, select `key_1=429`.
   - Send: `"Explain quantum computing in one sentence."`.
   - Inspect the metadata badges:
     - `meta-source`: `LIVE_INFERENCE`
     - `key_id`: `key_2` (successfully failed over from `key_1`)
     - `fallback_attempts`: `1` (amber alert badge in UI).

4. **Verify Total Exhaustion (`*=429` -> 503)**:
   - In the **Failover Test Hook** dropdown, select `*=429`.
   - Send any message.
   - The UI displays a clean, friendly in-chat error card: `Error (HTTP 503): all providers unavailable`.
   - No crash or blank screen occurs.

---

### 3. Verification with cURL Commands

```bash
# 1. Health check
curl -s http://localhost:8000/health | jq .

# 2. Live Inference
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "s-curl-1", "message": "What is the capital of France?"}' | jq .

# 3. Cache Hit (New session, same prompt)
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "s-curl-2", "message": "What is the capital of France?"}' | jq .

# 4. Failover Simulation (Key 1 rate-limited -> Key 2 succeeds)
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: key_1=429" \
  -d '{"session_id": "s-curl-3", "message": "Hello from failover test"}' | jq .

# 5. Total Exhaustion (Status 503)
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: *=429" \
  -d '{"session_id": "s-curl-4", "message": "Should fail cleanly"}' | jq .

# 6. Retrieve Session Messages
curl -s http://localhost:8000/sessions/s-curl-1/messages | jq .
```

---

## 5. Setup Used: editor and AI tools

- **Editor / Development Environment**: Antigravity IDE (powered by Google DeepMind)
- **AI Assistant**: Antigravity AI Agent
- **Container Runtime**: Docker Desktop 29.5 & Docker Compose v2
- **Language Runtimes**: Python 3.11/3.14 & Node.js 20/24

---

## 6. Bonus features: what you added beyond the requirements and why

1. **Interactive In-UI Failover Simulator**: 
   - *Why*: While the backend supports the `X-Simulate-Failure` header via curl, having a visual dropdown in the web UI allows evaluators and demo recording to simulate `key_1=429`, `key_1=500`, and `*=429` on-the-fly without context switching to a terminal.
2. **Visual Failover & Null Key Indicators**:
   - Explicit badges for `Failovers: N` and `key: null` on cached items, giving instant visual clarity on resolution mechanics.
3. **Quick-Start Preset Prompts**:
   - Interactive prompt cards on empty chat screens for 1-click execution of Live Inference, Cache Hit, and Failover testing.
4. **Session Identifier & Reset Actions**:
   - Live display of the active client-generated `session_id` with a 1-click **New Session** button to test fresh multi-turn conversations without clearing browser cache.

---

## 7. Step-by-Step Live Deployment Guide

Follow these steps to deploy both backend and frontend to free public hosting.

### Step 1: Push Code to GitHub
```bash
git init
git add .
git commit -m "feat: complete Lyftr AI full-stack resilient chatbot"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

---

### Step 2: Deploy Backend to Render (with Persistent Disk)
1. Sign in to [Render](https://render.com).
2. Click **New +** > **Web Service**.
3. Select your GitHub repository.
4. Choose **Docker** as the Runtime (it will automatically detect `backend/Dockerfile`), OR choose **Python 3**:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. **Add Persistent Disk**:
   - In the service settings, go to **Disks** > **Add Disk**.
   - Name: `sqlite-data`
   - Mount Path: `/data`
   - Size: `1 GB`
6. **Environment Variables**:
   Add the following environment variables:
   - `LLM_API_KEYS`: `your-key-1,your-key-2` *(e.g. Gemini API keys)*
   - `LLM_MODEL`: `gemini/gemini-2.0-flash`
   - `DATABASE_URL`: `sqlite:////data/app.db`
   - `ENABLE_FAILURE_SIMULATION`: `true`
   - `ALLOWED_ORIGINS`: `*` *(or update with your frontend domain)*
7. Click **Deploy Web Service**.
8. Note your public backend URL (e.g. `https://lyftr-backend.onrender.com`). Verify by visiting `https://lyftr-backend.onrender.com/health`.

---

### Step 3: Deploy Frontend to Vercel (or Netlify)
1. Sign in to [Vercel](https://vercel.com).
2. Click **Add New...** > **Project** and select your GitHub repository.
3. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click edit and select `frontend`.
4. **Environment Variables**:
   - Name: `VITE_API_BASE_URL`
   - Value: `https://lyftr-backend.onrender.com` *(your live Render backend URL from Step 2, no trailing slash)*
5. Click **Deploy**.
6. Once deployed, open your live frontend URL (e.g. `https://lyftr-frontend.vercel.app`).
7. Test sending a message, a repeated message (to see `LLM_CACHE`), and failover using the simulation dropdown!
