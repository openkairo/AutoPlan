import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Camera, Search, BookUser, FileText, ExternalLink } from "lucide-react";
import { useStops } from "@/hooks/use-deliveries";
import { useToast } from "@/hooks/use-toast";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { ScanDialog } from "./ScanDialog";
import { loadKeysStatus } from "@/lib/settings-config";
import { format } from "date-fns";

interface LexofficeContact {
  id: string;
  displayName: string;
  phone: string;
  address: string;
}

function extractContacts(data: any): LexofficeContact[] {
  if (!data?.content) return [];
  return data.content.map((c: any) => {
    let displayName = "";
    if (c.company?.name) {
      displayName = c.company.name;
    } else if (c.person) {
      displayName = [c.person.firstName, c.person.lastName].filter(Boolean).join(" ");
    }

    let phone = "";
    const pn = c.phoneNumbers;
    if (pn) {
      phone = pn.business?.[0] || pn.mobile?.[0] || pn.office?.[0] || pn.private?.[0] || "";
    }
    if (!phone && c.company?.contactPersons?.length) {
      phone = c.company.contactPersons[0].phoneNumber || "";
    }

    let address = "";
    const addrs = c.addresses;
    if (addrs) {
      const src = addrs.shipping?.[0] || addrs.billing?.[0];
      if (src) {
        address = [src.street, src.zip, src.city].filter(Boolean).join(", ");
      }
    }

    return { id: c.id, displayName, phone, address };
  });
}

interface LexofficeInvoice {
  id: string;
  voucherNumber: string;
  voucherDate: string;
  totalAmount: number;
  voucherStatus: string;
  voucherType: string;
}

interface AddStopDialogProps {
  deliveryDate: Date;
}

