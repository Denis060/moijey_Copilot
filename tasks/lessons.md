# MOIJEY Sales Rep AI Co-Pilot - Lessons Learned

*Recording patterns and fixes during the build.*

---

## Lesson 1: Next.js 15+ Async Route Params

**Pattern**: In Next.js 15+, dynamic route segment params are Promises, not plain objects.

**Wrong**:
```typescript
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const { id } = params; // TypeScript error in Next.js 15+
```

**Correct**:
```typescript
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params; // ✅
```

---

## Lesson 2: Gemini Embedding Model Dimensions

**gemini-embedding-001** produces **3072-dimensional** vectors (not 768).

- DB schema must be `vector(3072)` for `gemini-embedding-001`
- Original `init.sql` used `vector(1536)` (OpenAI default) — wrong for Gemini
- Error when mismatched: `"expected X dimensions, not 3072"`

---

## Lesson 3: Session User Fields in NextAuth v5-beta

`session.user.id` is native in NextAuth v5 (from JWT sub). Custom fields need `as any`:

```typescript
// In API routes:
const userId = session.user.id;                          // native
const role = (session.user as any).role;                 // custom
const workspaceId = (session.user as any).workspace_id;  // custom
```

---

## Lesson 5: Next.js 16 — middleware.ts → proxy.ts

`src/middleware.ts` is deprecated in Next.js 16. The file must be renamed to `src/proxy.ts` AND the exported function must be named `proxy` (not `middleware`):

```typescript
// src/proxy.ts
export async function proxy(request: NextRequest) { ... }

export const config = { matcher: [...] };
```

---

## Lesson 4: constants.ts Must Match Actual AI Provider

Always set correct model defaults matching the actual AI provider:
```typescript
// Correct for Gemini:
EMBEDDING_MODEL: process.env.EMBEDDING_MODEL_ID || "gemini-embedding-001",
COMPLETION_MODEL: process.env.COMPLETION_MODEL_ID || "gemini-2.5-flash",
```
