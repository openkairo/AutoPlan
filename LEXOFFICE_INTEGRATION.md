# Lexoffice Integration – Dokumentation

Diese Dokumentation beschreibt, wie die Lexoffice-Kontaktsuche und Rechnungsanzeige in einer **React + Express (Node.js)** App gebaut wurde. Sie dient als Vorlage für andere Replit-Projekte.

---

## Inhaltsverzeichnis

1. [Voraussetzungen](#1-voraussetzungen)
2. [API-Key einrichten](#2-api-key-einrichten)
3. [Architektur-Übersicht](#3-architektur-übersicht)
4. [Backend – Server-Proxy einrichten](#4-backend--server-proxy-einrichten)
5. [Frontend – Kontaktsuche](#5-frontend--kontaktsuche)
6. [Frontend – Rechnungen laden und anzeigen](#6-frontend--rechnungen-laden-und-anzeigen)
7. [Lexoffice API-Referenz](#7-lexoffice-api-referenz)
8. [Häufige Fehler](#8-häufige-fehler)

---

## 1. Voraussetzungen

- Node.js + Express als Backend
- React als Frontend
- Ein aktiver Lexoffice/Lexware Office Account
- Lexoffice Public API aktiviert (kostenpflichtig je nach Tarif)

---

## 2. API-Key einrichten

### API-Key in Lexoffice erstellen

1. In Lexoffice einloggen
2. Zu **Einstellungen → Public API** navigieren: `https://app.lexoffice.de/settings/#/public-api`
3. Neuen API-Key erstellen und kopieren

### API-Key als Umgebungsvariable speichern

In der `.env`-Datei des Projekts:

```env
LEXOFFICE_API_KEY=dein-api-key-hier
```

In Replit: Key unter **Secrets** als `LEXOFFICE_API_KEY` hinterlegen.

**Wichtig:** Der API-Key darf niemals im Frontend-Code auftauchen. Er wird ausschließlich serverseitig verwendet.

---

## 3. Architektur-Übersicht

```
Browser (React)
    │
    │  GET /api/lexoffice/contacts?name=...
    │  GET /api/lexoffice/invoices?contactId=...
    ▼
Express Server (Node.js)          ← API-Key liegt hier sicher
    │
    │  GET https://api.lexoffice.io/v1/contacts
    │  GET https://api.lexoffice.io/v1/voucherlist
    ▼
Lexoffice API
```

Der Express-Server fungiert als **Proxy**: Er nimmt Anfragen vom Browser entgegen, hängt den geheimen API-Key an und leitet sie an Lexoffice weiter. So sieht der Browser den Key nie.

---

## 4. Backend – Server-Proxy einrichten

### Endpunkt 1: Kontaktsuche

```typescript
// server/routes.ts

app.get("/api/lexoffice/contacts", async (req, res) => {
  const apiKey = process.env.LEXOFFICE_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: "Lexoffice API-Key nicht konfiguriert." });
  }

  // Query-Parameter weiterleiten
  const params = new URLSearchParams();
  if (req.query.name) params.set("name", req.query.name as string);
  if (req.query.page) params.set("page", req.query.page as string);
  if (req.query.size) params.set("size", req.query.size as string);

  try {
    const response = await fetch(
      `https://api.lexoffice.io/v1/contacts?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Lexoffice API Fehler: ${response.status}`,
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "Konnte Lexoffice nicht erreichen." });
  }
});
```

**Lexoffice API URL:** `GET https://api.lexoffice.io/v1/contacts`

**Wichtige Query-Parameter:**
| Parameter | Typ | Beschreibung |
|---|---|---|
| `name` | string | Suche nach Firmen- oder Personenname |
| `page` | integer | Seite (ab 0) |
| `size` | integer | Ergebnisse pro Seite (max. 100) |

---

### Endpunkt 2: Rechnungen eines Kontakts

```typescript
// server/routes.ts

app.get("/api/lexoffice/invoices", async (req, res) => {
  const apiKey = process.env.LEXOFFICE_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: "Lexoffice API-Key nicht konfiguriert." });
  }

  const contactId = req.query.contactId as string;
  if (!contactId) {
    return res.status(400).json({ error: "contactId ist erforderlich." });
  }

  const params = new URLSearchParams({
    voucherType: "invoice,salesinvoice,downpaymentinvoice",
    voucherStatus: "draft,open,paid,paidoff,voided,overdue",
    contactId,
    size: "25",
    sortDirection: "DESC",
    sortColumn: "voucherDate",
  });

  try {
    const response = await fetch(
      `https://api.lexoffice.io/v1/voucherlist?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Lexoffice API Fehler: ${response.status}`,
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "Konnte Lexoffice nicht erreichen." });
  }
});
```

**Lexoffice API URL:** `GET https://api.lexoffice.io/v1/voucherlist`

