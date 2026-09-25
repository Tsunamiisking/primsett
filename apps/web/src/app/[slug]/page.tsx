import { notFound } from 'next/navigation';
import { BookingFlow } from '@/components/booking/booking-flow';
import type { Metadata } from 'next';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function getVendor(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/vendors/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json() as { success: boolean; data: VendorPageData };
    return json.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const vendor = await getVendor(params.slug);
  if (!vendor) return { title: 'Not found' };
  return {
    title: `Book with ${vendor.businessName} — Primsett`,
    description: vendor.bio ?? `Book an appointment with ${vendor.businessName}.`,
  };
}

export type VendorPageData = {
  id: string;
  businessName: string;
  slug: string;
  bio: string | null;
  serviceTypes: string[];
  locationType: string;
  locationText: string | null;
  locationArea: string | null;
  avgRating: string | null;
  totalClientsServed: number;
  calendarMode: string;
  bufferMinutes: number;
  bookingAdvanceDays: number;
  ownerName: string;
  avatarUrl: string | null;
  services: ServiceData[];
};

export type ServiceData = {
  id: string;
  name: string;
  description: string | null;
  basePriceKobo: number;
  durationMinutes: number;
  requiresDeposit: boolean;
  depositType: 'fixed' | 'percentage';
  depositValue: number;
  variants: object[];
  addons: object[];
};

export default async function VendorBookingPage({ params }: { params: { slug: string } }) {
  const vendor = await getVendor(params.slug);
  if (!vendor) notFound();

  return <BookingFlow vendor={vendor} />;
}
