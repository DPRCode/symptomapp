# Symptom-Tagebuch

Persönliche Web-App (PWA) zum täglichen Erfassen von Symptomen. Läuft komplett offline, alle Daten bleiben im Browser des Geräts (`localStorage`). Kein Server, keine Cloud, kein Login.

## Funktionen
- Tageseintrag: Schlafdauer, Schlafqualität, Müdigkeit, Antriebslosigkeit, Brain Fog, Kribbeln Hände/Füße (0–3), Verstopfung, Notizen
- Ein Eintrag pro Tag. Ein bestehender Tag wird beim Auswählen des Datums geladen und kann bearbeitet oder gelöscht werden
- Verlauf: Diagramme und Durchschnittswerte für 14 / 30 / 90 Tage oder den gesamten Zeitraum
- Arztbericht: Druckansicht mit Überblick, Diagrammen und Tabelle aller Einträge (im Druckdialog „Als PDF speichern“)
- Export als CSV (öffnet direkt in Excel), Sicherung und Import als JSON

## Aufs Handy bringen
Die Dateien müssen über **HTTPS** erreichbar sein. Nur dann funktionieren Offline-Modus und „Zum Startbildschirm hinzufügen“. Eine per Messenger verschickte `index.html` reicht nicht.

1. Den Ordner auf einem statischen Hoster veröffentlichen, z. B. GitHub Pages
2. Die URL auf dem Android-Handy in Chrome öffnen
3. Menü ⋮ → „Zum Startbildschirm hinzufügen“ bzw. „App installieren“

Danach startet die App wie eine normale App und funktioniert auch ohne Internet.

## Wichtig zu den Daten
- Die Daten hängen an **dieser Adresse in diesem Browser**. Ändert sich die URL, sieht die App eine leere Datenbank. Vorher eine Sicherung exportieren und danach importieren.
- „Browserdaten löschen“ oder das Deinstallieren der App löscht die Einträge. Deshalb regelmäßig unter **Daten → Sicherung (JSON)** sichern.

## Updates
Nach Änderungen an der App die Versionsnummer `CACHE` in `sw.js` erhöhen.
