import type { Express } from "express";
import type { Server } from "http";
import fs from "fs";
import path from "path";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

function ensureDataDir() {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const ALLOWED_SETTINGS_KEYS = new Set([
  "ai_model",
  "scan_prompt",
  "start_address",
]);

function readSettings(): Record<string, string> {
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function filterSettings(settings: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const key of Object.keys(settings)) {
    if (ALLOWED_SETTINGS_KEYS.has(key)) {
      filtered[key] = settings[key];
    }
  }
  return filtered;
}

function writeSettings(settings: Record<string, string>) {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/settings", (_req, res) => {
    const settings = readSettings();
    res.json(filterSettings(settings));
  });

  app.post("/api/settings", (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Ungültige Daten" });
    }
    const safeBody = filterSettings(body);
    const existing = readSettings();
    const merged = { ...filterSettings(existing), ...safeBody };
    writeSettings(merged);
    res.json({ ok: true });
  });

  app.get("/api/keys-status", (_req, res) => {
    res.json({
      googleMaps: !!process.env.GOOGLE_MAPS_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      lexoffice: !!process.env.LEXOFFICE_API_KEY,
    });
  });

  app.get("/api/maps-key", (_req, res) => {
    const key = process.env.GOOGLE_MAPS_API_KEY || "";
    if (!key) {
      return res.status(404).json({ error: "Google Maps API-Key nicht konfiguriert." });
    }
    res.json({ key });
  });

  app.get("/api/static-map", async (req, res) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      return res.status(404).json({ error: "Google Maps API-Key nicht konfiguriert." });
    }
    const rawQuery = req.url.split("?")[1] || "";
    const url = `https://maps.googleapis.com/maps/api/staticmap?${rawQuery}&key=${encodeURIComponent(key)}`;
    try {
      const response = await fetch(url);
      const contentType = response.headers.get("content-type") || "image/png";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=300");
      const buffer = await response.arrayBuffer();
      if (!response.ok) {
        console.error(`[static-map] Google API error ${response.status}: ${Buffer.from(buffer).toString("utf8").slice(0, 200)}`);
        return res.status(502).send(Buffer.from(buffer));
      }
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("[static-map] fetch failed:", err);
      res.status(500).json({ error: "Kartenabruf fehlgeschlagen." });
    }
  });

  app.post("/api/scan-document", async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "OpenAI API-Key nicht konfiguriert." });
    }

    const { imageBase64, prompt, model } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Kein Bild übermittelt." });
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || "gpt-4o",
          messages: [
            {
              role: "system",
              content: prompt || "Extract document data as JSON.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analysiere dieses Dokument. Extrahiere Name, Adresse und Telefonnummer des EMPFAENGERS (Kunde/Kaeufer). NICHT den Absender/Verkaeufer aus der Kopfzeile nehmen!",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageBase64.startsWith("data:")
                      ? imageBase64
                      : `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 300,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.status(response.status).json({
          error: err.error?.message || `OpenAI API Fehler (${response.status})`,
        });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();

      if (!content) {
        return res.status(500).json({ error: "Keine Antwort von OpenAI erhalten." });
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(500).json({ error: "Konnte keine Daten aus dem Dokument lesen." });
      }

      const parsed = JSON.parse(jsonMatch[0]);
      res.json({
        name: parsed.name || null,
        address: parsed.address || null,
        phone: parsed.phone || null,
      });
    } catch (err) {
      console.error("Scan error:", err);
      res.status(502).json({ error: "Konnte OpenAI nicht erreichen." });
    }
  });

  app.get("/api/openai/models", async (_req, res) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "OpenAI API-Key nicht konfiguriert." });
    }

    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: `OpenAI API Fehler (${response.status})` });
      }

      const data = await response.json();
      const chatModels = (data.data || [])
        .filter((m: any) => m.id.startsWith("gpt-"))
        .map((m: any) => m.id)
        .sort();

      res.json({ models: chatModels });
    } catch {
      res.status(502).json({ error: "Konnte OpenAI nicht erreichen." });
    }
  });

  app.get("/api/lexoffice/contacts", async (req, res) => {
    const apiKey = process.env.LEXOFFICE_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "Lexoffice API-Key nicht konfiguriert." });
    }

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

  return httpServer;
}