**Wichtige Query-Parameter:**
| Parameter | Typ | Beschreibung |
|---|---|---|
| `voucherType` | string (kommagetrennt) | `invoice`, `salesinvoice`, `downpaymentinvoice`, `creditnote`, `quotation` |
| `voucherStatus` | string (kommagetrennt) | `draft`, `open`, `paid`, `paidoff`, `voided`, `overdue` |
| `contactId` | UUID string | Filter nach Kontakt-ID |
| `size` | integer | Ergebnisse pro Seite (max. 100) |
| `sortDirection` | string | `ASC` oder `DESC` |
| `sortColumn` | string | z.B. `voucherDate`, `voucherNumber` |

---

## 5. Frontend – Kontaktsuche

### TypeScript-Interfaces

```typescript
interface LexofficeContact {
  id: string;          // UUID, wird für Rechnungssuche benötigt
  displayName: string; // Anzeigename (Firma oder Person)
  phone: string;
  address: string;
}
```

### Hilfsfunktion: Rohdaten aufbereiten

Die Lexoffice API gibt verschachtelte Objekte zurück. Diese Funktion extrahiert die wichtigsten Felder:

```typescript
function extractContacts(data: any): LexofficeContact[] {
  if (!data?.content) return [];
  return data.content.map((c: any) => {
    // Name: Firmenname bevorzugen, dann Personenname
    let displayName = "";
    if (c.company?.name) {
      displayName = c.company.name;
    } else if (c.person) {
      displayName = [c.person.firstName, c.person.lastName]
        .filter(Boolean)
        .join(" ");
    }

    // Telefon: business → mobile → office → private
    let phone = "";
    const pn = c.phoneNumbers;
    if (pn) {
      phone = pn.business?.[0] || pn.mobile?.[0] || pn.office?.[0] || pn.private?.[0] || "";
    }
    // Fallback: Ansprechpartner der Firma
    if (!phone && c.company?.contactPersons?.length) {
      phone = c.company.contactPersons[0].phoneNumber || "";
    }

    // Adresse: Lieferadresse bevorzugen, dann Rechnungsadresse
    let address = "";
    const addrs = c.addresses;
    if (addrs) {
      const src = addrs.shipping?.[0] || addrs.billing?.[0];
      if (src) {
        address = [src.street, src.zip, src.city].filter(Boolean).join(", ");
      }
    }

    return { id: c.id, displayName, phone, address };
  });
}
```

### React-Komponente: Suchfeld mit Dropdown

