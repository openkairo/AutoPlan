import { DEFAULT_SCAN_PROMPT } from "./scan-document";

export type SettingType = "text" | "password" | "select" | "textarea" | "address";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SettingField {
  key: string;
  storageKey: string;
  label: string;
  type: SettingType;
  category: string;
  icon?: string;
  placeholder?: string;
  description?: string;
  defaultValue: string;
  required?: boolean;
  options?: SelectOption[];
  reloadOnChange?: boolean;
  rows?: number;
  showReset?: boolean;
}

export const SETTINGS_CATEGORIES = [
  { id: "route", label: "Routenplanung" },
  { id: "scan", label: "Dokumenten-Scan" },
] as const;

export const SETTINGS_FIELDS: SettingField[] = [
  {
    key: "aiModel",
    storageKey: "ai_model",
    label: "KI-Modell",
    type: "select",
    category: "scan",
    icon: "Cpu",
    description: "Modell für das Scannen von Dokumenten. Größere Modelle erkennen besser.",
    defaultValue: "gpt-4o",
    options: [
      { value: "gpt-4o", label: "gpt-4o (empfohlen)" },
      { value: "gpt-4o-mini", label: "gpt-4o-mini (günstiger)" },
      { value: "gpt-4.1", label: "gpt-4.1" },
      { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
      { value: "gpt-4.1-nano", label: "gpt-4.1-nano (am günstigsten)" },
    ],
  },
  {
    key: "scanPrompt",
    storageKey: "scan_prompt",
    label: "Scan-Prompt (KI-Anweisung)",
    type: "textarea",
    category: "scan",
    icon: "ScanLine",
    description: "Antwort muss JSON sein: {\"name\":\"...\",\"address\":\"...\",\"phone\":\"...\"}",
    defaultValue: DEFAULT_SCAN_PROMPT,
    rows: 6,
    showReset: true,
  },
  {
    key: "startAddress",
    storageKey: "start_address",
    label: "Standard-Startadresse",
    type: "address",
    category: "route",
    icon: "MapPin",
    placeholder: "Musterstraße 1, 10115 Berlin",
    defaultValue: "",
  },
];

export type SettingsValues = Record<string, string>;

export interface KeysStatus {
  googleMaps: boolean;
  openai: boolean;
  lexoffice: boolean;
}

let _settingsCache: SettingsValues | null = null;
let _settingsLoading: Promise<SettingsValues> | null = null;
let _keysStatusCache: KeysStatus | null = null;

function applyDefaults(serverData: Record<string, string>): SettingsValues {
  const values: SettingsValues = {};
  for (const field of SETTINGS_FIELDS) {
    values[field.key] = serverData[field.storageKey] ?? field.defaultValue;
  }
  return values;
}

export async function loadSettingsAsync(): Promise<SettingsValues> {
  if (_settingsCache) return _settingsCache;
  if (_settingsLoading) return _settingsLoading;

  _settingsLoading = fetch("/api/settings")
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      _settingsCache = applyDefaults(data);
      _settingsLoading = null;
      return _settingsCache;
    })
    .catch(() => {
      _settingsCache = applyDefaults({});
      _settingsLoading = null;
      return _settingsCache;
    });

  return _settingsLoading;
}

export async function loadKeysStatus(): Promise<KeysStatus> {
  if (_keysStatusCache) return _keysStatusCache;
  try {
    const res = await fetch("/api/keys-status");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _keysStatusCache = await res.json();
    return _keysStatusCache!;
  } catch {
    return { googleMaps: false, openai: false, lexoffice: false };
  }
}

export async function saveSettingsToServer(values: SettingsValues): Promise<void> {
  const payload: Record<string, string> = {};
  for (const field of SETTINGS_FIELDS) {
    if (values[field.key] !== undefined) {
      payload[field.storageKey] = values[field.key];
    }
  }
  await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  _settingsCache = { ...values };
  window.dispatchEvent(new CustomEvent("settings-updated"));
}

export function getCachedSettings(): SettingsValues {
  if (_settingsCache) return _settingsCache;
  return applyDefaults({});
}

export function getCachedSetting(key: string): string {
  const cached = getCachedSettings();
  return cached[key] ?? "";
}

export function getCachedKeysStatus(): KeysStatus {
  return _keysStatusCache || { googleMaps: false, openai: false, lexoffice: false };
}

export function invalidateSettingsCache() {
  _settingsCache = null;
  _settingsLoading = null;
}

export function getFieldsByCategory(categoryId: string): SettingField[] {
  return SETTINGS_FIELDS.filter((f) => f.category === categoryId);
}
