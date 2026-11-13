# AGENTS.md

## Project

Vuetodo is a small personal todo app.

- Frontend: vanilla Vue 3, no build step.
- Main files: `index.html`, `app.js`, `style.css`, `uuidv4.js`.
- Backend: Node.js + Express + SQLite in `server/`.
- Persistence: `GET/PUT /api/todos`, `GET/PUT /api/tags`.
- Tests: `node --test tests/*.test.cjs`.

## Commands

```bash
# tests
node --test tests/*.test.cjs

# local preview
python3 -m http.server 4173 --bind 127.0.0.1
```

Do not use `config.js` for tests: it points at the production API.
When a UI check needs data, block `**/api/**` and seed `localStorage` instead.

## Working rules

- Run tests before committing.
- Add or update tests for changed logic.
- Keep the vanilla Vue style; no frameworks or build tooling without asking.
- When changing `app.js` or `style.css`, bump the cache-buster version in `index.html`.
- Keep diffs focused; do not mix unrelated changes.
- Commit only intended files. Untracked `CODE_REVIEW*.md` are user notes unless asked otherwise.

## Branching and review

- Create a branch from `master` for each change.
- Open a PR; do not merge it yourself unless explicitly asked.
- Deploy only after the user confirms.

## Deploy

- GitHub Pages deploys from `master` automatically.
- VPS (`frserv`) is manual:
  1. pull `/opt/vuetodo`;
  2. back up SQLite;
  3. `docker build -f server/Dockerfile -t vuetodo-api:<sha> .`;
  4. replace the `vuetodo-api` container with the same volume and port.
- Do not touch server data, volumes, or production config without confirmation.

## Safety

- Never commit secrets: `config.js`, `.env`, tokens, private keys, `server/data`.
- Do not push, force-push, delete branches, or deploy unless the user asks.
- Do not run destructive commands against the VPS without explicit approval.
- If requirements are ambiguous, ask before implementing.

## UI checks

- For UI changes, check desktop ~1280px and mobile ~390px.
- Prefer real interaction checks (click, type, keyboard) over static inspection.
- Tag changes should preserve keyboard access and touch targets.