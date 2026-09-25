'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toKobo } from '@primsett/utils';
import type { OnboardingData } from '@/app/onboarding/page';

const LOCATION_OPTIONS: Array<{
  id: string;
  locationType: OnboardingData['locationType'];
  label: string;
}> = [
  { id: 'home_studio', locationType: 'fixed', label: 'My home studio' },
  { id: 'rented_space', locationType: 'fixed', label: 'A rented space or salon' },
  { id: 'mobile', locationType: 'mobile', label: 'I go to my clients' },
  { id: 'both', locationType: 'both', label: 'Both — I have a base but also visit clients' },
];

export function StepWorkStyle({
  data,
  onNext,
  onBack,
}: {
  data: Partial<OnboardingData>;
  onNext: (d: Partial<OnboardingData>) => void;
  onBack: () => void;
}) {
  const [locationId, setLocationId] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  const canSubmit =
    locationId &&
    priceMin &&
    priceMax &&
    parseFloat(priceMin) > 0 &&
    parseFloat(priceMax) >= parseFloat(priceMin);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const opt = LOCATION_OPTIONS.find((o) => o.id === locationId)!;
    onNext({
      locationType: opt.locationType,
      locationText: opt.label,
      priceMinKobo: toKobo(parseFloat(priceMin)),
      priceMaxKobo: toKobo(parseFloat(priceMax)),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">How you work</h2>
      </div>

      {/* Block A */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Where do you work?</p>
        <div className="space-y-2">
          {LOCATION_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setLocationId(opt.id)}
              className={cn(
                'w-full flex items-center gap-3 p-4 rounded-xl border text-left text-sm transition-colors',
                locationId === opt.id
                  ? 'border-primary bg-primary/5 font-medium'
                  : 'border-border hover:border-primary/50',
              )}
            >
              <span
                className={cn(
                  'h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors',
                  locationId === opt.id ? 'border-primary' : 'border-input',
                )}
              >
                {locationId === opt.id && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Block B */}
      <div className="space-y-3">
        <p className="text-sm font-medium">What's your price range per service?</p>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              ₦
            </span>
            <Input
              type="number"
              placeholder="5,000"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              className="pl-7"
              min="0"
            />
          </div>
          <span className="text-muted-foreground text-sm shrink-0">to</span>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              ₦
            </span>
            <Input
              type="number"
              placeholder="50,000"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              className="pl-7"
              min="0"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Shown on your public page. You set exact prices per service after setup.
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={!canSubmit}>
          Continue
        </Button>
      </div>
    </form>
  );
}
