# Chin-Ups & Yoga — Projektregeln

Eigenständige Schwester-App von `../03_TrainingsApp` (für Felix' Freundin). Gleicher Stack,
eigene Datenbank `chinups`, eigene Farbe (Beere) und eigenes Icon. Kein Backend.

## Regel 1: Die App gibt die Steigerung vor, nicht die Nutzerin

Alle Regeln stehen in `src/logic.ts` (`buildPlan`, `sessionFeedback`). Texte immer in
Alltagssprache, ganze Sätze, keine Fachbegriffe wie RIR, Progression oder Volumen.

## Regel 2: Keine Fachbegriffe, keine Gewichte, keine Pausen

Gewicht, RIR, Pausenzeiten, Übungsalternativen und Trainingstag-Auswahl gibt es hier
bewusst nicht. Die Einheit ist immer dieselbe.

## Regel 3: Bandnamen sind frei wählbar

Deshalb nie Adjektive daraus bauen („das dünne Band"), sondern `Band „dünn"` schreiben.

## Regel 4: Yoga-Timer rechnet mit Zeitstempeln

`src/yogaTimer.ts` speichert nur den Startzeitpunkt in localStorage. iOS pausiert
JavaScript, wenn das Handy weggelegt wird — die Dauer wird immer aus der Uhr berechnet.

## Regel 5: wie in der Schwester-App

Manifest und Icons nie in den Service-Worker-Cache; keine nativen `<select>`, `alert()`
oder `prompt()` (dafür `src/Picker.tsx` und Inline-Meldungen).
