import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, Trash2, CheckCircle2, Circle, MapPin, DollarSign, Phone, Pencil, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditStopDialog } from "./EditStopDialog";
import type { Stop } from "@shared/schema";

interface StopCardProps {
  stop: Stop;
  index: number;
  onDelete: (id: number) => void;
  onToggleComplete: (id: number) => void;
}

export function StopCard({ stop, index, onDelete, onToggleComplete }: StopCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-3" data-testid={`card-stop-${stop.id}`}>
      <Card className={cn(
        "p-4 flex items-center gap-4 transition-all duration-200 border-border/50 group bg-card/50 backdrop-blur-sm",
        stop.completed && "opacity-60 bg-muted/20"
      )}>
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground/50">
          <GripVertical className="h-5 w-5" />
        </div>

        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-muted-foreground border border-border">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={cn("font-medium truncate", stop.completed && "line-through text-muted-foreground")}>
            {stop.name}
          </h3>
          <div className="flex items-center text-xs text-muted-foreground mt-1 truncate">
            <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
            <span className="truncate">{stop.address}</span>
          </div>
          {stop.phone && (
            <div className="flex items-center text-xs text-muted-foreground mt-0.5 truncate">
              <Phone className="h-3 w-3 mr-1 flex-shrink-0" />
              <a href={`tel:${stop.phone}`} className="truncate hover:text-primary" data-testid={`link-phone-${stop.id}`}>{stop.phone}</a>
            </div>
          )}
          {stop.notes && (
            <div className="flex items-start text-xs text-amber-400/80 mt-0.5" data-testid={`text-notes-${stop.id}`}>
              <StickyNote className="h-3 w-3 mr-1 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2">{stop.notes}</span>
            </div>
          )}
          <div className={cn(
            "inline-flex items-center text-[10px] px-2 py-0.5 rounded-full mt-2 font-medium border",
            stop.paymentMethod === 'cod' 
              ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
              : "bg-green-500/10 text-green-500 border-green-500/20"
          )}>
            <DollarSign className="h-3 w-3 mr-1" />
            {stop.paymentMethod === 'cod' ? 'Barzahlung' : 'Bereits bezahlt'}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditOpen(true)}
            data-testid={`button-edit-${stop.id}`}
            className="h-8 w-8 rounded-full text-muted-foreground"
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleComplete(stop.id)}
            data-testid={`button-toggle-${stop.id}`}
            className={cn("h-8 w-8 rounded-full", stop.completed ? "text-green-500" : "text-muted-foreground")}
          >
            {stop.completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(stop.id)}
            data-testid={`button-delete-${stop.id}`}
            className="h-8 w-8 rounded-full text-muted-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <EditStopDialog stop={stop} open={editOpen} onOpenChange={setEditOpen} />
      </Card>
    </div>
  );
}
