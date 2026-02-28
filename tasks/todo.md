# MOIJEY Sales Rep AI Co-Pilot - Task List

## Planning & Design
- [x] Finalize System Architecture & Component Design
- [x] Define Postgres Schema (with pgvector)
- [x] Create API Specifications
- [x] Create Implementation Plan

## Project Foundation
- [x] Initialize Next.js Project Structure
- [x] Configure Tailwind CSS & Design System (Luxury Professional)
- [x] Set up Environment Variables Template
- [x] Implement Role-Based Access Control (RBAC) Logic
- [x] Create Luxury Login Interface

## Database & Vector Store
- [x] Create Database Migration/Initialization Script (SQL)
- [x] Implement Database Client (Supabase/Postgres)
- [x] Configure pgvector (vector(3072) for gemini-embedding-001)
- [x] Fix vector dimension mismatch (was 1536, migrated to 3072)

## AI & Knowledge Base
- [x] Implement `ai-service` interface (Embedding/Completion wrappers)
- [x] Create Knowledge Ingestion Workflow (Upload -> Chunk -> Embed -> Store)
- [x] Fix ingestion progress tracking bug
- [x] Add reprocess/retry endpoint for failed documents
- [x] Create Retrieval Workflow (Search -> Prompt -> Generate -> Cite)
- [x] Implement "Business Facts" Management (CRUD including delete)

## Admin Features
- [x] Admin Login & Session Management
- [x] Document Management UI (List, Upload, Status, Search, Retry)
- [x] User Management UI (/admin/users) with role/status management
- [x] Audit Log Viewer (/admin/logs) with action filters
- [x] Insights Dashboard (/admin) with metrics
- [x] API: /api/admin/users, /api/admin/insights, /api/admin/logs

## Sales Rep Features
- [x] Sales Rep Login
- [x] AI Chat Interface (Short/Detailed modes)
- [x] Citations & Source View
- [x] Conversation History (sidebar wired to real data, click to load)
- [x] FAQ Quick Buttons
- [ ] Saved Responses (Schema exists, UI pending)

## API Routes
- [x] /api/conversations - list user conversations
- [x] /api/conversations/[id]/messages - load conversation history
- [x] /api/knowledge/facts/[id] DELETE - delete a fact
- [x] /api/knowledge/[id]/reprocess - retry failed ingestion

## Verification & Documentation
- [ ] Run Security Checklist (API key secrets management)
- [ ] Perform MVP Acceptance Tests
- [ ] Write Final Setup Instructions/README

---

## Session Review (2026-02-26)

### What was fixed
1. DB vector dimension: confirmed vector(3072), cleaned 13 failed docs, reset to pending
2. constants.ts: fixed AI model defaults to Gemini models
3. Existing knowledge/[id]/route.ts: fixed async params type error (Next.js 15+)
4. Build: 0 TypeScript errors

### What was built
- /admin page (Insights dashboard with 5 metric cards + recent activity)
- /admin/users page (user list, role change, activate/deactivate)
- /admin/logs page (audit log viewer with action filter)
- /api/knowledge/[id]/reprocess (POST) - retry ingestion from storage
- /api/conversations (GET) - list conversations
- /api/conversations/[id]/messages (GET) - get messages for a conversation
- /api/knowledge/facts/[id] (DELETE) - delete a fact
- /api/admin/users (GET), /api/admin/users/[id] (PATCH)
- /api/admin/insights (GET), /api/admin/logs (GET)

### What was wired
- Knowledge page: search input, retry button for pending/failed docs
- Facts page: delete button wired
- Chat sidebar: real conversation history, click to load, new conversation button

### Remaining
- Saved responses UI (schema exists, future feature)
- Security: move API keys to .env.local
- MVP acceptance testing
