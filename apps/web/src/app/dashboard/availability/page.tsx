'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface AvailabilityRow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

type DayState = {
  isOpen: boolean;
  startTime: string;
  endTime: string;
};

const DEFAULT_HOURS = { startTime: '09:00', endTime: '18:00' };

function rowsToDayStates(rows: AvailabilityRow[]): DayState[] {
  return DAYS.map((_, dow) => {
    const row = rows.find((r) => r.dayOfWeek === dow);
    return row
      ? { isOpen: row.isAvailable, startTime: row.startTime, endTime: row.endTime }
      : { isOpen: false, startTime: DEFAULT_HOURS.startTime, endTime: DEFAULT_HOURS.endTime };
  });
}

export default function AvailabilityPage() {
  const { getToken } = useAuth();
  const [days, setDays] = useState<DayState[]>(
    DAYS.map(() => ({ isOpen: false, startTime: '09:00', endTime: '18:00' })),
  );
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: res, isLoading } = useQuery({
    queryKey: ['my-availability'],
    queryFn: async () => {
      const token = await getToken();
      return api.get<{ success: boolean; data: AvailabilityRow[] }>(
        '/api/v1/vendors/me/availability',
        token ?? undefined,
      );
    },
  });

  useEffect(() => {
    if (res?.data) {
      setDays(rowsToDayStates(res.data));
    }
  }, [res]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const payload = days
        .map((d, dow) => ({
          dayOfWeek: dow,
          startTime: d.startTime,
          endTime: d.endTime,
          isAvailable: d.isOpen,
        }))
        .filter((d) => d.isAvailable);
      return api.put('/api/v1/vendors/me/availability', payload, token ?? undefined);
    },
    onSuccess: () => {
      setError('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err: unknown) => {
      const msg = (err as { error?: { message?: string } })?.error?.message ?? 'Failed to save';
      setError(msg);
    },
  });

  function toggleDay(dow: number) {
    setDays((d) => {
      const next = [...d];
      next[dow] = { ...next[dow]!, isOpen: !next[dow]!.isOpen };
      return next;
    });
  }

  function updateTime(dow: number, key: 'startTime' | 'endTime', val: string) {
    setDays((d) => {
      const next = [...d];
      next[dow] = { ...next[dow]!, [key]: val };
      return next;
    });
  }

  if (isLoading) {
    return <div className="p-4 max-w-2xl mx-auto text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Working hours</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Set when you're available to accept bookings</p>
        </div>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save hours'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {DAYS.map((dayName, dow) => {
          const day = days[dow]!;
          return (
            <Card key={dow} className={day.isOpen ? '' : 'opacity-60'}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`day-${dow}`}
                    checked={day.isOpen}
                    onChange={() => toggleDay(dow)}
                    className="h-4 w-4 accent-primary shrink-0"
                  />
                  <Label htmlFor={`day-${dow}`} className="w-24 shrink-0 font-medium">
                    {dayName.slice(0, 3)}
                  </Label>

                  {day.isOpen ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={day.startTime}
                        onChange={(e) => updateTime(dow, 'startTime', e.target.value)}
                        className="w-32 text-sm"
                      />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input
                        type="time"
                        value={day.endTime}
                        onChange={(e) => updateTime(dow, 'endTime', e.target.value)}
                        className="w-32 text-sm"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Closed</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        All times are in Lagos time (WAT, UTC+1). Clients see availability in their local timezone.
      </p>
    </div>
  );
}
