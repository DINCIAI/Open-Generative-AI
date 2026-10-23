# Architektur-Notiz (Genjutsu-Fork)

Stand: Fork von `Anil-matcha/Open-Generative-AI` vom 23.10.2026, Branch `feature/genjutsu`.

## 1. Zwei Oberflächen im selben Repo

| | Next-App (Basis für Genjutsu) | Alt-UI (ursprüngliche Electron-Oberfläche) |
|---|---|---|
| Einstieg | `app/studio/[[...slug]]/page.js` → `components/StandaloneShell.js` | `index.html` → `src/main.js` |
| Technik | Next.js 15, React 19, Studios aus `packages/studio` | Vanilla-JS-Komponenten in `src/components/*.js`, gebaut mit Vite nach `dist/` |
| Studios | Image, Layers, Video, Clipping, Motion Control, Vibe Motion, Lip Sync, **Recast (Body Swap)**, Cinema, Audio, Marketing, Workflows, Agents, Apps, AI Influencer | Image, Video, Cinema, Lip Sync, Workflows, Agents, MCP/CLI |
| MuAPI-Zugriff | relativ über `/api/...` → Next-Proxy (`middleware.js`, `app/api/**`) | direkt `https://api.muapi.ai` (Renderer läuft unter `file://`) |
| Start upstream | `npm run dev` (Browser) | `npm run electron:dev` (= `vite build && electron .`) |

`electron/main.js` lädt upstream `dist/index.html`, also die **Alt-UI**. Recast ist dort nicht verfügbar. Entscheidung: Electron startet künftig die Next-App lokal auf 127.0.0.1 und lädt sie (siehe Phase 2); die Alt-UI bleibt per `OGA_LEGACY_UI=1` erreichbar.

## 2. Key-Handling (Ist-Zustand Next-App)

- `components/StandaloneShell.js`
  - `STORAGE_KEY = 'muapi_key'` (Z. ~269); Laden aus `localStorage` beim Mount (Z. ~579), zusätzlich **Cookie** `muapi_key` (1 Jahr, `SameSite=Lax`).
  - `handleKeySave` schreibt localStorage + Cookie, `handleLogout` löscht beides.
  - Axios-Interceptor setzt `x-api-key` (Z. ~616); `getUserBalance` alle 30 s.
  - Der Key geht als Prop `apiKey` an **jedes** Studio; die Studios geben ihn an `packages/studio/src/muapi.js` weiter.
- `components/ApiKeyModal.js`: reines Eingabeformular, ruft `onSave(key)`.
- `packages/studio/src/persistKey.js`: History-/Draft-Keys in localStorage werden mit einem Hash des API-Keys gescoped.
- Server-Routen `app/api/**/route.js` akzeptieren **nur** den Header `x-api-key` (Cookie-Auth wurde upstream entfernt) und löschen eingehende Cookies vor dem Weiterleiten.
- `middleware.js`: Schreibt `/api/v1/*` (außer `creative-agent`, `get_upload_url`, `upload-binary`) per `NextResponse.rewrite` auf `https://api.muapi.ai` um und setzt Security-Header (CSP mit `connect-src` auf `*.muapi.ai`). **Es gibt keine Key-Prüfung in der Middleware** – der im Agentpedia-Review erwähnte „Bypass“ ist daher keine umgehbare Prüfung, sondern ein offener Proxy: Wer den Next-Server erreicht, kann ihn mit eigenem Key nutzen. Gegenmaßnahme: Server nur auf 127.0.0.1 binden (Phase 2).

## 3. Request-Ablauf (`packages/studio/src/muapi.js`)

- `BASE_URL`: unter `http(s)` → `/api` (Proxy), sonst `https://api.muapi.ai`.
- **Upload** `uploadFile(apiKey, file, onProgress)`: `POST {BASE_URL}/api/v1/upload_file` per XHR mit `FormData`, Timeout 300 s, Antwortfeld `url | file_url | data.url`.
- **Submit** `submitAndPoll(endpoint, payload, key, onRequestId, maxAttempts)`: `POST {BASE_URL}/api/v1/{endpoint}` → `request_id | id`.
- **Polling** `pollForGenerationResult` in `packages/studio/src/utils/generationLifecycle.js`: `GET /api/v1/predictions/{id}/result`, **festes Intervall 2 s**, bis zu 900 Versuche (≈ 30 min). 5xx/Netzwerk/JSON-Fehler → nächster Versuch; 4xx → Abbruch + `muapi:auth-required`-Event bei 401/403. Erfolg: `completed|succeeded|success`; Fehler: `failed|error|cancelled|canceled`.
- **Ergebnis-URL**: `outputs[0] | url | output.url`.
- **Kosten**:
  - Vorab-Schätzung: `POST /api/v1/models/{endpoint}/estimate-cost` → `{ cost, currency }` (genutzt in `estimateV2VCost`). → **Basis für die Kostenschätzung der Pipeline.**
  - Ergebnis enthält `cost` (inkl. `refunded`, `amount_credits`, siehe `appendGenerationRefundNotice`). → **Basis für den costLedger.**
  - Guthaben: `GET /api/v1/account/balance`.

