# Hisabche — Platform Matrix

## Comparison

| Feature            | Web                                               | Windows Desktop                                                         | iOS                                                     | Android                                           |
| ------------------ | ------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------- |
| Runtime            | Next.js 16 (Node)                                 | Electron 31 + Vite                                                      | Expo / React Native 0.74                                | Expo / React Native 0.74                          |
| Framework          | Next.js App Router, i18n `[lang]`                 | React 19 + Vite renderer                                                | expo-router, expo `~51`                                 | expo-router, expo `~51`                           |
| Storage (local)    | none — online through the API (React Query cache) | SQLite (`better-sqlite3`) in main process                               | SQLite (`expo-sqlite`, `host/local-db.ts`)              | SQLite (`expo-sqlite`, `host/local-db.ts`)        |
| Sync method        | — (Supabase realtime only wakes React Query)      | app-shell engine over IPC: `/api/sync/{pull,push,snapshot}` + `/stream` | `features/offline/sync-runner.ts`, same endpoints       | `features/offline/sync-runner.ts`, same endpoints |
| Session storage    | localStorage (auth-core adapter)                  | OS credential store via IPC `secure:*`                                  | expo-secure-store (Keychain)                            | expo-secure-store (Keystore)                      |
| Auth backend       | Supabase Auth (email/password), JWT               | Supabase Auth, token in credential store                                | Supabase Auth                                           | Supabase Auth                                     |
| Deployment         | Vercel/Node hosting (`.vercel`, standalone build) | Electron installer / auto-updater                                       | TestFlight (via Expo)                                   | Play Store (via Expo)                             |
| UI kit             | `@hisabche/ui` (shadcn + Tailwind)                | `@hisabche/ui` + desktop components                                     | `@hisabche/ui` + `mobile-ui`                            | `@hisabche/ui` + `mobile-ui`                      |
| State              | Zustand + TanStack Query                          | Zustand stores                                                          | Zustand + TanStack Query                                | Zustand + TanStack Query                          |
| Printing           | JS print + `html2canvas`/`jspdf`                  | print HTML / ESC/POS (`printing.ts`)                                    | —                                                       | —                                                 |
| Biometrics         | —                                                 | —                                                                       | expo-local-authentication                               | expo-local-authentication                         |
| Per-turn/workspace | full                                              | full                                                                    | full                                                    | full                                              |
| **Limitations**    | needs connection window to sync; shared canary    | Windows-only builder; must ship updater                                 | mobile account isn't started — app still in scaffolding | Android build not yet demoted (see below)         |

## Per-platform notes

- **Web (Next.js)** — production host. Vercel-style deployment (`.vercel`,
  output export `standalone`). RFC-compliant RTL + i18n (`fa`/`af`/`en`).
- **Desktop (Windows)** — Electron ships the offline SQLite cache, print
  (including ESC/POS thermal), file import/export, and updater. Auto-update
  via `updater.ts`. Renderer reduced sandbox due to webkitPrint.
- **Mobile (iOS/Android)** — Expo monorepo, but the least-complete product
  surface: features exist mostly in shared packages; some modules are not
  present in the mobile router tree yet.
