# AGENTS.md

Standing orders for this repository.

- Follow the DeepSeek Harness plugin model: services on `ctx`, typed events, and reversible registrations. No privileged core.
- Every package ships a bilingual README with Config, semantics, limitations, and Model Experience (what the model sees / token effect / KV-cache effect).
- Keep the browser URL safety check in one place (`browser-playwright/src/url-guard.ts`); never let a new navigation path bypass it.
- Non-trivial design decisions get an Agent Note under `docs/notes/` explaining the why.
- `pnpm build && pnpm typecheck && pnpm test` must pass before a commit that touches `packages/`.
