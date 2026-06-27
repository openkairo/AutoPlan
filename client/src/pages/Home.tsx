import { useState, useEffect, useRef, useCallback } from "react";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent 
} from "@dnd-kit/core";
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from "@dnd-kit/sortable";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import QRCode from "qrcode";
import { Calendar as CalendarIcon, RotateCw, Navigation, MessageCircle, Truck, Loader2, Route, Clock, MapPin, Send, Copy, Check, Printer } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { useStops, useSettings } from "@/hooks/use-deliveries";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import { AddStopDialog } from "@/components/AddStopDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { StopCard } from "@/components/StopCard";
import { DeliveryCalendar } from "@/components/DeliveryCalendar";
import { RouteMap } from "@/components/RouteMap";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Stop } from "@shared/schema";

interface RouteInfo {
  totalDistanceKm: number;
  totalDurationMin: number;
  legs: { from: string; to: string; distanceKm: number; durationMin: number }[];
  overviewPolyline?: string;
}

export default function Home() {
  const { stops, isLoading, updateStop, deleteStop, reorderStops } = useStops();
  const { getSettings } = useSettings();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [globalDeliveryDate, setGlobalDeliveryDate] = useState<Date>(new Date());
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(new Date());
  const [whatsappPreviewOpen, setWhatsappPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { isLoaded } = useGoogleMaps();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = stops.findIndex((item) => item.id === active.id);
      const newIndex = stops.findIndex((item) => item.id === over.id);
      const reordered = arrayMove(stops, oldIndex, newIndex);
      await reorderStops(reordered.map(s => s.id));
    }
  };

  const handleDelete = async (id: number) => {
    await deleteStop(id);
  };

  const handleToggleComplete = async (id: number) => {
    const stop = stops.find(s => s.id === id);
    if (stop) {
      await updateStop({ id, data: { completed: !stop.completed } });
    }
  };

  const calcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculateRouteInfo = useCallback(async (currentStops: Stop[]) => {
    if (!isLoaded || currentStops.length === 0) {
      setRouteInfo(null);
      return;
    }

    const { startAddress } = getSettings();
    if (!startAddress) {
      setRouteInfo(null);
      return;
    }

    try {
      const directionsService = new google.maps.DirectionsService();

      const waypoints = currentStops.map(s => ({
        location: s.address,
        stopover: true,
      }));

      const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route(
          {
            origin: startAddress,
            destination: startAddress,
            waypoints,
            optimizeWaypoints: false,
            travelMode: google.maps.TravelMode.DRIVING,
            region: "de",
          },
          (res, status) => {
            if (status === google.maps.DirectionsStatus.OK && res) {
              resolve(res);
            } else {
              reject(new Error(`Directions API: ${status}`));
            }
          }
        );
      });

      const route = result.routes[0];
      const legs = route.legs;
      let totalDistanceM = 0;
      let totalDurationS = 0;
      const legDetails = legs.map((leg) => {
        totalDistanceM += leg.distance?.value ?? 0;
        totalDurationS += leg.duration?.value ?? 0;
        return {
          from: leg.start_address ?? "",
          to: leg.end_address ?? "",
          distanceKm: Math.round((leg.distance?.value ?? 0) / 100) / 10,
          durationMin: Math.round((leg.duration?.value ?? 0) / 60),
        };
      });

      setRouteInfo({
        totalDistanceKm: Math.round(totalDistanceM / 100) / 10,
        totalDurationMin: Math.round(totalDurationS / 60),
        legs: legDetails,
        overviewPolyline: route.overview_polyline ?? undefined,
      });
    } catch (error) {
      console.error("Route calculation failed:", error);
      setRouteInfo(null);
    }
  }, [isLoaded, getSettings]);

  useEffect(() => {
    if (calcTimerRef.current) {
      clearTimeout(calcTimerRef.current);
    }
    calcTimerRef.current = setTimeout(() => {
      calculateRouteInfo(stops);
    }, 500);
    return () => {
      if (calcTimerRef.current) clearTimeout(calcTimerRef.current);
    };
  }, [stops, isLoaded, calculateRouteInfo]);

  const geocodeAddress = (geocoder: google.maps.Geocoder, address: string): Promise<google.maps.LatLng> => {
    return new Promise((resolve, reject) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          resolve(results[0].geometry.location);
        } else {
          reject(new Error(`Geocode failed: ${status}`));
        }
      });
    });
  };

  const optimizeRoute = async () => {
    if (!isLoaded) {
      toast({ title: "Karten nicht geladen", description: "Bitte warte, bis Google Maps geladen ist.", variant: "destructive" });
      return;
    }

    const { startAddress } = getSettings();
    if (!startAddress) {
      toast({ title: "Startadresse fehlt", description: "Bitte zuerst eine Startadresse in den Einstellungen festlegen.", variant: "destructive" });
      return;
    }

    if (stops.length < 2) return;

    setIsOptimizing(true);

    try {
      const geocoder = new google.maps.Geocoder();
      const startGeo = await geocodeAddress(geocoder, startAddress);

      const stopsWithCoords = await Promise.all(
        stops.map(async (stop) => {
          if (stop.lat && stop.lng) {
            return { ...stop, latLng: new google.maps.LatLng(stop.lat, stop.lng) };
          }
          const geo = await geocodeAddress(geocoder, stop.address);
          return { ...stop, latLng: geo };
        })
      );

      let currentPos = startGeo;
      const unvisited = [...stopsWithCoords];
      const optimized: typeof stopsWithCoords = [];

      while (unvisited.length > 0) {
        let nearestIdx = 0;
        let minDist = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
          const dist = google.maps.geometry.spherical.computeDistanceBetween(currentPos, unvisited[i].latLng);
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = i;
          }
        }

        const nearest = unvisited.splice(nearestIdx, 1)[0];
        optimized.push(nearest);
        currentPos = nearest.latLng;
      }

      await reorderStops(optimized.map(s => s.id));

      toast({ title: "Route optimiert", description: "Nächster Stopp zuerst sortiert." });

    } catch (error) {
      console.error(error);
      toast({ title: "Optimierung fehlgeschlagen", description: "Bitte Adressen und API-Kontingent prüfen.", variant: "destructive" });
    } finally {
      setIsOptimizing(false);
    }
  };

  const buildWhatsAppMessage = useCallback(() => {
    const { startAddress } = getSettings();
    if (stops.length === 0) return "";

    const date = format(globalDeliveryDate, 'dd.MM.yyyy', { locale: de });
    let message = `📅 Lieferungen am ${date}\n`;

    if (routeInfo) {
      const durationText = routeInfo.totalDurationMin >= 60
        ? `${Math.floor(routeInfo.totalDurationMin / 60)} Std ${routeInfo.totalDurationMin % 60} Min`
        : `${routeInfo.totalDurationMin} Min`;
      message += `🚚 Route: ${routeInfo.totalDistanceKm} km | ⏱️ ${durationText}`;
    }

    message += `\n\n`;

    stops.forEach((stop, idx) => {
      const paymentText = stop.paymentMethod === 'paid' ? '✅ Bereits bezahlt' : '💰 Barzahlung bei Lieferung';
      const notesText = stop.notes ? `\n📝 ${stop.notes}` : '';
      const phoneText = stop.phone ? `\n📞 ${stop.phone}` : '';
      message += `📦 ${idx + 1}/${stops.length}\n👤 ${stop.name}${phoneText}\n📍 ${stop.address}\n${paymentText}${notesText}\n\n`;
    });

    const baseUrl = "https://www.google.com/maps/dir/?api=1";
    const origin = encodeURIComponent(startAddress);
    const destination = encodeURIComponent(startAddress);
    const waypoints = stops.map(s => encodeURIComponent(s.address)).join('|');
    
    const mapUrl = `${baseUrl}&origin=${origin}&destination=${destination}&waypoints=${waypoints}`;
    
    message += `🗺️ Route starten:\n${mapUrl}`;

    return message;
  }, [stops, globalDeliveryDate, routeInfo, getSettings]);

  const openWhatsApp = async () => {
    const message = buildWhatsAppMessage();
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    window.open('https://web.whatsapp.com/', '_blank');
  };

  const printDeliveryList = useCallback(async () => {
    if (stops.length === 0) return;
    const { startAddress } = getSettings();
    const date = format(globalDeliveryDate, 'EEEE, dd. MMMM yyyy', { locale: de });
    const now = format(new Date(), 'dd.MM.yyyy HH:mm', { locale: de });

    const routeBaseUrl = "https://www.google.com/maps/dir/?api=1";
    const routeOrigin = encodeURIComponent(startAddress);
    const routeDestination = encodeURIComponent(startAddress);
    const routeWaypoints = stops.map(s => encodeURIComponent(s.address)).join('|');
    const routeUrl = `${routeBaseUrl}&origin=${routeOrigin}&destination=${routeDestination}&waypoints=${routeWaypoints}`;
    const qrUrl = await QRCode.toDataURL(routeUrl, { width: 220, margin: 2 });
    const qrHtml = `
      <div class="qr-box">
        <img src="${qrUrl}" alt="Route QR-Code" class="qr-img" />
        <div class="qr-label">&#128241; Route scannen</div>
      </div>`;

    let mapImageHtml = "";
    if (stops.length > 0) {
      const markerLabels = "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const params = new URLSearchParams();
      params.set("size", "800x350");
      params.set("maptype", "roadmap");

      stops.forEach((s, idx) => {
        const label = markerLabels[idx] ?? String(idx + 1);
        const location = (s.lat && s.lng) ? `${s.lat},${s.lng}` : s.address;
        params.append("markers", `color:red|label:${label}|${location}`);
      });

      if (routeInfo?.overviewPolyline) {
        params.append("path", `color:0x22c55eff|weight:4|enc:${routeInfo.overviewPolyline}`);
      }

      const staticMapUrl = `/api/static-map?${params.toString()}`;
      mapImageHtml = `<img src="${staticMapUrl}" alt="Routenkarte" class="map-img" />`;
    }

    let routeInfoHtml = "";
    if (routeInfo) {
      const durationText = routeInfo.totalDurationMin >= 60
        ? `${Math.floor(routeInfo.totalDurationMin / 60)} Std ${routeInfo.totalDurationMin % 60} Min`
        : `${routeInfo.totalDurationMin} Min`;
      routeInfoHtml = `
        <div class="route-info">
          <span>&#128338; Fahrzeit: <strong>${durationText}</strong></span>
          <span>&#128205; Gesamtstrecke: <strong>${routeInfo.totalDistanceKm} km</strong></span>
          <span>&#128230; Stopps: <strong>${stops.length}</strong></span>
        </div>`;
    }

    const stopsHtml = stops.map((stop, idx) => {
      const paymentLabel = stop.paymentMethod === 'paid' ? 'Bereits bezahlt' : 'Barzahlung';
      const paymentClass = stop.paymentMethod === 'paid' ? 'badge-paid' : 'badge-cod';
      const notesHtml = stop.notes ? `<div class="notes">&#128221; ${stop.notes}</div>` : '';
      const phoneHtml = stop.phone ? `<div class="detail">&#128222; ${stop.phone}</div>` : '';
      const solarLabel = stop.solarModule === 'aiko' ? 'Aiko' : stop.solarModule === 'joly' ? 'Joly' : '';
      const solarHtml = stop.solarModule
        ? `<div class="solar">&#9728; Solarmodule: <strong>${solarLabel}${stop.solarQuantity ? ' &times; ' + stop.solarQuantity : ''}</strong></div>`
        : '';
      return `
        <div class="stop">
          <div class="stop-header">
            <div class="stop-number">${idx + 1}</div>
            <div class="stop-name">${stop.name}</div>
            <div class="checkbox">&#9744;</div>
          </div>
          <div class="stop-body">
            <div class="detail">&#128205; ${stop.address}</div>
            ${phoneHtml}
            ${solarHtml}
            <div class="stop-footer">
              <span class="badge ${paymentClass}">${paymentLabel}</span>
              ${notesHtml}
            </div>
          </div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Lieferliste – ${date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 20px; }
    h1 { font-size: 20px; font-weight: bold; margin-bottom: 2px; }
    .subtitle { font-size: 13px; color: #555; margin-bottom: 10px; }
    .route-info { display: flex; gap: 24px; background: #f4f4f4; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; font-size: 13px; }
    .stop { border: 1px solid #ccc; border-radius: 6px; margin-bottom: 10px; overflow: hidden; page-break-inside: avoid; }
    .stop-header { display: flex; align-items: center; gap: 10px; background: #f0f0f0; padding: 8px 12px; border-bottom: 1px solid #ccc; }
    .stop-number { width: 26px; height: 26px; border-radius: 50%; background: #222; color: #fff; font-weight: bold; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .stop-name { font-weight: bold; font-size: 15px; flex: 1; }
    .checkbox { font-size: 28px; color: #333; flex-shrink: 0; line-height: 1; }
    .stop-body { padding: 8px 12px; }
    .detail { margin: 3px 0; color: #333; }
    .stop-footer { margin-top: 6px; display: flex; align-items: center; gap: 10px; }
    .badge { font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: bold; border: 1px solid; }
    .badge-paid { background: #e6f9ee; color: #166534; border-color: #bbf7d0; }
    .badge-cod { background: #fef9c3; color: #854d0e; border-color: #fde68a; }
    .notes { font-size: 12px; color: #555; }
    .solar { margin: 3px 0; color: #166534; font-size: 13px; }
    .map-img { width: 100%; max-height: 350px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc; margin-bottom: 14px; display: block; }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
    .qr-box { flex-shrink: 0; text-align: center; border: 1px solid #ccc; border-radius: 6px; padding: 8px; }
    .qr-img { width: 110px; height: 110px; display: block; }
    .qr-label { font-size: 11px; font-weight: bold; color: #333; margin-top: 4px; }
    .footer { margin-top: 16px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
    @media print {
      body { padding: 10mm; }
      .stop { break-inside: avoid; }
      .map-img { break-inside: avoid; max-height: 300px; }
    }
  </style>
</head>
<body>
  <div class="header-row">
    <div>
      <h1>&#128230; Lieferliste</h1>
      <div class="subtitle">${date}${startAddress ? ' &nbsp;|&nbsp; Start: ' + startAddress : ''}</div>
    </div>
    ${qrHtml}
  </div>
  ${routeInfoHtml}
  ${mapImageHtml}
  ${stopsHtml}
  <div class="footer">Erstellt am ${now} &nbsp;|&nbsp; AutoPlan</div>
  <script>
    var imgs = Array.prototype.slice.call(document.images);
    var pending = imgs.length;
    function done() { pending--; if (pending <= 0) window.print(); }
    if (pending === 0) {
      window.print();
    } else {
      imgs.forEach(function(img) {
        if (img.complete) { done(); }
        else {
          img.onload = done;
          img.onerror = function() { this.style.display = 'none'; done(); };
        }
      });
    }
  <\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }, [stops, globalDeliveryDate, routeInfo, getSettings]);

  const copyMessage = async () => {
    const message = buildWhatsAppMessage();
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-2 rounded-lg text-primary">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-display tracking-tight text-foreground">AutoPlan</h1>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      data-testid="button-global-delivery-date"
                      className="flex items-center text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    >
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {format(globalDeliveryDate, "EEEE, d. MMMM yyyy", { locale: de })}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <DeliveryCalendar
                      selectedDate={globalDeliveryDate}
                      onSelectDate={setGlobalDeliveryDate}
                      viewMonth={calendarViewMonth}
                      onViewMonthChange={setCalendarViewMonth}
                      stops={stops}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
               <SettingsDialog />
               <Button
                 data-testid="button-print"
                 onClick={printDeliveryList}
                 disabled={stops.length === 0}
                 variant="outline"
                 className="gap-2 border-border text-foreground"
               >
                 <Printer className="h-4 w-4" />
                 <span className="hidden sm:inline">Drucken</span>
               </Button>
               <Button 
                 data-testid="button-whatsapp"
                 onClick={() => { setCopied(false); setWhatsappPreviewOpen(true); }}
                 disabled={stops.length === 0}
                 className="gap-2 bg-green-600 text-white border-none"
               >
                 <MessageCircle className="h-4 w-4" />
                 <span className="hidden sm:inline">WhatsApp</span>
               </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 grid lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-4 flex flex-col h-full min-h-[50vh]">
          <div className="flex items-center justify-between gap-1 mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Navigation className="h-4 w-4 text-primary" />
              Stopps ({stops.length})
            </h2>
            <div className="flex items-center gap-2">
              <AddStopDialog deliveryDate={globalDeliveryDate} />
              <Button 
                data-testid="button-optimize"
                onClick={optimizeRoute} 
                disabled={isOptimizing || stops.length < 2}
                variant="outline"
                className="gap-2 border-primary/20 text-primary"
              >
                <RotateCw className={`h-4 w-4 ${isOptimizing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Optimieren</span>
              </Button>
            </div>
          </div>

          <div className="flex-1 bg-card/30 rounded-xl border border-border/50 p-2 overflow-y-auto max-h-[calc(100vh-200px)]">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                <p>Stopps werden geladen...</p>
              </div>
            ) : stops.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center opacity-60">
                <Truck className="h-12 w-12 mb-4" />
                <p>Noch keine Stopps.</p>
                <p className="text-sm">Füge eine Lieferung hinzu.</p>
              </div>
            ) : (
              <DndContext 
                sensors={sensors} 
                collisionDetection={closestCenter} 
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={stops.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  {stops.map((stop, index) => (
                    <StopCard 
                      key={stop.id} 
                      stop={stop} 
                      index={index}
                      onDelete={handleDelete}
                      onToggleComplete={handleToggleComplete}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between gap-1 mb-4">
               <h2 className="text-lg font-semibold">Routenübersicht</h2>
            </div>
            <div className="rounded-xl overflow-hidden shadow-2xl border border-border bg-card">
              <RouteMap stops={stops} />
            </div>
          </div>

          {routeInfo && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-lg" data-testid="route-info-panel">
              <div className="flex items-center gap-2 mb-3">
                <Route className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Routendetails</h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-primary/10 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-primary" data-testid="text-total-distance">{routeInfo.totalDistanceKm} km</div>
                  <div className="text-xs text-muted-foreground mt-1">Gesamtstrecke</div>
                </div>
                <div className="bg-primary/10 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-primary" data-testid="text-total-duration">
                    {routeInfo.totalDurationMin >= 60
                      ? `${Math.floor(routeInfo.totalDurationMin / 60)} Std ${routeInfo.totalDurationMin % 60} Min`
                      : `${routeInfo.totalDurationMin} Min`}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Fahrzeit</div>
                </div>
                <div className="bg-primary/10 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
                  <div className="text-2xl font-bold text-primary" data-testid="text-total-stops">{stops.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Kunden</div>
                </div>
              </div>

              <div className="space-y-2">
                {routeInfo.legs.map((leg, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs bg-background/50 rounded-lg px-3 py-2" data-testid={`route-leg-${i}`}>
                    <div className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0 truncate text-muted-foreground">
                      <span className="truncate">{leg.from.split(",")[0]}</span>
                      <span className="mx-1">→</span>
                      <span className="truncate">{leg.to.split(",")[0]}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 text-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{leg.distanceKm} km</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{leg.durationMin} Min</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </main>

      <footer className="text-center py-3 text-xs text-muted-foreground/50">
        <a
          href="https://openkairo.de/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-muted-foreground transition-colors"
          data-testid="link-openkairo"
        >
          OpenKairo
        </a>
      </footer>

      <Dialog open={whatsappPreviewOpen} onOpenChange={setWhatsappPreviewOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              WhatsApp Nachricht
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto rounded-lg bg-[#0b141a] border border-border/50 p-4" data-testid="whatsapp-preview">
            <div className="bg-[#005c4b] rounded-lg rounded-tr-none p-3 text-sm text-white/90 whitespace-pre-wrap break-words leading-relaxed max-w-[90%] ml-auto" data-testid="whatsapp-preview-bubble">
              {buildWhatsAppMessage()}
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={copyMessage}
              data-testid="button-copy-message"
              className="flex-1 gap-2"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "Kopiert!" : "Kopieren"}
            </Button>
            <Button
              onClick={() => { openWhatsApp(); setWhatsappPreviewOpen(false); }}
              data-testid="button-send-whatsapp"
              className="flex-1 gap-2 bg-green-600 text-white border-none"
            >
              <Send className="h-4 w-4" />
              Kopieren & WhatsApp öffnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
