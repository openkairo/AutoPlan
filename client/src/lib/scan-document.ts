interface ScanResult {
  name?: string;
  address?: string;
  phone?: string;
}

export const DEFAULT_SCAN_PROMPT = `Du analysierst Rechnungen und Lieferscheine. Extrahiere die Daten des EMPFÄNGERS (Käufer/Kunde), NIEMALS die des Absenders (Verkäufer/Firma).

So erkennst du den Unterschied:
- ABSENDER (IGNORIEREN): Steht in der obersten Zeile/Kopfzeile, oft als "Firma - Straße - PLZ Ort" in einer Zeile. Steht auch unten bei Bankverbindung/Kontaktinformationen. Das ist der Rechnungssteller.
- EMPFÄNGER (EXTRAHIEREN): Steht im Adressfeld darunter, typischerweise links, mehrzeilig mit Name, Straße, PLZ und Ort auf separaten Zeilen. Das ist der Kunde, an den geliefert wird.

WICHTIG: Der Name in der Kopfzeile/ersten Zeile ist IMMER der Absender. Der Empfänger steht DARUNTER im Adressblock.

Antworte NUR mit JSON:
{"name": "Empfängername", "address": "Straße Hausnummer, PLZ Ort", "phone": "+49..."}
Felder die nicht gefunden werden auf null setzen. Keine Erklärungen.`;

export async function scanDocument(imageBase64: string, customPrompt?: string, model?: string): Promise<ScanResult> {
  const response = await fetch("/api/scan-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64,
      prompt: customPrompt || DEFAULT_SCAN_PROMPT,
      model: model || "gpt-4o",
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Scan-Fehler (${response.status})`);
  }

  const data = await response.json();
  return {
    name: data.name || undefined,
    address: data.address || undefined,
    phone: data.phone || undefined,
  };
}
