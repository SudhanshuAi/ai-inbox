# 🧠 AI Knowledge Inbox

> A production-style single-user web application that accepts plain-text notes and web URLs, stores source content, indexes chunks using OpenAI vector embeddings, and answers questions using Retrieval-Augmented Generation (RAG) with verifiable citations.

![Stack](https://img.shields.io/badge/Stack-TypeScript%20%7C%20React%2018%20%7C%20Express%20%7C%20SQLite%20%7C%20OpenAI-6366f1)
![Deploy Target](https://img.shields.io/badge/Deployment-Render%20(API)%20%2B%20Vercel%20(Web)-22c55e)

---

## 💻 Detailed Local Run Instructions

Follow these step-by-step instructions to get the application running locally on your machine.

### Prerequisites

- **Node.js**: `v20.0.0` or higher (tested on Node v20 and v24)
- **npm**: `v9.0.0` or higher
- **OpenAI API Key**: Required for vector embeddings (`text-embedding-3-small`) and chat completions (`gpt-4o-mini`).

---

### Step 1: Navigate to the Project Root

```bash
cd ai-knowledge-inbox
```

---

### Step 2: Install Workspace Dependencies

This is an npm workspaces monorepo. Running `npm install` at the root will install dependencies across all packages (`@ai-inbox/contracts`, `@ai-inbox/api`, and `@ai-inbox/web`):

```bash
npm install
```

---

### Step 3: Configure Environment Variables

Create the `.env` file for the API backend by copying the template:

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and insert your OpenAI API Key:

```env
# Required:
OPENAI_API_KEY=sk-proj-your-actual-openai-api-key-here

# Optional defaults (pre-configured):
PORT=3001
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173
SQLITE_PATH=./data/knowledge.db
EMBEDDING_MODEL=text-embedding-3-small
CHAT_MODEL=gpt-4o-mini
LOG_LEVEL=info
```

*(Note: `apps/web/.env.example` is also available for the frontend if you need to point to a custom API port, defaulting to `http://localhost:3001` via Vite dev server proxy).*

---

### Step 4: Build Shared Contracts

Build the shared TypeScript contracts package (`@ai-inbox/contracts`):

```bash
npm run build --workspace=@ai-inbox/contracts
```

---

### Step 5: Start Development Servers

Run the single dev command from the root to start **both** the Express API backend (`http://localhost:3001`) and the React + Vite frontend (`http://localhost:5173`) concurrently:

```bash
npm run dev
```

Open your browser and navigate to:
👉 **[http://localhost:5173](http://localhost:5173)**

---

### Step 6: Run Automated Tests

To run the complete test suite (26 tests across 5 test suites covering chunking, cosine retrieval, SSRF security guards, Express routes, and React UI):

```bash
npm test
```

To run a production build verification:

```bash
npm run build
```

---

## 🏛️ Architecture Overview

```
                               ┌─────────────────────────┐
                               │ React + Vite Frontend   │
                               │ (Port 5173 / Vercel)    │
                               └────────────┬────────────┘
                                            │ HTTP / JSON (Zod Contracts)
                                            ▼
                               ┌─────────────────────────┐
                               │  Node.js / Express API  │
                               │  (Port 3001 / Render)   │
                               └──────┬───────────┬──────┘
                                      │           │
           ┌──────────────────────────┘           └──────────────────────────┐
           ▼                                                                 ▼
┌───────────────────────┐                                         ┌───────────────────────┐
│ SQLite Database       │                                         │ OpenAI API            │
│ - items (metadata)    │                                         │ - text-embedding-3    │
│ - chunks (embeddings) │                                         │ - gpt-4o-mini         │
└───────────────────────┘                                         └───────────────────────┘
```

---

## 🧠 Design Decisions & Tradeoffs

### 1. Zero-Dependency Native SQLite Storage (`node:sqlite`)
- **Decision**: Uses Node's built-in `node:sqlite` (`DatabaseSync`) with `Float32Array` binary BLOB serialization for 1536-dim embeddings.
- **Rationale**: Eliminates complex external native C++ build toolchains (like `better-sqlite3` or `sqlite3` node-gyp bindings which often break across different OS/Node versions).
- **Tradeoff**: `node:sqlite` is built into Node 22.5+/24+. On older Node versions, replacing it with `@libsql/client` or PostgreSQL is trivial because of clean repository encapsulation in `src/adapters/db.ts`.

---

### 2. In-Memory Cosine Similarity Vector Retrieval
- **Decision**: Computes cosine similarity scores in application memory across stored chunk vectors for `POST /query`.
- **Rationale**: Keeps local setup lightweight, zero-cost, and instant without requiring hosted vector databases (Pinecone/Qdrant) or complex vector extensions.
- **Tradeoff**: Scalable up to ~50,000 chunks. Beyond this, application memory consumption and linear scanning time increase. The `src/services/retrieval.ts` boundary isolates this logic so it can be swapped for `pgvector` or Qdrant without affecting HTTP routes or UI components.

---

### 3. Paragraph-Aware Chunker with Fallbacks
- **Decision**: Normalizes whitespace, splits on double newlines (`\n\n`), and greedily packs paragraphs into ~1500 character target windows with ~200 character overlap. Oversized paragraphs fall back to sentence boundaries (`[.!?]`), then hard character windows.
- **Rationale**: Paragraphs preserve semantic coherence far better than arbitrary fixed character slicing. Modest overlap (~200 chars) prevents qualifiers from being severed from their primary claims. Character windows avoid tokenization dependencies.
- **Tradeoff**: Very long monolithic single-line texts bypass paragraph breaks and rely on sentence/character fallbacks.

---

### 4. Synchronous Ingestion Lifecycle
- **Decision**: `POST /ingest` performs fetching, text extraction, chunking, vector embedding generation, and database storage within the HTTP request cycle, transitioning item status from `processing` to `ready` or `failed`.
- **Rationale**: Guarantees deterministic state within the timebox without needing a background worker process, Redis, or job queue (e.g. BullMQ). Failed items remain visible with error summaries.
- **Tradeoff**: Network fetching and embedding calls add to request latency (~1–3 seconds per URL).

---

### 5. Strict Server-Side Request Forgery (SSRF) Protection
- **Decision**: URL ingestion parses and validates target destinations against blocked IP lists (loopback `127.0.0.1`, private class A/B/C IPs, link-local `169.254.x.x`, cloud metadata endpoints like AWS/GCP/Alibaba metadata hosts). Follows redirects manually and re-validates each redirect target host.
- **Rationale**: Prevents malicious users from submitting internal system URLs to probe the local host or internal network services.
- **Tradeoff**: Requires explicit redirect handling and host address filtering logic.

---

### 6. Grounded Prompting & Citation Audit Contract
- **Decision**: Embeds context blocks with deterministic labels (`[1]`, `[2]`). Strict system instructions require the model to answer *only* using supplied evidence and append citation markers. The API extracts returned citation labels, verifies them against supplied sources, and returns structured `sources` with relevance scores and exact snippets.
- **Rationale**: Eliminates LLM hallucinations and provides verifiable provenance for every claim.
- **Tradeoff**: Questions that clear the cosine similarity threshold but cannot be answered by the context produce a grounded "insufficient information" response rather than creative guessing.

---

## 🛰️ API Contract

### `POST /ingest`
Ingests a note or web URL.

**Request (Note)**:
```json
{
  "type": "note",
  "title": "Architecture Note",
  "content": "AI Knowledge Inbox is built with React, Express, SQLite, and OpenAI RAG."
}
```

**Request (URL)**:
```json
{
  "type": "url",
  "url": "https://example.com/article"
}
```

**Response (`201 Created`)**:
```json
{
  "item": {
    "id": "uuid-123",
    "sourceType": "note",
    "sourceUrl": null,
    "title": "Architecture Note",
    "preview": "AI Knowledge Inbox is built with React...",
    "status": "ready",
    "errorMessage": null,
    "chunkCount": 1,
    "createdAt": "2026-08-19T22:00:00.000Z",
    "updatedAt": "2026-08-19T22:00:00.000Z"
  },
  "requestId": "req-456"
}
```

---

### `GET /items`
Lists saved knowledge items ordered newest first.

**Response (`200 OK`)**:
```json
{
  "items": [...],
  "requestId": "req-456"
}
```

---

### `POST /query`
Performs semantic search across indexed chunks and generates grounded answers with citations.

**Request**:
```json
{
  "question": "What is AI Knowledge Inbox built with?"
}
```

**Response (`200 OK`)**:
```json
{
  "answer": "AI Knowledge Inbox is built with React, Express, SQLite, and OpenAI RAG [1].",
  "sources": [
    {
      "citationLabel": "[1]",
      "itemId": "uuid-123",
      "title": "Architecture Note",
      "sourceType": "note",
      "sourceUrl": null,
      "snippet": "AI Knowledge Inbox is built with React, Express, SQLite, and OpenAI RAG.",
      "score": 0.892
    }
  ],
  "requestId": "req-456"
}
```

---

## 🌐 Free-Tier Cloud Deployment Guide

### Backend API Deployment (Render Free Web Service)
1. Push code to GitHub and connect repository in [Render](https://render.com).
2. Set **Root Directory**: `apps/api`
3. Set **Build Command**: `npm install && npm run build`
4. Set **Start Command**: `node dist/index.js`
5. Configure Environment Variables:
   - `NODE_ENV`: `production`
   - `OPENAI_API_KEY`: `sk-your-openai-api-key`
   - `SQLITE_PATH`: `/data/knowledge.db`
   - `FRONTEND_ORIGIN`: `https://your-app.vercel.app`
6. Add a **Persistent Disk** mounted at `/data` (1GB).

### Frontend Deployment (Vercel Free Hobby Plan)
1. Import repository in [Vercel](https://vercel.com).
2. Set **Root Directory**: `apps/web`
3. Framework Preset: `Vite`
4. Set Environment Variable:
   - `VITE_API_URL`: `https://your-backend-api.onrender.com`
5. Deploy.

---

## 📈 Production Evolution Path

1. **Vector Database**: Migrate in-memory cosine search to **PostgreSQL + pgvector** or **Qdrant** for indexed HNSW vector search.
2. **Async Job Queue**: Shift URL fetching and embedding generation to **BullMQ + Redis** with progress polling and webhook updates.
3. **Multi-Tenancy & Auth**: Integrate JWT authentication (Clerk / Auth0) and scope items/chunks by `user_id`.
4. **Hybrid Retrieval**: Combine dense vector search with sparse keyword search (**BM25**) and cross-encoder reranking (**Cohere Rerank**).

---

## 📄 License
MIT License
