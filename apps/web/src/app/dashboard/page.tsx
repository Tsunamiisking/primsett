'use client';

import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatLagosDateTime, formatNaira } from '@primsett/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'secondary' | 'destructive' }> = {
  pending_deposit: { label: 'Awaiting deposit', variant: 'secondary' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  in_progress: { label: 'In progress', variant: 'default' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
  no_show: { label: 'No show', variant: 'destructive' },
};

export default function DashboardPage() {
  const { getToken } = useAuth();

  const { data: vendorRes } = useQuery({
    queryKey: ['vendor-me'],
    queryFn: async () => {
      const token = await getToken();
      return api.get<{ success: boolean; data: { vendor: { businessName: string; slug: string } } }>(
        '/api/v1/vendors/me',
        token ?? undefined,
      );
    },
  });

  const { data: bookingsRes } = useQuery({
    queryKey: ['vendor-bookings'],
    queryFn: async () => {
      const token = await getToken();
      return api.get<{ success: boolean; data: Array<{
        id: string;
        status: string;
        scheduledAt: string;
        totalPriceKobo: number;
        depositRequiredKobo: number;
      }> }>('/api/v1/vendors/me/bookings', token ?? undefined);
    },
  });

  const vendor = vendorRes?.data?.vendor;
  const bookings = bookingsRes?.data ?? [];
  const bookingLink = vendor ? `${process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'}/${vendor.slug}` : '';

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{vendor?.businessName ?? 'Your Dashboard'}</h1>
          <p className="text-sm text-muted-foreground">Upcoming bookings</p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/services">+ Service</Link>
        </Button>
      </div>

      {/* Booking link card */}
      {vendor && (
        <Card className="bg-accent/30 border-primary/20">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Your booking link</p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono flex-1 truncate text-primary">
                {bookingLink}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(bookingLink)}
              >
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bookings list */}
      <div className="space-y-3">
        {bookings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-4xl mb-2">📅</p>
            <p className="font-medium">No bookings yet</p>
            <p className="text-sm mt-1">Share your booking link to get started</p>
          </div>
        ) : (
          bookings.map((booking) => {
            const statusInfo = STATUS_LABELS[booking.status] ?? { label: booking.status, variant: 'secondary' as const };
            return (
              <Card key={booking.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">
                        {formatLagosDateTime(new Date(booking.scheduledAt))}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatNaira(booking.totalPriceKobo)} total
                        {booking.depositRequiredKobo > 0 && ` · ${formatNaira(booking.depositRequiredKobo)} deposit`}
                      </p>
                    </div>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
