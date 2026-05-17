# ServeMate Architecture

ServeMate currently ships as an Express application that serves a static single-page frontend. The production cleanup keeps that deployment shape stable while separating ownership for the next larger migration.

## Frontend

- `frontendIntegration.js` is the current runtime state and service layer for auth, causes, dashboard, leaderboard, payments, profile, notifications, and modal actions.
- `index.html` remains the static shell and progressively receives real backend state.
- Future frontend modules should move into:
  - `frontend/components`
  - `frontend/pages`
  - `frontend/layouts`
  - `frontend/modals`
  - `frontend/services`
  - `frontend/utils`
  - `frontend/hooks`
  - `frontend/constants`
  - `frontend/assets`
  - `frontend/animations`
  - `frontend/state`

## Backend

- Route files stay at the root for backward-compatible deployment.
- Shared business logic now lives in `services`.
- Cross-cutting middleware lives in `src/middleware`.
- Future backend modules should move into:
  - `backend/routes`
  - `backend/controllers`
  - `backend/middleware`
  - `backend/models`
  - `backend/services`
  - `backend/validators`
  - `backend/utils`
  - `backend/config`

## Data Rules

- Homepage cause cards must render core categories even when MongoDB has no activity.
- Metrics, progress, contributors, XP, titles, leaderboard rows, and dashboard stats must come from backend data only.
- Empty states are visual UI states, not fake metrics.

## Gamification Rules

- XP is stored on `User.xp`.
- `services/gamificationService.js` calculates level, title, rarity, progress, and XP-to-next-level.
- `models.js` applies progression before saving users, keeping `User.level` and `User.title` synchronized with real XP.
