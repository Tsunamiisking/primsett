'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { OnboardingData } from '@/app/onboarding/page';

const AREAS = [
  'Lekki', 'Victoria Island', 'Surulere', 'Yaba', 'Ikeja',
  'Ajah', 'Maryland', 'Festac', 'Ikorodu', 'Other',
];

export function StepProfile({
  data,
  onNext,
}: {
  data: Partial<OnboardingData>;
  onNext: (d: Partial<OnboardingData>) => void;
}) {
  const [form, setForm] = useState({
    fullName: data.fullName ?? '',
    businessName: data.businessName ?? '',
    bio: data.bio ?? '',
    locationArea: data.locationArea ?? '',
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onNext(form);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Set up your profile</h2>
        <p className="mt-1 text-muted-foreground">This shows on your public booking page.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Your name</Label>
          <Input
            id="fullName"
            placeholder="Dami Okonkwo"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="businessName">Business name</Label>
          <Input
            id="businessName"
            placeholder="Dami Nails"
            value={form.businessName}
            onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="locationArea">Your area in Lagos</Label>
          <select
            id="locationArea"
            value={form.locationArea}
            onChange={(e) => setForm((f) => ({ ...f, locationArea: e.target.value }))}
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select area</option>
            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio">
            Short bio{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <textarea
            id="bio"
            placeholder="I specialise in nail art, acrylics and gel extensions. 4 years experience."
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            rows={3}
            maxLength={500}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
          />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={!form.fullName || !form.businessName}
      >
        Continue
      </Button>
    </form>
  );
}
