# Cadence

Cognitive triage system — surfaces the right signals at the right time.

## Live

**https://mydesouza.github.io/Cadence/** — served from `docs/` (compiled React app).

## Project Structure

```
Cadence/
├── backend/                ← The engine. Node.js + PostgreSQL. Scores and ranks all signals.
├── frontend-desktop/       ← The desktop interface. React + Vite. Calendar widget + agent.
├── frontend-mobile/        ← The mobile interface. React Native + Expo. Signal-first view.
├── docs/                   ← Compiled output of frontend-desktop. Served by GitHub Pages.
├── cadence-standalone.html ← Self-contained prototype (desktop + mobile, no build step).
├── Backend Arch/           ← Spec documents and HTML reference.
└── Desktop Figma SVG/      ← Figma design exports.
```

## Getting Started

```bash
# Start the backend
cd backend && npm run dev

# Start the desktop frontend (in a separate terminal)
cd frontend-desktop && npm run dev
```

## Deploying to GitHub Pages

```bash
cd frontend-desktop
npm run build
cp -r dist/. ../docs/
cd ..
git add docs/
git commit -m "deploy: update GitHub Pages build"
git push
```

GitHub Pages is configured to serve from the `docs/` folder on the `main` branch.
Set `VITE_API_BASE` in `frontend-desktop/.env.production` to point at your deployed backend.
