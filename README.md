# Cadence

Cognitive triage system — surfaces the right signals at the right time.

## Project Structure

```
Cadence/
├── backend/              ← The engine. Node.js + PostgreSQL. Scores and ranks all signals.
├── frontend-desktop/     ← The desktop interface. React + Vite. Calendar widget + agent.
├── frontend-mobile/      ← The mobile interface. React Native + Expo. Signal-first view.
├── Backend Arch/         ← Spec documents and HTML reference.
└── Desktop Figma SVG/    ← Figma design exports.
```

## Getting Started

```bash
# Start the backend
cd backend && npm run dev

# Start the desktop frontend (in a separate terminal)
cd frontend-desktop && npm run dev
```