```typescript
// State-Variablen
const [lexQuery, setLexQuery] = useState("");
const [lexResults, setLexResults] = useState<LexofficeContact[]>([]);
const [lexLoading, setLexLoading] = useState(false);
const [lexDropdownOpen, setLexDropdownOpen] = useState(false);
const lexRef = useRef<HTMLDivElement>(null);
const debounceRef = useRef<ReturnType<typeof setTimeout>>();

// API-Aufruf mit Debounce (300ms Verzögerung)
const searchLexoffice = useCallback(async (query: string) => {
  if (query.length < 2) {
    setLexResults([]);
    setLexDropdownOpen(false);
    return;
  }

  setLexLoading(true);
  try {
    const res = await fetch(
      `/api/lexoffice/contacts?name=${encodeURIComponent(query)}&size=10`
    );
    if (res.ok) {
      const data = await res.json();
      const contacts = extractContacts(data);
      setLexResults(contacts);
      setLexDropdownOpen(contacts.length > 0);
    } else {
      setLexResults([]);
      setLexDropdownOpen(false);
    }
  } catch {
    setLexResults([]);
    setLexDropdownOpen(false);
  } finally {
    setLexLoading(false);
  }
}, []);

// Debounce: Suche erst 300ms nach letzter Eingabe starten
useEffect(() => {
  if (debounceRef.current) clearTimeout(debounceRef.current);
  if (lexQuery.length < 2) {
    setLexResults([]);
    setLexDropdownOpen(false);
    return;
  }
  debounceRef.current = setTimeout(() => searchLexoffice(lexQuery), 300);
  return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
}, [lexQuery, searchLexoffice]);

// Dropdown schließen bei Klick außerhalb
useEffect(() => {
  function handleClickOutside(e: MouseEvent) {
    if (lexRef.current && !lexRef.current.contains(e.target as Node)) {
      setLexDropdownOpen(false);
    }
  }
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);

// Kontakt auswählen → Felder befüllen
const selectContact = (contact: LexofficeContact) => {
  setName(contact.displayName);
  setPhone(contact.phone);
  setAddress(contact.address);
  setLexQuery("");
  setLexDropdownOpen(false);
  setLexResults([]);
  fetchInvoices(contact.id); // Rechnungen laden (siehe Abschnitt 6)
};
```

### JSX: Suchfeld mit Dropdown

```tsx
<div ref={lexRef} className="relative">
  <label>Lexoffice Kontaktsuche</label>
  <div className="relative">
    <input
      value={lexQuery}
      onChange={(e) => setLexQuery(e.target.value)}
      placeholder="Kundenname suchen..."
    />
    {lexLoading && <span>Lädt...</span>}
  </div>

  {lexDropdownOpen && lexResults.length > 0 && (
    <div className="absolute z-50 w-full mt-1 bg-white border rounded shadow max-h-48 overflow-y-auto">
      {lexResults.map((contact) => (
        <button
          key={contact.id}
          type="button"
          onClick={() => selectContact(contact)}
          className="w-full text-left px-3 py-2 hover:bg-gray-100"
        >
          <div className="font-medium">{contact.displayName}</div>
          {contact.address && (
            <div className="text-sm text-gray-500">{contact.address}</div>
          )}
        </button>
      ))}
    </div>
  )}
</div>
```

---

## 6. Frontend – Rechnungen laden und anzeigen

### TypeScript-Interface

```typescript
interface LexofficeInvoice {
  id: string;
  voucherNumber: string;   // z.B. "RE-1234"
  voucherDate: string;     // ISO-Datumsstring
  totalAmount: number;     // Bruttobetrag in EUR
  voucherStatus: string;   // "open", "paid", "draft", "voided", "overdue"
  voucherType: string;     // "invoice", "salesinvoice", etc.
}
```

### Rechnungen abrufen

```typescript
const [invoices, setInvoices] = useState<LexofficeInvoice[]>([]);
const [invoicesLoading, setInvoicesLoading] = useState(false);

const fetchInvoices = useCallback(async (contactId: string) => {
  setInvoicesLoading(true);
  try {
    const res = await fetch(
      `/api/lexoffice/invoices?contactId=${encodeURIComponent(contactId)}`
    );
    if (res.ok) {
      const data = await res.json();
      setInvoices(data.content || []);
    } else {
      setInvoices([]);
    }
  } catch {
    setInvoices([]);
  } finally {
    setInvoicesLoading(false);
  }
}, []);
```

