---
name: Documentation file locations and naming conventions
description: Where docs live in the repo and how change logs / ADRs are named
type: project
---

Service-level and architecture docs live in `docs/` at the repo root. Existing files follow numeric prefixes for ordered architecture docs (e.g., `01-architecture-matching-engine.md`, `02-c4-model.md`, `03-database-er.md`) plus flat files like `architecture.md`, `deployment.md`, `features.md`.

Change log / session entries go in `docs/changes/` using the pattern `YYYY-MM-DD-<slug>.md` (e.g., `2026-04-08-quality-improvements.md`). This subdirectory did not exist before 2026-04-08 and was created for this entry.

Load testing results are stored in `docs/load-testing/`.

**Why:** The project is a bachelor's thesis; docs are written as a project log alongside the codebase, not as external wiki pages.

**How to apply:** When asked to write docs, default to `docs/` for architecture/feature docs and `docs/changes/` for per-session or per-PR change summaries.
