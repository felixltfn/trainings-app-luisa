# Chin-Ups & Yoga

Eine kleine Web-App (PWA) für das Chin-Up-Training und die Yoga-Einheiten. Sie wird auf dem iPhone zum Home-Bildschirm hinzugefügt und verhält sich dann wie eine normale App.

**Alle Daten bleiben auf dem Gerät.** Kein Konto, kein Server. Wird die App gelöscht, sind die Einträge weg — dafür gibt es den Backup-Export.

Eigenständige Schwester von `03_TrainingsApp`: gleicher Stack (Vite + React + TypeScript, Dexie/IndexedDB, Recharts, vite-plugin-pwa), eigene Datenbank (`chinups`), eigene Farbe, eigenes Icon.

---

## 1. Lokal starten

```bash
npm install
```

```bash
npm run dev
```

---

## 2. Wie das Training aufgebaut ist

Dreimal pro Woche, immer dieselbe Reihenfolge:

| # | Übung | Eingabe |
| --- | --- | --- |
| 0 | An der Stange hängen (freiwillig) | nur abhaken |
| – | Freier Versuch ohne Band (alle 14 Tage) | geschafft / nicht geschafft + erreichte Höhe |
| 1 | Chin-Ups mit Band, 2 Sätze | Wiederholungen + Band |
| 2 | Langsam ablassen, 1 Satz | Wiederholungen + Sekunden |
| 3 | Oben halten, 1 Satz | Sekunden |

Danach steht der Yoga-Start bereit. Die Yoga-Zeit läuft mit Zeitstempeln, sie übersteht also das Weglegen und Schließen der App. Wer das Stoppen vergisst, kann die Dauer vor dem Speichern überschreiben. Einheiten lassen sich auch ohne Chin-Ups starten oder per Datum und Minuten nachtragen.

**Die App gibt die Steigerung vor.** Nach jeder Einheit steht in normalen Sätzen da, was beim nächsten Mal dran ist:

- **Band:** Beide Sätze mit 6 Wiederholungen → nächstes Mal das dünnere Band, Ziel wieder 3. Zweimal hintereinander nur 2 Wiederholungen → Hinweis auf das dickere Band (ausdrücklich kein Rückschritt). Sonst: gleiches Band, eine Wiederholung mehr.
- **Langsam ablassen:** Stufenleiter 3 × 5 s → 4 × 5 s → 3 × 8 s → 4 × 8 s.
- **Oben halten:** über 20 Sekunden → nächstes Mal tiefer ansetzen (etwa 90 Grad gebeugte Arme), Ziel wieder 10 Sekunden.
- **Freier Versuch:** alle 14 Tage, wöchentlich sobald am dünnsten Band zweimal 6 Wiederholungen stehen.

Das große Ziel: ein freier Chin-Up bis 31.12.2026.

---

## 3. Veröffentlichen (einmalig)

1. Auf github.com ein neues, **öffentliches** Repository anlegen, z. B. `chinups-app`.
2. Im Terminal in diesem Ordner:

```bash
git remote add origin https://github.com/DEIN-NAME/chinups-app.git
```

```bash
git branch -M main && git push -u origin main
```

3. Im Repository: **Settings → Pages → Source: GitHub Actions**.
4. Nach ein bis zwei Minuten (Tab **Actions**, grüner Haken) läuft die App unter `https://DEIN-NAME.github.io/chinups-app/`.

---

## 4. Aufs iPhone

> Nur **Safari** kann Web-Apps zum Home-Bildschirm hinzufügen. Über Chrome, Ecosia oder den Browser in WhatsApp entsteht nur ein Lesezeichen mit grauem Platzhalter-Icon. Ist Safari über die Bildschirmzeit gesperrt, muss es dort einmal freigegeben werden (Einstellungen → Bildschirmzeit → Beschränkungen für Inhalte & Datenschutz → Erlaubte Apps).

1. In **Safari** die Adresse aus Schritt 3 öffnen.
2. Teilen-Symbol → **Zum Home-Bildschirm** → „Als Web-App öffnen" aktiviert lassen → Hinzufügen.
3. Ab jetzt nur noch über das Icon starten — Safari und die App haben **getrennte Speicher**.

---

## 5. Backup

Einstellungen → **Backup exportieren**: erzeugt `chinups-backup-JJJJ-MM-TT.json`, auf dem iPhone über das Teilen-Menü in Dateien oder iCloud sichern. **Backup importieren** stellt alles wieder her und **ersetzt dabei alle Daten** auf dem Gerät.

---

## 6. Dateien

| Datei | Inhalt |
| --- | --- |
| `src/db.ts` | Tabellen: Bänder, Chin-Up-Einheiten, Yoga-Einheiten, Kleinkram |
| `src/logic.ts` | Die Regeln: Etappenziele, Bandwechsel, Stufenleiter, Rückmeldungstexte |
| `src/stats.ts` | Wochenziele, Streaks, Prognose für den ersten freien Chin-Up |
| `src/yogaTimer.ts` | Yoga-Timer über Zeitstempel (übersteht das Schließen der App) |
| `src/screens/` | Heute, Einheit eintragen, Fortschritt, Einstellungen |

Die Bandliste ist in den Einstellungen bearbeitbar — Reihenfolge von „hilft am meisten" nach „hilft am wenigsten". Genau diese Reihenfolge steuert, welches Band als Nächstes vorgeschlagen wird.
