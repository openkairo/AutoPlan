import { useState, useCallback, useEffect } from "react";
import type { Stop, InsertStop } from "@shared/schema";
import {
  loadSettingsAsync,
  saveSettingsToServer,
  getCachedSettings,
  invalidateSettingsCache,
  type SettingsValues,
} from "@/lib/settings-config";

export type { Stop };

const STOPS_KEY = "delivery_stops";

function readStops(): Stop[] {
  try {
    const raw = localStorage.getItem(STOPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStops(stops: Stop[]) {
  localStorage.setItem(STOPS_KEY, JSON.stringify(stops));
  window.dispatchEvent(new CustomEvent("stops-updated"));
}

function getNextId(): number {
  const current = readStops();
  return current.length > 0 ? Math.max(...current.map((s) => s.id)) + 1 : 1;
}

export function useStops() {
  const [stops, setStops] = useState<Stop[]>(readStops);

  useEffect(() => {
    const handler = () => setStops(readStops());
    window.addEventListener("stops-updated", handler);
    return () => window.removeEventListener("stops-updated", handler);
  }, []);

  const createStop = useCallback(async (data: InsertStop) => {
    const current = readStops();
    const newStop: Stop = {
      ...data,
      id: getNextId(),
      sortOrder: current.length,
    };
    writeStops([...current, newStop]);
    return newStop;
  }, []);

  const updateStop = useCallback(async ({ id, data }: { id: number; data: Partial<Stop> }) => {
    const current = readStops();
    const updated = current.map((s) => (s.id === id ? { ...s, ...data } : s));
    writeStops(updated);
    return updated.find((s) => s.id === id);
  }, []);

  const deleteStop = useCallback(async (id: number) => {
    const current = readStops();
    writeStops(current.filter((s) => s.id !== id));
  }, []);

  const reorderStops = useCallback(async (ids: number[]) => {
    const current = readStops();
    const idSet = new Set(ids);
    const reordered = ids
      .map((id, idx) => {
        const stop = current.find((s) => s.id === id);
        return stop ? { ...stop, sortOrder: idx } : null;
      })
      .filter(Boolean) as Stop[];
    const missing = current
      .filter((s) => !idSet.has(s.id))
      .map((s, idx) => ({ ...s, sortOrder: reordered.length + idx }));
    const all = [...reordered, ...missing];
    writeStops(all);
    return all;
  }, []);

  return {
    stops,
    isLoading: false,
    createStop,
    updateStop,
    deleteStop,
    reorderStops,
  };
}

export function useSettings() {
  const [settings, setSettings] = useState<SettingsValues>(getCachedSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettingsAsync().then((s) => {
      setSettings(s);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    const handler = () => {
      setSettings(getCachedSettings());
    };
    window.addEventListener("settings-updated", handler);
    return () => window.removeEventListener("settings-updated", handler);
  }, []);

  const getSettings = useCallback((): SettingsValues => {
    return settings;
  }, [settings]);

  const saveSettings = useCallback(async (newSettings: SettingsValues) => {
    setIsSaving(true);
    try {
      await saveSettingsToServer(newSettings);
      setSettings(newSettings);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    invalidateSettingsCache();
    setIsLoading(true);
    const s = await loadSettingsAsync();
    setSettings(s);
    setIsLoading(false);
  }, []);

  return {
    getSettings,
    saveSettings,
    refreshSettings,
    isLoading,
    isSaving,
  };
}