## 4. Recast / Body Swap

- UI: `packages/studio/src/components/RecastStudio.jsx` – Quellvideo + Charakterbild hochladen, Modell wählen, optional Prompt/Seitenverhältnis.
- Aufruf: `processRecast(apiKey, params)` → `submitAndPoll(endpoint, payload, …, 900)`.
- History: localStorage `hg_recast_studio_assets` (Uploads) und ein über `scopedPersistKey` gescopeder Verlaufsschlüssel.

### Registrierte Recast-Modelle (`recastModels` in `models.js`, ca. Z. 31695)

| id | Endpoint | Felder | Prompt | Sonstiges |
|---|---|---|---|---|
| `kling-v3.0-pro-recast` | `kling-v3.0-pro-motion-control` | `video_url`, `image_url` | ja | – |
| `runway-act-two-recast` | `runway-act-two-i2v` | `video_url`, `image_url` | nein | `aspect_ratio` (16:9, 9:16, 1:1, 4:3, 3:4, 21:9) |
| `wan2.2-animate-recast` | `wan2.2-animate` | `video_url`, `image_url` | ja | **Entwurfsmodell laut Plan** |

### Weitere für Genjutsu relevante Modelle

| Modell | Ort in `models.js` | Aufruf | Hinweise |
|---|---|---|---|
| `seedance-2.5-motion-control` | `motionControlModels` (ca. Z. 31750) | `processMotionControl` | `video_url`, `images_list` (bis 30 Bilder), `duration` **4–30 s**, `aspect_ratio` (u. a. `9:16`, `adaptive`), `generate_audio`, `high_bitrate`, `seed`. Varianten `-intl-` und `-spicy-`. `seedance-2-motion-control`: max. 15 s, 9 Bilder. |
| `kling-o1-video-edit` | V2V-Modelle (ca. Z. 27694) | `processV2V` | Alternative mit Referenzbildern |
| `ai-video-face-swap` | V2V-Modelle (ca. Z. 27577) | `processV2V` | Gesichts-Durchgang |
| `ai-video-upscaler` / `topaz-video-upscale` | V2V-Modelle (ca. Z. 27624 / 27661) | `processV2V` | Upscaling |
| `wan2.2-animate` | V2V-Modelle (ca. Z. 28112) | `processV2V` | gleicher Endpoint wie Recast-Eintrag |

**Befund zu offenen Punkten:**
- Seedance 2.5 Motion Control erlaubt laut Modell-Definition bis zu **30 s** pro Aufruf – die 10-s-Teilung ist für das Final-Modell evtl. unnötig. In den Testläufen prüfen.
- `processMotionControl` setzt `aspect_ratio` standardmäßig auf `16:9` → für Reels explizit `9:16` übergeben.
- `processMotionControl` hängt einen festen internen Prompt vor den Nutzer-Prompt (Modus `motion_transfer` / `objects_swap`).

## 5. Electron (Ist-Zustand)

- `electron/main.js`: `BrowserWindow` mit `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`; externe Links → `shell.openExternal`; registriert `electron/lib/localInference` und `electron/lib/wan2gpProvider` (lokale Inferenz, nicht MuAPI).
- `electron/preload.js`: exponiert nur `window.localAI` (sd.cpp, Wan2GP). Kein MuAPI-Bezug, kein Key.
- Kein HTTP-Server im Main-Prozess; `vite.config.mjs` hat einen Dev-Proxy `/api` → `api.muapi.ai` (nur `vite dev`).

## 6. Tests

- Node-Testrunner (`node:test`, `node:assert/strict`), Dateien `tests/*.test.js`, CommonJS, testen `electron/lib/*`.
- Upstream hat kein `npm test`-Skript → ergänzt in Phase 2.
