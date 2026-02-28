<img width="1459" height="804" alt="image" src="https://github.com/user-attachments/assets/bfc4b4c4-2db9-4619-9eab-d2df55375873" />
<img width="1470" height="796" alt="image" src="https://github.com/user-attachments/assets/2d6d5fd8-4edb-4e6d-b402-9038c510d696" />
<img width="1470" height="800" alt="image" src="https://github.com/user-attachments/assets/5eaacaa0-671e-4d95-8044-ecc1214bd525" />


# AutoPlan

**Lieferrouten planen, optimieren und teilen** — eine webbasierte Anwendung für Lieferdienste und Kuriere.

AutoPlan hilft dir, Lieferstopps zu verwalten, Routen auf der Karte zu visualisieren und per Knopfdruck zu optimieren. Die fertige Route kannst du direkt per WhatsApp an dein Team senden oder in Google Maps zur Navigation öffnen.

---

## Funktionen

### Stopp-Verwaltung
- Lieferstopps hinzufügen, bearbeiten und löschen
- Drag & Drop zum Umsortieren der Reihenfolge
- Zahlungsstatus erfassen (bereits bezahlt / Barzahlung)
- Stopps als erledigt markieren

### Adresseingabe
- Automatische Adressvorschläge über Google Maps
- Kontaktsuche über Lexoffice — Name, Adresse und Telefonnummer werden automatisch übernommen

### Dokumenten-Scan (KI)
- Lieferscheine oder Rechnungen per Kamera, Upload oder Einfügen scannen
- OpenAI Vision erkennt automatisch Name, Adresse und Telefonnummer
- KI-Modell und Scan-Anweisung sind frei konfigurierbar

### Routenplanung
- Interaktive Karte mit Routenanzeige zwischen allen Stopps
- Routenoptimierung per Nearest-Neighbor-Algorithmus
- Routendetails: Gesamtstrecke (km), Fahrzeit und Einzelstrecken

### Kommunikation
- WhatsApp-Nachricht mit allen Lieferdetails generieren und kopieren
- Google Maps Navigations-Link für die gesamte Route
- Telefonnummern, Zahlungsstatus und Hinweise in der Nachricht enthalten

### Kalender
- Lieferdatum auswählen und Tagesübersicht anzeigen
- Kalender zeigt an, an welchen Tagen Lieferungen geplant sind

### Einstellungen
- Standard-Startadresse für Routenberechnung
- API-Key-Status auf einen Blick (konfiguriert / nicht konfiguriert)
- KI-Modell und Scan-Prompt anpassen

---

## Installation

### Voraussetzungen

- [Node.js](https://nodejs.org/) (Version 18 oder höher)
- Ein [Google Cloud](https://console.cloud.google.com/) Projekt mit aktivierten APIs:
  - Maps JavaScript API
  - Geocoding API
  - Directions API

### Schritt 1 — Repository klonen

```bash
git clone https://github.com/dein-benutzername/autoplan.git
cd autoplan
```

### Schritt 2 — Abhängigkeiten installieren

```bash
npm install
```

### Schritt 3 — Umgebungsvariablen einrichten

Kopiere die Vorlage und trage deine API-Keys ein:

```bash
cp .env.example .env
```

Öffne die `.env`-Datei und fülle die Werte aus:

```env
# Pflicht — Google Maps
GOOGLE_MAPS_API_KEY=dein-google-maps-key

# Optional — Dokumenten-Scan per KI
OPENAI_API_KEY=dein-openai-key

# Optional — Lexoffice Kontaktsuche
LEXOFFICE_API_KEY=dein-lexoffice-key
```

### Schritt 4 — Server starten

```bash
npm run dev
```

Die App ist dann unter `http://localhost:5000` erreichbar.

---

## Konfiguration

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Ja | Google Maps — Karten, Geocoding, Routenberechnung |
| `OPENAI_API_KEY` | Nein | OpenAI — Dokumenten-Scan per Foto (GPT-4 Vision) |
| `LEXOFFICE_API_KEY` | Nein | Lexoffice — Kontaktsuche nach Name |

API-Keys werden sicher als Umgebungsvariablen auf dem Server gespeichert und nie an den Browser übertragen (außer Google Maps, da für die Karte notwendig).

Weitere Einstellungen (Startadresse, KI-Modell, Scan-Prompt) können direkt in der App über das Einstellungen-Menü konfiguriert werden.

---

## Technologie-Stack

### Frontend
- **React** mit TypeScript
- **Vite** als Build-Tool
- **Tailwind CSS** für das Styling
- **shadcn/ui** (Radix UI) für UI-Komponenten
- **TanStack React Query** für Server-State
- **@dnd-kit** für Drag & Drop
- **Wouter** für Client-Side Routing

### Backend
- **Node.js** mit **Express**
- **TypeScript** (via tsx)
- **dotenv** für Umgebungsvariablen

### APIs
- **Google Maps Platform** — Karten, Geocoding, Directions
- **OpenAI API** — GPT-4 Vision für Dokumenten-Scan
- **Lexoffice API** — Kontaktverwaltung

---

## Projektstruktur

```
autoplan/
├── client/src/
│   ├── pages/          # Seiten (Home)
│   ├── components/     # UI-Komponenten
│   ├── hooks/          # React Hooks
│   └── lib/            # Hilfsfunktionen & Konfiguration
├── server/
│   ├── index.ts        # Server-Einstiegspunkt
│   └── routes.ts       # API-Routen
├── shared/
│   └── schema.ts       # Datenmodelle
├── .env.example        # Vorlage für API-Keys
└── package.json
```

---

## Lizenz

Dieses Projekt wurde entwickelt von [OpenKairo](https://openkairo.de/).
