'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { api } from '@/lib/api';
import { formatLagosDateTime, formatNaira } from '@primsett/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

function ConfirmContent() {
  const params = useSearchParams();
  const ref = params.get('ref');
  const bookingId = params.get('booking');

  const [status, setStatus] = useState<'loading' | 'success' | 'pending' | 'error'>('loading');
  const [booking, setBooking] = useState<{
    scheduledAt: string;
    totalPriceKobo: number;
    depositRequiredKobo: number;
    status: string;
  } | null>(null);

  useEffect(() => {
    const id = bookingId ?? ref; // ref from Paystack callback, booking from no-deposit flow
    if (!id) { setStatus('error'); return; }

    api.get<{ success: boolean; data: typeof booking }>(`/api/v1/bookings/${id}`)
      .then((res) => {
        setBooking(res.data);
        setStatus(res.data?.status === 'confirmed' ? 'success' : 'pending');
      })
      .catch(() => setStatus('error'));
  }, [ref, bookingId]);

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Confirming your booking…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-4xl">😕</p>
        <p className="font-medium">Something went wrong</p>
        <p className="text-sm text-muted-foreground">We couldn&apos;t find your booking. Please contact the vendor directly.</p>
      </div>
    );
  }

  return (
    <div className="text-center space-y-6 py-12">
      <div className="text-5xl">{status === 'success' ? '🎉' : '⏳'}</div>

      <div>
        <h1 className="text-2xl font-bold">
          {status === 'success' ? 'You\'re booked!' : 'Payment processing…'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {status === 'success'
            ? 'Check your WhatsApp for confirmation and reminders.'
            : 'Your payment is being processed. You\'ll get a WhatsApp message when it\'s confirmed.'}
        </p>
      </div>

      {booking && (
        <div className="p-4 rounded-xl bg-accent/30 text-left space-y-1 max-w-sm mx-auto">
          <p className="text-sm font-medium">
            📅 {formatLagosDateTime(new Date(booking.scheduledAt))}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatNaira(booking.totalPriceKobo)} total
            {booking.depositRequiredKobo > 0 && ` · ${formatNaira(booking.depositRequiredKobo)} paid`}
          </p>
        </div>
      )}

      <Button asChild variant="outline">
        <Link href="/">Back to Primsett</Link>
      </Button>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <div className="max-w-lg mx-auto px-4">
      <Suspense fallback={
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      }>
        <ConfirmContent />
      </Suspense>
    </div>
  );
}