### JSX: Rechnungsliste

```tsx
{invoicesLoading && <p>Rechnungen werden geladen...</p>}

{!invoicesLoading && invoices.length > 0 && (
  <div className="border rounded p-3">
    <h3>Rechnungen ({invoices.length})</h3>
    <div className="max-h-36 overflow-y-auto">
      {invoices.map((inv) => {
        const date = inv.voucherDate
          ? new Date(inv.voucherDate).toLocaleDateString("de-DE")
          : "";

        // Status-Badge Farben
        const statusLabels: Record<string, string> = {
          draft: "Entwurf",
          open: "Offen",
          paid: "Bezahlt",
          paidoff: "Bezahlt",
          voided: "Storniert",
          overdue: "Überfällig",
        };

        return (
          <a
            key={inv.id}
            // Direktlink zu Lexoffice → öffnet Rechnung zum Drucken
            href={`https://app.lexoffice.de/permalink/invoices/view/${inv.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between py-2 hover:bg-gray-100"
          >
            <span>{inv.voucherNumber || "—"}</span>
            <span>{date}</span>
            <span>{inv.totalAmount?.toFixed(2)} €</span>
            <span>{statusLabels[inv.voucherStatus] || inv.voucherStatus}</span>
          </a>
        );
      })}
    </div>
  </div>
)}
```

**Lexoffice Permalink-Schema:**
```
https://app.lexoffice.de/permalink/invoices/view/{INVOICE_ID}
```
Dieser Link öffnet die Rechnung direkt in Lexoffice. Von dort aus kann sie gedruckt oder als PDF heruntergeladen werden.

---

## 7. Lexoffice API-Referenz

### Authentifizierung
Alle Anfragen benötigen den API-Key im `Authorization`-Header:
```
Authorization: Bearer DEIN_API_KEY
```

### Wichtige Endpunkte

| Endpunkt | Methode | Beschreibung |
|---|---|---|
| `/v1/contacts` | GET | Kontakte suchen |
| `/v1/voucherlist` | GET | Rechnungen / Belege abrufen |
| `/v1/invoices/{id}` | GET | Einzelne Rechnung abrufen |
| `/v1/invoices/{id}/document` | GET | PDF-Dokument einer Rechnung |

### Rate Limit
Die Lexoffice API erlaubt **2 Anfragen pro Sekunde**. Bei mehr Anfragen wird HTTP `429` zurückgegeben. Deshalb ist das **Debouncing** im Suchfeld (300ms Verzögerung) wichtig.

### Offizielle Dokumentation
`https://developers.lexoffice.io/docs/`

---

## 8. Häufige Fehler

### HTTP 401 – Unauthorized
→ API-Key fehlt oder ist falsch. Prüfe die Umgebungsvariable `LEXOFFICE_API_KEY`.

### HTTP 429 – Too Many Requests
→ Rate Limit überschritten. Debounce im Frontend einbauen (min. 300ms).

### Leere Suchergebnisse
→ Lexoffice sucht exakt nach dem Namen. Leerzeichen und Sonderzeichen werden berücksichtigt. Mindestens 2 Zeichen eingeben.

### Keine Telefonnummer
→ Nicht alle Kontakte haben Telefonnummern hinterlegt. Der Code prüft mehrere Felder (`business`, `mobile`, `office`, `private`) und greift auf Ansprechpartner zurück.

### API-Key nicht in Produktion verfügbar
→ Sicherstellen, dass `LEXOFFICE_API_KEY` als Umgebungsvariable auf dem Produktiv-Server gesetzt ist (in Replit unter **Secrets**, bei anderen Hostern als Umgebungsvariable im Deployment-Panel).

---

*Erstellt im Rahmen des AutoPlan-Projekts – [OpenKairo](https://openkairo.de/)*
