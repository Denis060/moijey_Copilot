# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server on :3000
npm run build        # production build
npm run start        # serve built app
npm run lint         # eslint (flat config in eslint.config.mjs)
```

There is no test runner wired up. The `scripts/` directory holds standalone Node scripts used as ad-hoc tests/utilities — run them directly:

```bash
node scripts/seed.js                  # seed workspace, roles, default admin (admin@moijey.com / moijey-admin-2026)
node scripts/import-products.js path/to/products.csv   # bulk-load product catalog
node scripts/migrate-dimensions.js    # repair vector dimension mismatches
node scripts/test-services.ts         # smoke test ai/vector/rag services
```

DB schema lives in [src/lib/db/init.sql](src/lib/db/init.sql) — there is no migration framework. Apply it by pasting into the Supabase/Neon SQL editor.

## Architecture

Next.js 16 App Router + React 19 + TypeScript. Path alias `@/*` → `src/*`.

### Request flow

1. [src/proxy.ts](src/proxy.ts) is the edge middleware (see "Next.js 16 rename" below). It runs JWT-only auth, redirects unauthenticated users to `/login`, and gates `/admin` to admins and `/manager` to managers/admins.
2. Pages under [src/app/](src/app/) call API routes under [src/app/api/](src/app/api/). Routes call services in [src/lib/](src/lib/).
3. [src/auth.ts](src/auth.ts) is the full NextAuth v5-beta instance (DB + bcrypt). [src/auth.config.ts](src/auth.config.ts) is the edge-safe subset imported by `proxy.ts`. Login is hard-restricted to `@moijeydiamonds.com` emails.

### Two co-pilot modes

The chat UI ([src/components/chat/ChatInterface.tsx](src/components/chat/ChatInterface.tsx)) toggles between:

- **Questions mode** — RAG Q&A. Flow: [/api/chat/ask](src/app/api/chat/ask) → [rag-service](src/lib/ai/rag-service.ts) → [vector-service](src/lib/vector/vector-service.ts) (pgvector cosine similarity) + business facts → Gemini completion. Returns answer with citations.
- **Recommendations mode** — product matching + email drafting. Flow: [/api/copilot/recommend](src/app/api/copilot/recommend) → [copilot-recommendation-service](src/lib/ai/copilot-recommendation-service.ts) (SQL filter on `products` by budget/shape/metal/style) → Gemini draft → optional [email-service](src/lib/ai/email-service.ts) (Resend). Logs to `recommendation_requests`.

### Knowledge ingestion

Admin uploads PDF/DOCX → [/api/knowledge/upload](src/app/api/knowledge/upload) writes file to Supabase Storage (bucket `moijey-docs`, see [src/lib/storage.ts](src/lib/storage.ts)) and a row to `documents` (status `pending`) → [ingestion-service](src/lib/ai/ingestion-service.ts) parses ([parser.ts](src/lib/ai/parser.ts)), chunks (size 500 / overlap 50, see [src/lib/constants.ts](src/lib/constants.ts)), embeds via Gemini, inserts into `document_chunks`. Failed docs can be retried via `/api/knowledge/[id]/reprocess`.

### Roles

Three roles in `roles` table: `admin`, `manager`, `sales_rep`. Role is stamped into the JWT in [auth.config.ts](src/auth.config.ts#L8-L23) and enforced both by `proxy.ts` (page-level) and inside individual API routes (`(session.user as any).role`).

## Project-specific gotchas

These are non-obvious and have already burned us — propagate the pattern, don't re-invent:

- **Gemini embedding dimensions are 3072.** `gemini-embedding-001` produces 3072-dim vectors, not the OpenAI-default 1536 or 768. The `document_chunks.embedding` column must be `vector(3072)`. Never widen/narrow this without running [scripts/migrate-dimensions.js](scripts/migrate-dimensions.js).
- **No vector index exists, by design.** pgvector `ivfflat` and `hnsw` both cap at 2000 dims, so 3072-dim vectors fall back to sequential scan. Don't try to add an index — it will fail to create.
- **Next.js 16 renamed `middleware.ts` → `proxy.ts`.** The exported function must be named `proxy`, not `middleware`. Do not recreate `src/middleware.ts`.
- **Next.js 15+ dynamic route params are async.** Signature must be `{ params }: { params: Promise<{ id: string }> }` and you must `await params`. Plain-object destructuring is a TS error.
- **NextAuth v5 custom session fields need `as any`.** Only `session.user.id` is native (from `token.sub`). For role/workspace use `(session.user as any).role` and `(session.user as any).workspace_id`. Same on the JWT side.
- **Gemini calls go through raw `fetch`, not `@google/generative-ai`.** [ai-service.ts](src/lib/ai/ai-service.ts) hits `https://generativelanguage.googleapis.com/v1beta/...` directly to dodge SDK v1/v1beta versioning issues. Don't replace these with the SDK.
- **Embeddings are cached in-process for 10 minutes.** Same query won't re-embed. See `embeddingCache` in [ai-service.ts](src/lib/ai/ai-service.ts). Business facts are similarly cached per workspace for 5 minutes in [rag-service.ts](src/lib/ai/rag-service.ts).
- **RAG retrieves 10 chunks, drops anything below cosine 0.2.** If nothing passes the threshold, top 3 are used as a best-effort fallback. Tweak `MIN_SIMILARITY_SCORE` / `CHUNK_LIMIT` / `FALLBACK_CHUNKS` in [rag-service.ts](src/lib/ai/rag-service.ts).
- **The RAG prompt forbids the model from mentioning sources, files, or "the knowledge base"** — the rep speaks to the client as themselves. Preserve this framing when editing the prompt.
- **Server actions accept up to 100MB** ([next.config.ts](next.config.ts)) for large PDF uploads. On Vercel, large uploads must avoid `fs` writes (see commit `f9ed148`).

## Workflow conventions

- `tasks/todo.md` is the running checklist of features built / pending. `tasks/lessons.md` accumulates "we hit this footgun once" notes — read it before non-trivial changes and append to it after any user correction.
- Default admin seed: `admin@moijey.com` / `moijey-admin-2026` (from [scripts/seed.js](scripts/seed.js)).
- `.env` (not `.env.local`) is the convention here. Required keys: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GEMINI_API_KEY`, `EMBEDDING_MODEL_ID=gemini-embedding-001`, `COMPLETION_MODEL_ID=gemini-2.5-flash`. For Recommendations mode also: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`. Supabase Storage uses standard `SUPABASE_*` env vars.