export function AddStopDialog({ deliveryDate }: AddStopDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const { createStop } = useStops();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [paymentMethod, setPaymentMethod] = useState<"paid" | "cod">("paid");
  const [notes, setNotes] = useState("");

  const [lexQuery, setLexQuery] = useState("");
  const [lexResults, setLexResults] = useState<LexofficeContact[]>([]);
  const [lexLoading, setLexLoading] = useState(false);
  const [lexDropdownOpen, setLexDropdownOpen] = useState(false);
  const lexRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [hasLexofficeKey, setHasLexofficeKey] = useState(false);
  const [invoices, setInvoices] = useState<LexofficeInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [selectedContactName, setSelectedContactName] = useState("");

  useEffect(() => {
    loadKeysStatus().then((status) => setHasLexofficeKey(status.lexoffice));
  }, []);

  const searchLexoffice = useCallback(async (query: string) => {
    if (!hasLexofficeKey || query.length < 2) {
      setLexResults([]);
      setLexDropdownOpen(false);
      return;
    }

    setLexLoading(true);
    try {
      const res = await fetch(`/api/lexoffice/contacts?name=${encodeURIComponent(query)}&size=10`);
      if (res.ok) {
        const data = await res.json();
        const contacts = extractContacts(data);
        setLexResults(contacts);
        setLexDropdownOpen(contacts.length > 0);
      } else {
        setLexResults([]);
        setLexDropdownOpen(false);
      }
    } catch {
      setLexResults([]);
      setLexDropdownOpen(false);
    } finally {
      setLexLoading(false);
    }
  }, [hasLexofficeKey]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (lexQuery.length < 2) {
      setLexResults([]);
      setLexDropdownOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => searchLexoffice(lexQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [lexQuery, searchLexoffice]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (lexRef.current && !lexRef.current.contains(e.target as Node)) {
        setLexDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchInvoices = useCallback(async (contactId: string) => {
    setInvoicesLoading(true);
    try {
      const res = await fetch(`/api/lexoffice/invoices?contactId=${encodeURIComponent(contactId)}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.content || []);
      } else {
        setInvoices([]);
      }
    } catch {
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  const selectContact = (contact: LexofficeContact) => {
    setName(contact.displayName);
    setSelectedContactName(contact.displayName);
    if (contact.phone) setPhone(contact.phone);
    if (contact.address) {
      setAddress(contact.address);
      if (window.google?.maps) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: contact.address }, (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
            const location = results[0].geometry.location;
            setLat(location.lat());
            setLng(location.lng());
          }
        });
      }
    }
    setLexQuery("");
    setLexDropdownOpen(false);
    setLexResults([]);
    fetchInvoices(contact.id);
  };

  const handleScanComplete = (result: { name?: string; address?: string; phone?: string }) => {
    if (result.name) setName(result.name);
    if (result.phone) setPhone(result.phone);
    if (result.address) {
      setAddress(result.address);
      if (window.google?.maps) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: result.address }, (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
            const location = results[0].geometry.location;
            setLat(location.lat());
            setLng(location.lng());
          }
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fullAddress = streetNumber
        ? address.replace(/,/, ` ${streetNumber},`)
        : address;
      await createStop({
        name,
        phone: phone || null,
        address: fullAddress,
        lat: lat ?? null,
        lng: lng ?? null,
        paymentMethod,
        notes: notes || null,
        deliveryDate: format(deliveryDate, "yyyy-MM-dd"),
        completed: false,
      });
      
      setOpen(false);
      setName("");
      setPhone("");
      setAddress("");
      setLat(undefined);
      setLng(undefined);
      setPaymentMethod("paid");
      setNotes("");
      setStreetNumber("");
      setLexQuery("");
      setLexResults([]);
      setInvoices([]);
      setSelectedContactName("");
      
      toast({
        title: "Stopp hinzugefügt",
        description: `${name} wurde zur Route hinzugefügt.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Fehler",
        description: "Stopp konnte nicht hinzugefügt werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button data-testid="button-add-stop" className="bg-primary text-white shadow-lg shadow-primary/20">
            Stopp hinzufügen
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Lieferstopp hinzufügen</DialogTitle>
          </DialogHeader>

          <Button
            type="button"
            variant="outline"
            onClick={() => setScanOpen(true)}
            data-testid="button-scan-document"
            className="w-full border-dashed border-2 border-primary/30 hover:border-primary/60 text-muted-foreground hover:text-foreground"
          >
            <Camera className="h-4 w-4 mr-2" />
            Lieferschein/Rechnung scannen
          </Button>

          {hasLexofficeKey && (
            <div ref={lexRef} className="relative">
              <Label className="flex items-center gap-1.5 mb-1.5">
                <BookUser className="h-3.5 w-3.5 text-primary" />
                Lexoffice Kontaktsuche
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="input-lexoffice-search"
                  value={lexQuery}
                  onChange={(e) => setLexQuery(e.target.value)}
                  placeholder="Kundenname suchen..."
                  className="pl-9"
                />
                {lexLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {lexDropdownOpen && lexResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {lexResults.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      data-testid={`lexoffice-contact-${contact.id}`}
                      onClick={() => selectContact(contact)}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/50 last:border-b-0"
                    >
                      <div className="font-medium text-sm">{contact.displayName}</div>
                      {contact.address && (
                        <div className="text-xs text-muted-foreground truncate">{contact.address}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {invoicesLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Rechnungen werden geladen...
            </div>
          )}

          {!invoicesLoading && invoices.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <Label className="flex items-center gap-1.5 mb-2">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Rechnungen ({invoices.length})
              </Label>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {invoices.map((inv) => {
                  const date = inv.voucherDate
                    ? new Date(inv.voucherDate).toLocaleDateString("de-DE")
                    : "";
                  const statusMap: Record<string, { label: string; className: string }> = {
                    draft: { label: "Entwurf", className: "bg-muted text-muted-foreground" },
                    open: { label: "Offen", className: "bg-yellow-500/20 text-yellow-400" },
                    paid: { label: "Bezahlt", className: "bg-green-500/20 text-green-400" },
                    paidoff: { label: "Bezahlt", className: "bg-green-500/20 text-green-400" },
                    voided: { label: "Storniert", className: "bg-red-500/20 text-red-400" },
                    overdue: { label: "Überfällig", className: "bg-red-500/20 text-red-400" },
                  };
                  const status = statusMap[inv.voucherStatus] || { label: inv.voucherStatus, className: "bg-muted text-muted-foreground" };
                  return (
                    <a
                      key={inv.id}
                      href={`https://app.lexoffice.de/permalink/invoices/view/${inv.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`invoice-${inv.id}`}
                      className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{inv.voucherNumber || "—"}</span>
                        <span className="text-xs text-muted-foreground">{date}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-medium">
                          {inv.totalAmount != null ? `${inv.totalAmount.toFixed(2)} €` : ""}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${status.className}`}>
                          {status.label}
                        </span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Kundenname</Label>
              <Input
                id="name"
                data-testid="input-stop-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefonnummer</Label>
              <Input
                id="phone"
                data-testid="input-stop-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Adresse</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <AddressAutocomplete
                    id="address"
                    data-testid="input-stop-address"
                    value={address}
                    onChange={(addr, newLat, newLng) => {
                      setAddress(addr);
                      setLat(newLat);
                      setLng(newLng);
                    }}
                    required
                  />
                </div>
                <Input
                  id="streetNumber"
                  data-testid="input-stop-street-number"
                  value={streetNumber}
                  onChange={(e) => setStreetNumber(e.target.value)}
                  className="w-20"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Hinweise</Label>
              <Textarea
                id="notes"
                data-testid="input-stop-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label>Zahlungsart</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="button-payment-paid"
                  onClick={() => setPaymentMethod("paid")}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    paymentMethod === "paid"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  <span className={`h-4 w-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${paymentMethod === "paid" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                    {paymentMethod === "paid" && <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-none stroke-white stroke-2"><polyline points="1,4 4,7 9,1"/></svg>}
                  </span>
                  Bereits bezahlt
                </button>
                <button
                  type="button"
                  data-testid="button-payment-cod"
                  onClick={() => setPaymentMethod("cod")}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    paymentMethod === "cod"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  <span className={`h-4 w-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${paymentMethod === "cod" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                    {paymentMethod === "cod" && <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-none stroke-white stroke-2"><polyline points="1,4 4,7 9,1"/></svg>}
                  </span>
                  Barzahlung
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" data-testid="button-submit-stop" disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Zur Route hinzufügen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScanComplete={handleScanComplete}
      />
    </>
  );
}
