"use client";

import * as React from "react";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTimezone } from "@/context/TimezoneContext";

// Format date in the specified timezone (compact format)
function formatDateInTimezone(date: Date, timezone: string, compact = false): string {
  if (compact) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: timezone,
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  }).format(date);
}

interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
  id,
}: DatePickerProps) {
  const { timezone } = useTimezone();
  const [open, setOpen] = React.useState(false);

  const handleSelect = (date: Date | undefined) => {
    onChange(date);
    setOpen(false);
  };

  const displayValue = value ? formatDateInTimezone(value, timezone) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          data-empty={!value}
          className={cn(
            "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{displayValue || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleSelect}
          timeZone={timezone}
        />
      </PopoverContent>
    </Popover>
  );
}

// Generate hours array (00-23)
const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
// Generate minutes array (00-59, every 5 minutes for easier selection)
const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"));

// DateTimePicker - includes hour/minute selects under the calendar
interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  time?: string;
  onTimeChange?: (time: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  showTime?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  time = "",
  onTimeChange,
  placeholder = "Pick a date & time",
  disabled,
  className,
  id,
  showTime = true,
}: DateTimePickerProps) {
  const { timezone, getTimezoneOffset } = useTimezone();
  const [open, setOpen] = React.useState(false);

  // Parse time into hour and minute
  const [hour, minute] = React.useMemo(() => {
    if (!time) return ["", ""];
    const parts = time.split(":");
    return [parts[0] || "", parts[1] || ""];
  }, [time]);

  const handleSelect = (date: Date | undefined) => {
    onChange(date);
  };

  const handleHourChange = (newHour: string) => {
    const newMinute = minute || "00";
    onTimeChange?.(`${newHour}:${newMinute}`);
  };

  const handleMinuteChange = (newMinute: string) => {
    const newHour = hour || "12";
    onTimeChange?.(`${newHour}:${newMinute}`);
  };

  const displayValue = React.useMemo(() => {
    if (!value) return null;
    const dateStr = formatDateInTimezone(value, timezone, true);
    if (time && hour && minute) {
      return `${dateStr}, ${hour}:${minute}`;
    }
    return dateStr;
  }, [value, time, hour, minute, timezone]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          data-empty={!value}
          className={cn(
            "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{displayValue || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleSelect}
          timeZone={timezone}
        />
        {showTime && (
          <div className="border-t p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Time</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {timezone === "UTC" ? "UTC" : `${timezone.split("/").pop()} (${getTimezoneOffset()})`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={hour} onValueChange={handleHourChange}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue placeholder="HH" />
                </SelectTrigger>
                <SelectContent>
                  {hours.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-lg font-medium">:</span>
              <Select value={minute} onValueChange={handleMinuteChange}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent>
                  {minutes.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// DatePicker with label and timezone indicator
interface DatePickerWithLabelProps extends DatePickerProps {
  label: string;
  required?: boolean;
  showTimezone?: boolean;
}

export function DatePickerWithLabel({
  label,
  required,
  showTimezone = true,
  ...props
}: DatePickerWithLabelProps) {
  const { timezone, getTimezoneOffset } = useTimezone();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        {showTimezone && (
          <span className="text-xs text-muted-foreground">
            {timezone === "UTC" ? "UTC" : `${timezone.split("/").pop()} (${getTimezoneOffset()})`}
          </span>
        )}
      </div>
      <DatePicker {...props} />
    </div>
  );
}
