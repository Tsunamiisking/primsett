'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { StepProfile } from '@/components/onboarding/step-profile';
import { StepWorkType } from '@/components/onboarding/step-work-type';
import { StepWorkStyle } from '@/components/onboarding/step-work-style';
import { StepPayment } from '@/components/onboarding/step-payment';
import { api } from '@/lib/api';

export type OnboardingData = {
  // Step: profile
  fullName: string;
  businessName: string;
  bio: string;
  locationArea: string;
  // Screen 1: service types
  serviceTypes: string[];
  staffCount: 'just_me' | '2_5' | '6_plus' | null;
  // Screen 2: work style + price range
  locationType: 'fixed' | 'mobile' | 'both';
  locationText: string;
  priceMinKobo: number;
  priceMaxKobo: number;
  // Screen 3: payment + policy
  depositHabit: 'always' | 'sometimes' | 'not_yet';
  cancellationPolicyType: 'written' | 'informal' | 'none';
};

const STEPS = ['profile', 'work-type', 'work-style', 'payment'] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<Partial<OnboardingData>>({
    locationType: 'fixed',
    serviceTypes: [],
    staffCount: null,
    priceMinKobo: 0,
    priceMaxKobo: 0,
  });

  const currentStep = STEPS[step];
  const progress = Math.round((step / STEPS.length) * 100);

  function update(partial: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  function next(partial?: Partial<OnboardingData>) {
    if (partial) update(partial);
    setStep((s) => s + 1);
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit(finalPartial: Partial<OnboardingData>) {
    const finalData = { ...data, ...finalPartial } as OnboardingData;
    setSubmitting(true);
    try {
      const token = await getToken();
      await api.post('/api/v1/vendors/onboard', finalData, token ?? undefined);
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {currentStep === 'profile' && (
            <StepProfile data={data} onNext={(d) => next(d)} />
          )}
          {currentStep === 'work-type' && (
            <StepWorkType data={data} onNext={(d) => next(d)} onBack={back} />
          )}
          {currentStep === 'work-style' && (
            <StepWorkStyle data={data} onNext={(d) => next(d)} onBack={back} />
          )}
          {currentStep === 'payment' && (
            <StepPayment
              data={data}
              onSubmit={(d) => submit(d)}
              onBack={back}
              submitting={submitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
