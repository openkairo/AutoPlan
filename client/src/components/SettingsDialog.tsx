import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/use-deliveries";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, MapPin, Brain, Loader2, CheckCircle2, XCircle, ScanLine, RotateCcw, Cpu, BookUser, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddressAutocomplete } from "./AddressAutocomplete";
import {
  SETTINGS_CATEGORIES,
  SETTINGS_FIELDS,
  getFieldsByCategory,
  loadKeysStatus,
  type SettingField,
  type SettingsValues,
  type KeysStatus,
} from "@/lib/settings-config";

const ICONS: Record<string, typeof Settings> = { MapPin, Brain, ScanLine, Cpu, BookUser, Settings };

function FieldIcon({ name }: { name?: string }) {
  if (!name) return null;
  const Icon = ICONS[name];
  if (!Icon) return null;
  return <Icon className="h-3 w-3" />;
}

function SettingFieldRenderer({
  field,
  value,
  onChange,
  dynamicModels,
  modelsLoading,
}: {
  field: SettingField;
  value: string;
  onChange: (val: string) => void;
  dynamicModels?: string[] | null;
  modelsLoading?: boolean;
}) {
  switch (field.type) {
    case "text":
      return (
        <Input
          id={field.key}
          data-testid={`input-${field.key}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="font-mono text-xs"
        />
      );

    case "select": {
      const useDynamic = field.key === "aiModel" && dynamicModels && dynamicModels.length > 0;
      const options = useDynamic
        ? dynamicModels.map((m) => ({ value: m, label: m }))
        : (field.options || []);

      return (
        <div className="grid gap-1">
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger data-testid={`select-${field.key}`} className="font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.key === "aiModel" && modelsLoading && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Modelle werden geladen...
            </p>
          )}
        </div>
      );
    }

    case "textarea":
      return (
        <div className="grid gap-1">
          <Textarea
            id={field.key}
            data-testid={`input-${field.key}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="font-mono text-xs min-h-[120px] resize-y"
            rows={field.rows || 4}
          />
          {field.showReset && value !== field.defaultValue && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(field.defaultValue)}
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Zurücksetzen
              </Button>
            </div>
          )}
        </div>
      );

    case "address":
      return window.google?.maps ? (
        <AddressAutocomplete
          id={field.key}
          data-testid={`input-${field.key}`}
          value={value}
          onChange={(addr) => onChange(addr)}
          placeholder={field.placeholder}
        />
      ) : (
        <Input
          id={field.key}
          data-testid={`input-${field.key}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      );

    default:
      return null;
  }
}

function KeyStatusBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="inline-flex items-center gap-1 text-xs text-green-500">
      <CheckCircle2 className="h-3 w-3" />
      Konfiguriert
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-red-400">
      <XCircle className="h-3 w-3" />
      Nicht konfiguriert
    </span>
  );
}

const API_KEYS_INFO = [
  { label: "Google Maps", key: "googleMaps" as const, icon: "MapPin", description: "Karten, Geocoding und Routenplanung", link: "https://console.cloud.google.com/apis/credentials" },
  { label: "OpenAI", key: "openai" as const, icon: "Brain", description: "Dokumenten-Scan per Foto", link: "https://platform.openai.com/api-keys" },
  { label: "Lexoffice", key: "lexoffice" as const, icon: "BookUser", description: "Kontaktsuche nach Name", link: "https://app.lexoffice.de/settings/#/public-api" },
];

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const { getSettings, saveSettings, isLoading, isSaving } = useSettings();
  const [values, setValues] = useState<SettingsValues>({});
  const [keysStatus, setKeysStatus] = useState<KeysStatus | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [dynamicModels, setDynamicModels] = useState<string[] | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !initialized) {
      const settings = getSettings();
      setValues(settings);
      setInitialized(true);
    }
  }, [isLoading, initialized, getSettings]);

  useEffect(() => {
    loadKeysStatus().then((status) => {
      setKeysStatus(status);
      if (status.openai) {
        setModelsLoading(true);
        fetch("/api/openai/models")
          .then((res) => res.json())
          .then((data) => {
            if (data.models && data.models.length > 0) {
              setDynamicModels(data.models);
            }
          })
          .catch(() => {})
          .finally(() => setModelsLoading(false));
      }
    });
  }, []);

  const updateValue = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    try {
      await saveSettings(values);
      setOpen(false);
      toast({
        title: "Einstellungen gespeichert",
        description: "Deine Einstellungen wurden aktualisiert.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Fehler",
        description: "Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} data-testid="button-settings" className="rounded-full">
        <Settings className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-card border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Einstellungen
            </DialogTitle>
            <DialogDescription>
              Konfiguriere deine Einstellungen.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {(() => {
              const routeFields = getFieldsByCategory("route");
              if (routeFields.length === 0) return null;
              return (
                <div className="rounded-lg border border-border bg-muted/30 p-4 grid gap-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Routenplanung
                  </h3>
                  {routeFields.map((field) => (
                    <div key={field.key} className="grid gap-2">
                      <Label htmlFor={field.key} className="text-foreground flex items-center gap-2">
                        <FieldIcon name={field.icon} />
                        {field.label}
                      </Label>
                      <SettingFieldRenderer
                        field={field}
                        value={values[field.key] || ""}
                        onChange={(val) => updateValue(field.key, val)}
                        dynamicModels={dynamicModels}
                        modelsLoading={modelsLoading}
                      />
                      {field.description && (
                        <p className="text-[10px] text-muted-foreground">{field.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="rounded-lg border border-border bg-muted/30 p-4 grid gap-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                API-Verbindungen
              </h3>
              <p className="text-[10px] text-muted-foreground -mt-1">
                API-Keys werden sicher als Umgebungsvariablen auf dem Server gespeichert.
              </p>
              <div className="grid gap-1 divide-y divide-border/50">
                {API_KEYS_INFO.map((info) => (
                  <div key={info.key} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <FieldIcon name={info.icon} />
                      <div>
                        <span className="text-sm text-foreground">{info.label}</span>
                        <p className="text-[10px] text-muted-foreground">
                          {info.description}
                          {" · "}
                          <a href={info.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                            Key erstellen
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </p>
                      </div>
                    </div>
                    {keysStatus ? (
                      <KeyStatusBadge configured={keysStatus[info.key]} />
                    ) : (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {SETTINGS_CATEGORIES.filter((c) => c.id !== "route").map((category) => {
              const fields = getFieldsByCategory(category.id);
              if (fields.length === 0) return null;
              return (
                <div key={category.id} className="rounded-lg border border-border bg-muted/30 p-4 grid gap-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {category.label}
                  </h3>
                  {fields.map((field) => (
                    <div key={field.key} className="grid gap-2">
                      <Label htmlFor={field.key} className="text-foreground flex items-center gap-2">
                        <FieldIcon name={field.icon} />
                        {field.label}
                      </Label>
                      <SettingFieldRenderer
                        field={field}
                        value={values[field.key] || ""}
                        onChange={(val) => updateValue(field.key, val)}
                        dynamicModels={dynamicModels}
                        modelsLoading={modelsLoading}
                      />
                      {field.description && (
                        <p className="text-[10px] text-muted-foreground">{field.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button data-testid="button-save-settings" onClick={handleSave} disabled={isSaving} className="w-full bg-primary text-primary-foreground">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
