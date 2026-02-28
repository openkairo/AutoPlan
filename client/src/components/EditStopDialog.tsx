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
