'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OnboardingData } from '@/app/onboarding/page';

const SERVICE_OPTIONS = [
  { id: 'Nails & lash', label: 'Nails & lash' },
  { id: 'Makeup', label: 'Makeup' },
  { id: 'Hair', label: 'Hair' },
  { id: 'Salon / studio', label: 'Salon / studio', sub: 'Multi-staff, fixed location' },
];

const STAFF_OPTIONS = [
  { id: 'just_me', label: 'Just me' },
  { id: '2_5', label: '2–5 staff' },
  { id: '6_plus', label: '6 or more' },
];

export function StepWorkType({
  data,
  onNext,
  onBack,
}: {
  data: Partial<OnboardingData>;
  onNext: (d: Partial<OnboardingData>) => void;
  onBack: () => void;
}) {
  const [serviceTypes, setServiceTypes] = useState<string[]>(data.serviceTypes ?? []);
  const [staffCount, setStaffCount] = useState<string | null>(data.staffCount ?? null);

  const hasStudio = serviceTypes.includes('Salon / studio');

  function toggleService(id: string) {
    setServiceTypes((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      if (!next.includes('Salon / studio')) setStaffCount(null);
      return next;
    });
  }

  const canContinue = serviceTypes.length > 0 && (!hasStudio || staffCount !== null);

  function submit() {
    if (!canContinue) return;
    onNext({
      serviceTypes,
      staffCount: (staffCount as OnboardingData['staffCount']) ?? null,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">What kind of work do you do?</h2>
        <p className="mt-1 text-muted-foreground">Select all that apply.</p>
      </div>

      <div className="space-y-2">
        {SERVICE_OPTIONS.map((opt) => (
          <div key={opt.id}>
            <button
              type="button"
              onClick={() => toggleService(opt.id)}
              className={cn(
                'w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-colors',
                serviceTypes.includes(opt.id)
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50',
              )}
            >
              <span
                className={cn(
                  'h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors',
                  serviceTypes.includes(opt.id)
                    ? 'bg-primary border-primary'
                    : 'border-input',
                )}
              >
                {serviceTypes.includes(opt.id) && (
                  <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 12 12">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <div>
                <div className="font-medium text-sm">{opt.label}</div>
                {opt.sub && <div className="text-xs text-muted-foreground">{opt.sub}</div>}
              </div>
            </button>

            {opt.id === 'Salon / studio' && hasStudio && (
              <div className="mt-2 ml-4 pl-4 border-l-2 border-primary/20 space-y-2">
                <p className="text-sm text-muted-foreground">How many people work with you?</p>
                <div className="grid grid-cols-3 gap-2">
                  {STAFF_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStaffCount(s.id)}
                      className={cn(
                        'py-2.5 rounded-lg border text-sm transition-colors',
                        staffCount === s.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:border-primary/50',
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button type="button" className="flex-1" disabled={!canContinue} onClick={submit}>
          Continue
        </Button>
      </div>
    </div>
  );
}
