'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatLagosDateTime, formatNaira, calculateDeposit } from '@primsett/utils';
import type { ServiceData } from '@/app/[slug]/page';

export function ClientForm({
  service,
  slot,
  onSubmit,
  onBack,
  error,
}: {
  service: ServiceData;
  slot: string;
  onSubmit: (data: {
    clientName: string;
    clientPhone: string;
    intakeResponses: Array<{ question_id: string; answer: string | string[] | boolean }>;
  }) => void;
  onBack: () => void;
  error: string | null;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const depositKobo = service.requiresDeposit
    ? calculateDeposit(service.basePriceKobo, service.depositType, service.depositValue)
    : 0;

  const slotDate = new Date(slot);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ clientName: name, clientPhone: phone, intakeResponses: [] });
  }

  return (
    <form onSubmit={submit} className="space-y-5 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Your details</h2>
        <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground min-h-[44px] px-2">
          ← Back
        </button>
      </div>

      {/* Booking summary */}
      <div className="p-4 rounded-xl bg-accent/30 space-y-1">
        <p className="text-sm font-semibold">{service.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatLagosDateTime(slotDate)}
        </p>
        <p className="text-sm text-muted-foreground">
          {service.durationMinutes} mins · {formatNaira(service.basePriceKobo)} total
        </p>
        {depositKobo > 0 && (
          <p className="text-sm font-medium text-primary mt-1">
            Deposit required: {formatNaira(depositKobo)}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="clientName">Your name</Label>
          <Input
            id="clientName"
            placeholder="Chiamaka Obi"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="clientPhone">WhatsApp number</Label>
          <Input
            id="clientPhone"
            type="tel"
            placeholder="08012345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            required
          />
          <p className="text-xs text-muted-foreground">
            We&apos;ll send your confirmation and reminders here.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={!name || !phone}>
        {depositKobo > 0
          ? `Pay ${formatNaira(depositKobo)} deposit to confirm`
          : 'Confirm booking'}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        By booking you agree to the vendor&apos;s cancellation policy.
      </p>
    </form>
  );
}
