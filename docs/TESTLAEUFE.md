# Testläufe Phase 1 (manuell, kostenpflichtig)

Ziel: Modell-Favorit, echte Kosten pro 10 s und Abrechnungseinheit klären, bevor die Pipeline (Phase 3) gebaut wird.
Alle Läufe in der App (Web: `npm run dev`, oder nach Phase 2 in Electron) mit **demselben** Material.

## Vorbereitung
- [ ] Testclip: 10 s, Hochformat 9:16, eine Person gut sichtbar, möglichst eigene Aufnahme
- [ ] Zusätzlich: derselbe Clip auf 5 s gekürzt (zeigt, ob pro Sekunde oder pro Aufruf abgerechnet wird)
- [ ] Referenzfoto(s) von mir: frontal, Halbprofil, Ganzkörper; gutes Licht
- [ ] Guthaben vor jedem Lauf notieren (Anzeige in der App oder muapi.ai Dashboard)

## Läufe

| # | Studio | Modell | Clip | Guthaben vorher | Guthaben nachher | Differenz | Dauer bis fertig | `cost` in Antwort* | Qualität (1–5) | Gesicht erkennbar? | Notizen |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Body Swap (Recast) | Wan2.2 Animate | 10 s | | | | | | | | |
| 2 | Body Swap (Recast) | Wan2.2 Animate | 5 s | | | | | | | | |
| 3 | Motion Control | Seedance 2.5 Motion Control, 9:16, 10 s | 10 s | | | | | | | | |
| 4 | Motion Control | Seedance 2.5 Motion Control, 9:16, 5 s | 5 s | | | | | | | | |
| 5 | Video (V2V) | Kling O1 Video Edit | 10 s | | | | | | | | |
| 6 | Video (V2V) | AI Video Face Swap (auf Ergebnis von #1) | 10 s | | | | | | | | |
| 7 (optional) | Motion Control | Seedance 2.5, **30 s** am Stück | 30 s | | | | | | | | Spart das die 10-s-Teilung? |

\* `cost` steht in der Ergebnis-Antwort (DevTools → Network → `.../predictions/<id>/result`). Bitte das ganze `cost`-Objekt kopieren.

## Auswertung
- Abrechnung pro Aufruf oder pro Sekunde? (Vergleich #1/#2 und #3/#4): ____
- Kosten pro 10 s Entwurf: ____ | Final: ____
- Max. Länge Seedance 2.5 pro Aufruf in der Praxis: ____
- Modell-Favorit Entwurf: ____ | Final: ____
- Nötig: Face-Swap-Durchgang ja/nein: ____
