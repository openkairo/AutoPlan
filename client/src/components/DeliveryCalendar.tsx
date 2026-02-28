import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Stop } from "@shared/schema";

interface DeliveryCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  viewMonth: Date;
  onViewMonthChange: (date: Date) => void;
  stops: Stop[];
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function DeliveryCalendar({ selectedDate, onSelectDate, viewMonth, onViewMonthChange, stops }: DeliveryCalendarProps) {
  const deliveryDatesMap = useMemo(() => {
    const map = new Map<string, number>();
    stops.forEach((stop) => {
      if (stop.deliveryDate) {
        const count = map.get(stop.deliveryDate) || 0;
        map.set(stop.deliveryDate, count + 1);
      }
    });
    return map;
  }, [stops]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [viewMonth]);

  const today = new Date();

  return (
    <div className="rounded-xl border border-border bg-card p-5 w-[420px]" data-testid="delivery-calendar">
      <div className="flex items-center justify-between mb-5">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={() => onViewMonthChange(subMonths(viewMonth, 1))}
          data-testid="button-prev-month"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="text-base font-bold text-foreground" data-testid="text-calendar-month">
          {format(viewMonth, "MMMM yyyy", { locale: de })}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={() => onViewMonthChange(addMonths(viewMonth, 1))}
          data-testid="button-next-month"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const deliveryCount = deliveryDatesMap.get(dateKey) || 0;
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          const isCurrentMonth = isSameMonth(day, viewMonth);

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(day)}
              data-testid={`calendar-day-${dateKey}`}
              className={cn(
                "relative flex flex-col items-center justify-center h-12 w-full rounded-xl text-sm transition-all",
                "hover:bg-primary/10 cursor-pointer",
                !isCurrentMonth && "text-muted-foreground/30",
                isCurrentMonth && "text-foreground",
                isToday && !isSelected && "ring-1 ring-primary/50 font-semibold",
                isSelected && "bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/30"
              )}
            >
              <span>{format(day, "d")}</span>
              {deliveryCount > 0 && isCurrentMonth && (
                <div className={cn(
                  "absolute bottom-1 flex gap-0.5",
                  isSelected ? "text-primary-foreground" : "text-primary"
                )}>
                  {deliveryCount <= 3 ? (
                    Array.from({ length: deliveryCount }).map((_, i) => (
                      <div key={i} className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isSelected ? "bg-primary-foreground" : "bg-primary"
                      )} />
                    ))
                  ) : (
                    <span className={cn(
                      "text-[9px] font-bold leading-none",
                      isSelected ? "text-primary-foreground" : "text-primary"
                    )}>{deliveryCount}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
