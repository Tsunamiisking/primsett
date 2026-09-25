'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OnboardingData } from '@/app/onboarding/page';

const DEPOSIT_OPTIONS: Array<{ id: OnboardingData['depositHabit']; label: string }> = [
  { id: 'always', label: 'Yes, always' },
  { id: 'sometimes', label: 'Sometimes' },
  { id: 'not_yet', label: 'No — I want to start' },
];

const POLICY_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'written', label: 'Yes, written and I send it out' },
  { id: 'informal', label: "Kind of — it's in my head" },
  { id: 'none', label: 'Not really, I handle it case by case' },
];

export function StepPayment({
  onSubmit,
  onBack,
  submitting,
}: {
  data: Partial<OnboardingData>;
  onSubmit: (d: Partial<OnboardingData>) => void;
  onBack: () => void;
  submitting: boolean;
}) {
  const [depositHabit, setDepositHabit] = useState<OnboardingData['depositHabit'] | ''>('');
  const [cancellationPolicyType, setCancellationPolicyType] = useState('');

  const showCancellationQ = depositHabit === 'always' || depositHabit === 'sometimes';
  const isNotYet = depositHabit === 'not_yet';
  const canSubmit = depositHabit && (isNotYet || cancellationPolicyType);

  function submit() {
    if (!canSubmit || !depositHabit) return;
    onSubmit({
      depositHabit,
      cancellationPolicyType: (isNotYet ? 'none' : cancellationPolicyType) as OnboardingData['cancellationPolicyType'],
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Payment and policy</h2>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Do you collect payment before appointments?</p>
        <div className="space-y-2">
          {DEPOSIT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setDepositHabit(opt.id);
                if (opt.id === 'not_yet') setCancellationPolicyType('');
              }}
              className={cn(
                'w-full flex items-center gap-3 p-4 rounded-xl border text-left text-sm transition-colors',
                depositHabit === opt.id
                  ? 'border-primary bg-primary/5 font-medium'
                  : 'border-border hover:border-primary/50',
              )}
            >
              <span
                className={cn(
                  'h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
                  depositHabit === opt.id ? 'border-primary bg-primary' : 'border-input',
                )}
              />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isNotYet && (
        <p className="text-sm text-muted-foreground rounded-xl border border-border p-4">
          No problem — we'll set up a simple deposit and cancellation policy together once you're in.
        </p>
      )}

      {showCancellationQ && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Do you have a cancellation policy?</p>
          <div className="space-y-2">
            {POLICY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCancellationPolicyType(opt.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-4 rounded-xl border text-left text-sm transition-colors',
                  cancellationPolicyType === opt.id
                    ? 'border-primary bg-primary/5 font-medium'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <span
                  className={cn(
                    'h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
                    cancellationPolicyType === opt.id ? 'border-primary bg-primary' : 'border-input',
                  )}
                />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={!canSubmit || submitting}
          onClick={submit}
        >
          {submitting ? 'Setting up your account…' : 'Get my booking link'}
        </Button>
      </div>
    </div>
  );
}
