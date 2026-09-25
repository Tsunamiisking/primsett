'use client';

import { useState } from 'react';
import { VendorHeader } from './vendor-header';
import { ServicePicker } from './service-picker';
import { SlotPicker } from './slot-picker';
import { ClientForm } from './client-form';
import type { VendorPageData, ServiceData } from '@/app/[slug]/page';
import { api } from '@/lib/api';

type Step = 'services' | 'slots' | 'details' | 'paying';

export function BookingFlow({ vendor }: { vendor: VendorPageData }) {
  const [step, setStep] = useState<Step>('services');
  const [selectedService, setSelectedService] = useState<ServiceData | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDetailsSubmit(details: {
    clientName: string;
    clientPhone: string;
    intakeResponses: Array<{ question_id: string; answer: string | string[] | boolean }>;
  }) {
    if (!selectedService || !selectedSlot) return;
    setStep('paying');
    setError(null);

    try {
      const res = await api.post<{
        success: boolean;
        data: { bookingId: string; paymentUrl?: string; status: string };
      }>('/api/v1/bookings', {
        vendorSlug: vendor.slug,
        serviceId: selectedService.id,
        scheduledAt: selectedSlot,
        ...details,
        callbackUrl: `${window.location.origin}/book/confirm`,
      });

      if (res.data.paymentUrl) {
        // Redirect to Paystack
        window.location.href = res.data.paymentUrl;
      } else {
        // No deposit required — go straight to confirm
        window.location.href = `/book/confirm?booking=${res.data.bookingId}`;
      }
    } catch (err: unknown) {
      const e = err as { error?: { message?: string } };
      setError(e?.error?.message ?? 'Something went wrong. Please try again.');
      setStep('details');
    }
  }

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto">
      <VendorHeader vendor={vendor} />

      <div className="flex-1 px-4 pb-8">
        {step === 'services' && (
          <ServicePicker
            services={vendor.services}
            onSelect={(svc) => {
              setSelectedService(svc);
              setStep('slots');
            }}
          />
        )}

        {step === 'slots' && selectedService && (
          <SlotPicker
            vendor={vendor}
            service={selectedService}
            onSelect={(slot) => {
              setSelectedSlot(slot);
              setStep('details');
            }}
            onBack={() => setStep('services')}
          />
        )}

        {step === 'details' && selectedService && selectedSlot && (
          <ClientForm
            service={selectedService}
            slot={selectedSlot}
            onSubmit={handleDetailsSubmit}
            onBack={() => setStep('slots')}
            error={error}
          />
        )}

        {step === 'paying' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Redirecting to payment…</p>
          </div>
        )}
      </div>
    </div>
  );
}
