import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

declare global {
  interface Window {
    google?: typeof google;
  }
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
  "data-testid"?: string;
}

interface Suggestion {
  placeId: string;
  description: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Straße, Stadt, PLZ",
  id,
  required,
  "data-testid": dataTestId,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const getGeocoder = useCallback(() => {
    if (!geocoderRef.current && window.google?.maps) {
      geocoderRef.current = new google.maps.Geocoder();
    }
    return geocoderRef.current;
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const searchAddress = useCallback(async (text: string) => {
    if (!text.trim() || !window.google?.maps) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      const geocoder = getGeocoder();
      if (!geocoder) {
        setIsSearching(false);
        return;
      }

      geocoder.geocode({ address: text }, (results, status) => {
        setIsSearching(false);
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          const mapped = results.slice(0, 5).map((r) => ({
            placeId: r.place_id,
            description: r.formatted_address,
          }));
          setSuggestions(mapped);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      });
    } catch {
      setIsSearching(false);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [getGeocoder]);

  const handleInputChange = (text: string) => {
    setInputValue(text);
    onChange(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      searchAddress(text);
    }, 300);
  };

  const handleSelect = (suggestion: Suggestion) => {
    setInputValue(suggestion.description);
    setShowSuggestions(false);

    const geocoder = getGeocoder();
    if (geocoder) {
      geocoder.geocode({ placeId: suggestion.placeId }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
          const location = results[0].geometry.location;
          onChange(suggestion.description, location.lat(), location.lng());
        } else {
          onChange(suggestion.description);
        }
      });
    } else {
      onChange(suggestion.description);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          data-testid={dataTestId}
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
        />
        {isSearching && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul
          data-testid="address-suggestions"
          className="absolute z-[9999] mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-auto"
        >
          {suggestions.map((s) => (
            <li
              key={s.placeId}
              data-testid={`suggestion-${s.placeId}`}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent text-popover-foreground"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
            >
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{s.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
