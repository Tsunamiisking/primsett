'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatLagosTime, lagosDateTimeToUTC } from '@primsett/utils';
import type { VendorPageData, ServiceData } from '@/app/[slug]/page';

const DAYS_AHEAD = 14;

function getDates(count: number): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function generateSlots(startTime: string, endTime: string, intervalMins: number): string[] {
  const slots: string[] = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let h = startH!;
  let m = startM!;
  const endTotal = endH! * 60 + endM!;

  while (h * 60 + m < endTotal) {
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    m += intervalMins;
    if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
  }
  return slots;
}

export function SlotPicker({
  vendor,
  service,
  onSelect,
  onBack,
}: {
  vendor: VendorPageData;
  service: ServiceData;
  onSelect: (isoSlot: string) => void;
  onBack: () => void;
}) {
  const dates = getDates(Math.min(DAYS_AHEAD, vendor.bookingAdvanceDays));
  const [selectedDate, setSelectedDate] = useState<Date>(dates[0]!);

  // For now, generate static slots — Phase 2 will fetch real availability from API
  const slots = generateSlots('09:00', '18:00', service.durationMinutes + vendor.bufferMinutes);

  const dayLabel = selectedDate.toLocaleDateString('en-NG', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'Africa/Lagos',
  });

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Pick a date &amp; time</h2>
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground min-h-[44px] px-2">
          ← Back
        </button>
      </div>

      {/* Date scroll */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {dates.map((date, i) => {
          const isSelected = date.toDateString() === selectedDate.toDateString();
          const day = date.toLocaleDateString('en-NG', { weekday: 'short', timeZone: 'Africa/Lagos' });
          const num = date.toLocaleDateString('en-NG', { day: 'numeric', timeZone: 'Africa/Lagos' });
          return (
            <button
              key={i}
              onClick={() => setSelectedDate(date)}
              className={`flex flex-col items-center min-w-[52px] py-2 px-3 rounded-xl border transition-colors shrink-0 min-h-[64px] ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:border-primary'
              }`}
            >
              <span className="text-xs">{day}</span>
              <span className="text-lg font-bold leading-tight">{num}</span>
            </button>
          );
        })}
      </div>

      {/* Time slots */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">{dayLabel}</p>
        <div className="grid grid-cols-3 gap-2">
          {slots.map((time) => {
            const utcDate = lagosDateTimeToUTC(
              selectedDate.toISOString().slice(0, 10)!,
              time,
            );
            const displayTime = formatLagosTime(utcDate);
            return (
              <button
                key={time}
                onClick={() => onSelect(utcDate.toISOString())}
                className="py-3 rounded-lg border border-border hover:border-primary hover:bg-accent/30 text-sm font-medium transition-colors min-h-[44px]"
              >
                {displayTime}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
