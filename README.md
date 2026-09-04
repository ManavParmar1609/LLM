# DockIQ.AI

DockIQ.AI is a dock-door intelligence platform that helps supervisors and workers track trailer inspections, unloading, issue resolution, and shift handoffs, with an AI engine (NVIDIA LLM API) for severity classification and chat assistance.

## Project Structure

- `backend/` – FastAPI backend (SQLite database, AI engine, REST API)
- `frontend/` – React + Vite frontend (Tailwind CSS)

## Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- An NVIDIA API key (get one at https://build.nvidia.com/) for the AI engine

## Setup & Run

### 1. Clone the repository

```powershell
git clone <your-repo-url>
cd DockIQ
```

### 2. Backend setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Set your NVIDIA API key as an environment variable (required for the AI engine):

```powershell
$env:NVIDIA_API_KEY = "your_nvidia_api_key_here"
```

Run the backend server:

```powershell
python -m uvicorn main:app --app-dir . --host 127.0.0.1 --port 8000
```

The API will be available at `http://127.0.0.1:8000`.

### 3. Frontend setup

In a separate terminal:

```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

The app will be available at `http://127.0.0.1:5173`.

### 4. Reset the database (optional)

To reset/reseed the SQLite database:

```powershell
cd backend
python reset_db.py
```

## Running Tests

```powershell
cd backend
pytest
```

## Environment Variables

See [backend/.env.example](backend/.env.example) for the required environment variables:

| Variable | Description |
|---|---|
| `NVIDIA_API_KEY` | API key used for the NVIDIA LLM chat client |
| `NVIDIA_EMBED_API_KEY` | (Optional) API key used for the NVIDIA embedding client; falls back to `NVIDIA_API_KEY` if not set |
