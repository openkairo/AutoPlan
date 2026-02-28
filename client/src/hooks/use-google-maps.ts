import { useState, useEffect } from "react";

export function useGoogleMaps() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/maps-key")
      .then((res) => {
        if (!res.ok) throw new Error("No API key");
        return res.json();
      })
      .then(({ key }) => {
        if (cancelled) return;

        if (!key) {
          setError("API Key missing");
          return;
        }

        if (window.google?.maps) {
          setIsLoaded(true);
          return;
        }

        const scriptId = "google-maps-script";
        if (document.getElementById(scriptId)) {
          const script = document.getElementById(scriptId) as HTMLScriptElement;
          script.addEventListener("load", () => setIsLoaded(true));
          script.addEventListener("error", () => setError("Failed to load Maps SDK"));
          return;
        }

        const script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          if (!cancelled) setIsLoaded(true);
        };
        script.onerror = () => {
          if (!cancelled) setError("Failed to load Google Maps script");
        };

        document.body.appendChild(script);
      })
      .catch(() => {
        if (!cancelled) setError("API Key missing");
      });

    return () => { cancelled = true; };
  }, []);

  return { isLoaded, error };
}
