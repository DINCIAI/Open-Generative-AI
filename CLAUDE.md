# Projekt: Genjutsu-Fork von Open-Generative-AI

## Ziel
Mich (Profil "Ich") per Pipeline in bestehende Videos einfügen.
Ausgabe: 30-s-Reels, 1080p, 9:16. UI lokal (Electron, Windows 11), Generierung über MuAPI.

## Stack (Stand Fork, Okt. 2026)
- Next.js 15, React 19, Tailwind, npm workspaces (`packages/studio` + 3 Submodule)
- Zwei UIs im Repo:
  - **Next-App** (`app/`, `components/StandaloneShell.js`, `packages/studio`): alle React-Studios inkl. `RecastStudio.jsx` (Body Swap). **Basis für Genjutsu.**
  - **Alt-UI** (`index.html` → `src/main.js`, Vanilla-JS via Vite): ursprüngliche Electron-Oberfläche, nur per `OGA_LEGACY_UI=1`.
- Electron: `electron/main.js`, `electron/preload.js`, Main-Module in `electron/lib/*` mit `register()`-Muster
- Studios: `packages/studio/src/components`, Modelle: `packages/studio/src/models.js` (riesig, nur gezielt lesen/greppen)
- API-Client: `packages/studio/src/muapi.js`, Polling: `packages/studio/src/utils/generationLifecycle.js`
- MuAPI-Proxy: `middleware.js` + `app/api/**` (akzeptieren nur `x-api-key`-Header)
- Neue Logik: `electron/pipeline/` und `GenjutsuStudio.jsx`

## Befehle
- Setup: `npm run setup` (npm install allein reicht nicht – Submodule + `build:packages`)
- Nach Änderungen in `packages/studio`: `npm run build:studio`
- Web-Dev: `npm run dev` (nur 127.0.0.1)
- Electron-Dev: `npm run electron:dev`
- Build: `npm run electron:build:win`
- Tests: `npm test` (Node `node:test` + `node:assert/strict`, Dateien in `tests/*.test.js`)

## Regeln
- Erst Plan Mode, dann Code. Keine Umsetzung ohne bestätigten Plan.
- API-Key nur im Main-Prozess (safeStorage), nie im Renderer, localStorage oder Cookie. Der Renderer sieht nur den Platzhalter `electron-managed`.
- Keine echten MuAPI-Aufrufe in Tests, immer mocken.
- Kein Job ohne Kostenschätzung und Budget-Check.
- Bestehende Upstream-Dateien minimal ändern, neue Logik in eigene Dateien.
- Ergebnisse sofort lokal speichern, Cloud-URLs nicht als dauerhaft annehmen.
- Server und Proxys nur an 127.0.0.1 binden.
- Kommentare und Commit-Messages auf Englisch, UI-Texte auf Deutsch.

## Modelle (Genjutsu)
- Entwurf: wan2.2-animate | Final: seedance-2.5-motion-control
- Gesicht: ai-video-face-swap | Upscale: ai-video-upscaler
- Max. 10 s pro Teilstück
- Preise/Abrechnungseinheit: siehe `docs/TESTLAEUFE.md` (noch offen)

## Git
- Arbeitsbranch: `feature/genjutsu`; `origin` = DINCIAI-Fork, `upstream` = Anil-matcha/Open-Generative-AI
