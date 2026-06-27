import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useStops } from "@/hooks/use-deliveries";
import { useToast } from "@/hooks/use-toast";
import { AddressAutocomplete } from "./AddressAutocomplete";
import type { Stop } from "@shared/schema";

interface EditStopDialogProps {
  stop: Stop;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditStopDialog({ stop, open, onOpenChange }: EditStopDialogProps) {
  const [loading, setLoading] = useState(false);
  const { updateStop } = useStops();
  const { toast } = useToast();

  const [name, setName] = useState(stop.name);
  const [phone, setPhone] = useState(stop.phone || "");
  const [address, setAddress] = useState(stop.address);
  const [streetNumber, setStreetNumber] = useState("");
  const [lat, setLat] = useState<number | undefined>(stop.lat ?? undefined);
  const [lng, setLng] = useState<number | undefined>(stop.lng ?? undefined);
  const [paymentMethod, setPaymentMethod] = useState<"paid" | "cod">(stop.paymentMethod as "paid" | "cod");
  const [notes, setNotes] = useState(stop.notes || "");
  const [solarModule, setSolarModule] = useState<"aiko" | "joly" | "">((stop.solarModule as "aiko" | "joly") || "");
  const [solarQuantity, setSolarQuantity] = useState(stop.solarQuantity != null ? String(stop.solarQuantity) : "");

  useEffect(() => {
    if (open) {
      setName(stop.name);
      setPhone(stop.phone || "");
      setAddress(stop.address);
      setStreetNumber("");
      setLat(stop.lat ?? undefined);
      setLng(stop.lng ?? undefined);
      setPaymentMethod(stop.paymentMethod as "paid" | "cod");
      setNotes(stop.notes || "");
      setSolarModule((stop.solarModule as "aiko" | "joly") || "");
      setSolarQuantity(stop.solarQuantity != null ? String(stop.solarQuantity) : "");
    }
  }, [open, stop]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fullAddress = streetNumber
        ? address.replace(/,/, ` ${streetNumber},`)
        : address;
      await updateStop({
        id: stop.id,
        data: {
          name,
          phone: phone || null,
          address: fullAddress,
          lat: lat ?? null,
          lng: lng ?? null,
          paymentMethod,
          notes: notes || null,
          solarModule: solarModule || null,
          solarQuantity: solarModule && solarQuantity ? parseInt(solarQuantity, 10) : null,
        },
      });

      onOpenChange(false);

      toast({
        title: "Stopp aktualisiert",
        description: `${name} wurde aktualisiert.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Fehler",
        description: "Stopp konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Stopp bearbeiten</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Kundenname</Label>
            <Input
              id="edit-name"
              data-testid="input-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Max Mustermann"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-phone">Telefonnummer</Label>
            <Input
              id="edit-phone"
              data-testid="input-edit-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+49 170 1234567"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-address">Adresse</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <AddressAutocomplete
                  id="edit-address"
                  data-testid="input-edit-address"
                  value={address}
                  onChange={(addr, newLat, newLng) => {
                    setAddress(addr);
                    setLat(newLat);
                    setLng(newLng);
                  }}
                  placeholder="Straße, Stadt, PLZ"
                  required
                />
              </div>
              <Input
                id="edit-streetNumber"
                data-testid="input-edit-street-number"
                value={streetNumber}
                onChange={(e) => setStreetNumber(e.target.value)}
                placeholder="Nr."
                className="w-20"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-notes">Hinweise</Label>
            <Textarea
              id="edit-notes"
              data-testid="input-edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z.B. Hintereingang, Klingel defekt..."
              rows={2}
            />
          </div>
          <div className="grid gap-2">
            <Label>Solarmodule</Label>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="button-edit-solar-aiko"
                onClick={() => setSolarModule(solarModule === "aiko" ? "" : "aiko")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  solarModule === "aiko"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <span className={`h-4 w-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${solarModule === "aiko" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                  {solarModule === "aiko" && <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-none stroke-white stroke-2"><polyline points="1,4 4,7 9,1"/></svg>}
                </span>
                Aiko
              </button>
              <button
                type="button"
                data-testid="button-edit-solar-joly"
                onClick={() => setSolarModule(solarModule === "joly" ? "" : "joly")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  solarModule === "joly"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <span className={`h-4 w-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${solarModule === "joly" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                  {solarModule === "joly" && <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-none stroke-white stroke-2"><polyline points="1,4 4,7 9,1"/></svg>}
                </span>
                Joly
              </button>
            </div>
            {solarModule && (
              <Input
                type="number"
                min="1"
                data-testid="input-edit-solar-quantity"
                value={solarQuantity}
                onChange={(e) => setSolarQuantity(e.target.value)}
                placeholder="Anzahl"
                className="mt-1"
              />
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-payment">Zahlungsart</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "paid" | "cod")}>
              <SelectTrigger data-testid="select-edit-payment">
                <SelectValue placeholder="Zahlungsart wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Bereits bezahlt</SelectItem>
                <SelectItem value="cod">Barzahlung bei Lieferung</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" data-testid="button-save-stop" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
