# Chin-Ups & Yoga — Projektregeln

Eigenständige Schwester-App von `../03_TrainingsApp` (für Felix' Freundin). Gleicher Stack,
eigene Datenbank `chinups`, eigene Akzentfarbe (Pink) und eigenes Icon. Kein Backend.

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

`src/gamification.ts` + `src/screens/Rewards.tsx`. Die Kammer (`public/chamber.webp`) färbt pro Einheit
(Chin-Ups + Yoga) ein Ding ein – Positionen in `CHAMBER_SPOTS`, auf das Bild vermessen. Das
Kraft-Fläschchen (`public/potion.webp`) zeigt geschätzte Kraft ÷ Körpergewicht. Neue Bilder immer
als heller 3D-Clay-Render auf freigestelltem Hintergrund (passt zum App-Look), keine dunklen Fotos;
wird ein Bild getauscht, müssen Spots und `POTION_*`-Grenzen neu vermessen werden.
