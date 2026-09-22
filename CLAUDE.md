# Chin-Ups & Yoga — Projektregeln

Eigenständige Schwester-App von `../03_TrainingsApp` (für Felix' Freundin). Gleicher Stack,
eigene Datenbank `chinups`, eigene Akzentfarbe (Rot #E30B0B), eigener Name „Training“ und eigenes Icon. Kein Backend.

## Regel 1: Die App gibt die Steigerung vor, nicht die Nutzerin

Alle Regeln stehen in `src/logic.ts` (`buildPlan`). Die Ziele stehen im Eintrage-Formular
über jeder Übung – nach dem Speichern gibt es bewusst keine Auswertung. Texte immer in
Alltagssprache, keine Fachbegriffe wie RIR, Progression oder Volumen.

## Regel 2: Keine Fachbegriffe, keine Gewichte, keine Pausen

Gewicht, RIR, Pausenzeiten, Übungsalternativen und Trainingstag-Auswahl gibt es hier
bewusst nicht. Die Einheit ist immer dieselbe.

## Regel 3: Bänder erkennt sie an der Farbe

Jedes Band hat eine Farbe aus `BAND_COLORS` (grell, wie echte Bänder). Farbpunkt überall
mitzeigen: Auswahl, Tagesziel, Einstellungen, Diagrammlinien. Namen sind frei wählbar,
deshalb nie Adjektive daraus bauen, sondern Farbe + Name nennen.

## Regel 3b: Sekunden beim Ablassen kommen aus der Stufenleiter

Sie trägt bei den negativen Chin-Ups nur die Wiederholungen ein; gespeichert wird die
Sekundenzahl der aktuellen Stufe (`plan.negative.seconds`).

## Regel 4: Yoga-Timer rechnet mit Zeitstempeln

`src/yogaTimer.ts` speichert nur den Startzeitpunkt in localStorage. iOS pausiert
JavaScript, wenn das Handy weggelegt wird — die Dauer wird immer aus der Uhr berechnet.

## Regel 5: wie in der Schwester-App

Manifest und Icons nie in den Service-Worker-Cache; keine nativen `<select>`, `alert()`
oder `prompt()` (dafür `src/Picker.tsx` und Inline-Meldungen).

## Regel 6: Belohnung im 3D-Miniatur-Look

`src/gamification.ts` + `src/screens/Rewards.tsx`. Die Insel (`public/chamber.webp`) bekommt pro
Chin-Up-Tag ein Teil (`CHAMBER_PIECES` = 42 = 14 Wochen × 3), Yoga läuft nur mit. Der heutige Tag zählt
erst, wenn er fertig ist: nach dem Yoga-Speichern oder mit „Heute kein Yoga“ (Meta `dayClosed`); frühere
Tage zählen immer. Danach poppt `ChamberReveal` (in `App.tsx`, über jedem Tab) mit dem neuen Teil auf (Meta `chamberSeen`). Die Yoga-Frage nach den Chin-Ups kommt aus den gespeicherten Daten, nicht aus einem Zwischenzustand. Was noch
nicht erreicht ist, fehlt ganz; das Einhorn ist immer das letzte Teil. Die Teile stehen in
`public/chamber-pieces.png` (Grauwert = Nummer × 3), erzeugt mit `python3 scripts/split-chamber.py`
(dauert ~9 Min.). Das Kraft-Fläschchen besteht aus leerem Glas + reiner Flüssigkeitsebene
(`potion-empty/-liquid.webp`), nur die Flüssigkeit wird abgeschnitten. Neue Bilder immer als heller
3D-Clay-Render, freigestellt; nach einem Bildtausch Teile neu berechnen (Einhorn-Punkt `UNICORN` im Skript
prüfen) und `POTION_LIQUID_*` neu vermessen.

## Regel 7: Serie nur für Chin-Ups

Die Wochenserie zählt nur Chin-Up-Wochen. Yoga wird eingetragen und angezeigt, hat aber keine Serie.
