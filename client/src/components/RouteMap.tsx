import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import { useSettings } from "@/hooks/use-deliveries";
import type { Stop } from "@shared/schema";

interface RouteMapProps {
  stops: Stop[];
}

export function RouteMap({ stops }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  
  const { isLoaded, error } = useGoogleMaps();
  const { getSettings } = useSettings();
  const [directionsError, setDirectionsError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && mapRef.current && !googleMapRef.current) {
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        center: { lat: 51.1657, lng: 10.4515 },
        zoom: 6,
        styles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            {
              featureType: "administrative.locality",
              elementType: "labels.text.fill",
              stylers: [{ color: "#d59563" }],
            },
            {
              featureType: "poi",
              elementType: "labels.text.fill",
              stylers: [{ color: "#d59563" }],
            },
            {
              featureType: "poi.park",
              elementType: "geometry",
              stylers: [{ color: "#263c3f" }],
            },
            {
              featureType: "poi.park",
              elementType: "labels.text.fill",
              stylers: [{ color: "#6b9a76" }],
            },
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#38414e" }],
            },
            {
              featureType: "road",
              elementType: "geometry.stroke",
              stylers: [{ color: "#212a37" }],
            },
            {
              featureType: "road",
              elementType: "labels.text.fill",
              stylers: [{ color: "#9ca5b3" }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry",
              stylers: [{ color: "#746855" }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry.stroke",
              stylers: [{ color: "#1f2835" }],
            },
            {
              featureType: "road.highway",
              elementType: "labels.text.fill",
              stylers: [{ color: "#f3d19c" }],
            },
            {
              featureType: "transit",
              elementType: "geometry",
              stylers: [{ color: "#2f3948" }],
            },
            {
              featureType: "transit.station",
              elementType: "labels.text.fill",
              stylers: [{ color: "#d59563" }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#17263c" }],
            },
            {
              featureType: "water",
              elementType: "labels.text.fill",
              stylers: [{ color: "#515c6d" }],
            },
            {
              featureType: "water",
              elementType: "labels.text.stroke",
              stylers: [{ color: "#17263c" }],
            },
        ],
        disableDefaultUI: true,
        zoomControl: true,
      });

      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map: googleMapRef.current,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: "#22c55e",
          strokeWeight: 5,
        }
      });
    }
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded || !googleMapRef.current) return;

    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    directionsRendererRef.current?.setDirections({ routes: [] } as any);
    setDirectionsError(null);

    if (stops.length === 0) return;

    const { startAddress } = getSettings();
    const hasStartAddress = !!startAddress;

    if (stops.length >= 2 || (hasStartAddress && stops.length > 0)) {
      const directionsService = new google.maps.DirectionsService();

      let origin: string;
      let destination: string;
      let routeWaypoints: google.maps.DirectionsWaypoint[];
      if (hasStartAddress) {
        origin = startAddress;
        destination = startAddress;
        routeWaypoints = stops.map(stop => ({
          location: stop.address,
          stopover: true
        }));
      } else {
        origin = stops[0].address;
        destination = stops[stops.length - 1].address;
        routeWaypoints = stops.slice(1, -1).map(stop => ({
          location: stop.address,
          stopover: true
        }));
      }

      directionsService.route({
        origin,
        destination,
        waypoints: routeWaypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      }, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          directionsRendererRef.current?.setDirections(result);

          const route = result.routes[0];
          const legs = route.legs;

          if (hasStartAddress) {
            const startMarker = new google.maps.Marker({
              position: legs[0].start_location,
              map: googleMapRef.current,
              label: { text: "A", color: "white", fontWeight: "bold" },
              title: "Start: " + startAddress,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 14,
                fillColor: "#22c55e",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              },
            });
            markersRef.current.push(startMarker);

            for (let i = 0; i < legs.length - 1; i++) {
              const marker = new google.maps.Marker({
                position: legs[i].end_location,
                map: googleMapRef.current,
                label: { text: (i + 1).toString(), color: "white", fontWeight: "bold" },
                title: stops[i]?.name ?? `Stopp ${i + 1}`,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 12,
                  fillColor: "#ef4444",
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                },
              });
              markersRef.current.push(marker);
            }
          } else {
            for (let i = 0; i < legs.length; i++) {
              const marker = new google.maps.Marker({
                position: legs[i].start_location,
                map: googleMapRef.current,
                label: { text: (i + 1).toString(), color: "white", fontWeight: "bold" },
                title: stops[i]?.name ?? `Stopp ${i + 1}`,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 12,
                  fillColor: "#ef4444",
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                },
              });
              markersRef.current.push(marker);
            }
            const lastMarker = new google.maps.Marker({
              position: legs[legs.length - 1].end_location,
              map: googleMapRef.current,
              label: { text: stops.length.toString(), color: "white", fontWeight: "bold" },
              title: stops[stops.length - 1]?.name ?? `Stopp ${stops.length}`,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: "#ef4444",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              },
            });
            markersRef.current.push(lastMarker);
          }
        } else {
          console.error("Routenanfrage fehlgeschlagen: " + status);
          setDirectionsError("Route konnte nicht berechnet werden.");
          fitBoundsToMarkers();
        }
      });
    } else if (stops.length === 1) {
      fitBoundsToMarkers();
    } else {
       fitBoundsToMarkers();
    }

    function fitBoundsToMarkers() {
        const bounds = new google.maps.LatLngBounds();

        stops.forEach((stop, i) => {
            if (stop.lat && stop.lng) {
                const pos = { lat: stop.lat, lng: stop.lng };
                const marker = new google.maps.Marker({
                    position: pos,
                    map: googleMapRef.current,
                    label: { text: (i + 1).toString(), color: "white", fontWeight: "bold" },
                    title: stop.name
                });
                markersRef.current.push(marker);
                bounds.extend(pos);
            }
        });

        if (!bounds.isEmpty()) {
            googleMapRef.current?.fitBounds(bounds);
        }
    }

  }, [isLoaded, stops]);

  if (error) {
    return (
      <div className="w-full min-h-[400px] h-[500px] bg-muted/20 flex flex-col items-center justify-center text-muted-foreground rounded-xl border border-border">
        <AlertCircle className="h-8 w-8 mb-2 text-destructive" />
        <p>Kartenfehler: {error}</p>
        <p className="text-sm mt-1">Bitte API-Key in den Einstellungen prüfen.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full min-h-[400px] h-[500px] bg-muted/20 flex flex-col items-center justify-center text-muted-foreground rounded-xl border border-border animate-pulse">
        <Loader2 className="h-8 w-8 animate-spin mb-2 text-primary" />
        <p>Karte wird geladen...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-[400px] h-[500px] rounded-xl overflow-hidden border border-border shadow-2xl">
      <div ref={mapRef} className="w-full h-full" />
      {directionsError && (
        <div className="absolute top-4 left-4 bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-md text-sm shadow-lg backdrop-blur-sm">
          {directionsError}
        </div>
      )}
    </div>
  );
}
