import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, X, Clipboard, FolderOpen, FileText, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { scanDocument } from "@/lib/scan-document";
import { getCachedSetting } from "@/lib/settings-config";
import { cn } from "@/lib/utils";

interface ScanResult {
  name?: string;
  address?: string;
  phone?: string;
}

interface ScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanComplete: (result: ScanResult) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ScanDialog({ open, onOpenChange, onScanComplete }: ScanDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setPreviews([]);
      setScanning(false);
    }
  }, [open]);

  useEffect(() => {
    const newPreviews: string[] = [];
    let cancelled = false;

    Promise.all(
      files.map(async (file) => {
        if (file.type.startsWith("image/")) {
          return URL.createObjectURL(file);
        }
        return null;
      })
    ).then((results) => {
      if (!cancelled) {
        setPreviews(results.map((r) => r || ""));
      }
    });

    return () => {
      cancelled = true;
      previews.forEach((p) => {
        if (p) URL.revokeObjectURL(p);
      });
    };
  }, [files]);

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (!open) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        setFiles((prev) => [...prev, ...pastedFiles]);
        toast({
          title: "Bild eingefügt",
          description: `${pastedFiles.length} Bild(er) aus der Zwischenablage eingefügt.`,
        });
      }
    },
    [open, toast]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    setFiles((prev) => [...prev, ...Array.from(selected)]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files;
    if (!dropped) return;
    const valid = Array.from(dropped).filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf"
    );
    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleScan = async () => {
    if (files.length === 0) return;

    setScanning(true);
    try {
      const base64Files = await Promise.all(files.map((f) => fileToBase64(f)));

      let combinedResult: ScanResult = {};

      for (const base64 of base64Files) {
        const scanPrompt = getCachedSetting("scanPrompt") || undefined;
        const aiModel = getCachedSetting("aiModel") || undefined;
        const result = await scanDocument(base64, scanPrompt, aiModel);
        if (result.name && !combinedResult.name) combinedResult.name = result.name;
        if (result.address && !combinedResult.address) combinedResult.address = result.address;
        if (result.phone && !combinedResult.phone) combinedResult.phone = result.phone;

        if (combinedResult.name && combinedResult.address && combinedResult.phone) break;
      }

      onScanComplete(combinedResult);
      onOpenChange(false);

      toast({
        title: "Dokument gescannt",
        description: "Daten wurden automatisch erkannt und eingetragen.",
      });
    } catch (error: any) {
      console.error("Scan error:", error);
      toast({
        title: "Scan fehlgeschlagen",
        description: error.message || "Das Dokument konnte nicht analysiert werden.",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Dokument scannen
          </DialogTitle>
        </DialogHeader>

        <div
          ref={dropZoneRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={cn(
            "border-2 border-dashed rounded-xl p-6 text-center transition-colors",
            "border-border/50 hover:border-primary/50",
            files.length === 0 && "min-h-[180px] flex flex-col items-center justify-center"
          )}
          data-testid="scan-drop-zone"
        >
          {files.length === 0 ? (
            <div className="space-y-3">
              <div className="flex justify-center gap-3 text-muted-foreground">
                <ImageIcon className="h-10 w-10" />
                <FileText className="h-10 w-10" />
              </div>
              <p className="text-sm text-muted-foreground">
                Bilder oder PDFs hierher ziehen
              </p>
              <p className="text-xs text-muted-foreground/60">
                oder Bild aus Zwischenablage einfügen (Strg+V)
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {files.map((file, i) => (
                <div
                  key={i}
                  className="relative group rounded-lg overflow-hidden border border-border/50 bg-background/50"
                  data-testid={`scan-file-${i}`}
                >
                  {previews[i] ? (
                    <img
                      src={previews[i]}
                      alt={file.name}
                      className="w-full h-24 object-cover"
                    />
                  ) : (
                    <div className="w-full h-24 flex flex-col items-center justify-center text-muted-foreground">
                      <FileText className="h-8 w-8 mb-1" />
                      <span className="text-[10px] truncate max-w-full px-1">{file.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`button-remove-file-${i}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-scan-files"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 gap-2"
            data-testid="button-select-files"
          >
            <FolderOpen className="h-4 w-4" />
            Dateien auswählen
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                const items = await navigator.clipboard.read();
                const pastedFiles: File[] = [];
                for (const item of items) {
                  for (const type of item.types) {
                    if (type.startsWith("image/")) {
                      const blob = await item.getType(type);
                      const file = new File([blob], `clipboard.${type.split("/")[1]}`, { type });
                      pastedFiles.push(file);
                    }
                  }
                }
                if (pastedFiles.length > 0) {
                  setFiles((prev) => [...prev, ...pastedFiles]);
                  toast({ title: "Bild eingefügt", description: "Bild aus Zwischenablage eingefügt." });
                } else {
                  toast({ title: "Keine Bilder", description: "Keine Bilder in der Zwischenablage gefunden.", variant: "destructive" });
                }
              } catch {
                toast({ title: "Zugriff verweigert", description: "Bitte Strg+V verwenden, um Bilder einzufügen.", variant: "destructive" });
              }
            }}
            className="flex-1 gap-2"
            data-testid="button-paste-clipboard"
          >
            <Clipboard className="h-4 w-4" />
            Einfügen
          </Button>
        </div>

        <DialogFooter>
          <Button
            onClick={handleScan}
            disabled={scanning || files.length === 0}
            className="w-full gap-2"
            data-testid="button-start-scan"
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {scanning
              ? "Wird analysiert..."
              : `${files.length} Dokument${files.length !== 1 ? "e" : ""} scannen`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
