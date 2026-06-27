# Changelog

## 0.2.0 - 2026-06-27

### Neu

- Konfigurierbare Steigerungsregeln ergänzt, inklusive Systemeinstellung und Einstellungsfenster für Kosten, Grenzen und Voraussetzungen.
- Lern-Dialoge für Meisterschaften und Zauber zeigen auswählbare Einträge nun gruppiert nach Schwelle bzw. Grad und können alternativ alphabetisch sortiert werden.
- Ausgewählte oder gelistete Kompendiumseinträge können direkt aus den Auswahl-Dialogen und dem Planungsfenster geöffnet werden.

### Verbessert

- Steigerungs-Dialoge nutzen nun ein sheet-artiges Foundry-Fenster mit eigener Fensterklasse, Mindestgrößen und besserem Scrollverhalten.
- Auswahl-Dropdowns werden als fix positioniertes Overlay platziert, berücksichtigen den verfügbaren Platz im Fenster und bleiben dadurch auch bei langen Listen besser sichtbar.
- Dropdown-Zeilen, Gruppenköpfe, Hover-/Fokuszustände und doppelte Auswahlhinweise wurden optisch nachgezogen.
- Rückgängig-Schaltflächen in Chatkarten werden nur noch angezeigt, wenn der aktuelle Benutzer den betroffenen Charakter ändern darf oder GM ist.

### Behoben

- Steigerungen über den aktuell erreichten Heldengrad hinaus werden nicht mehr erlaubt, wenn erst die Kosten der gerade geprüften Steigerung die XP-Schwelle erreichen würden.
- Rückgängig-Aktionen prüfen die Berechtigung nun auch beim Ausführen und melden fehlende Rechte sauber.

### Tests

- Tests für konfigurierbare Steigerungsregeln, Einstellungsformular, Dialogfenster-Optionen, Dropdown-Layout und Rückgängig-Berechtigungen ergänzt.
