import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import type { VendorPageData } from '@/app/[slug]/page';

export function VendorHeader({ vendor }: { vendor: VendorPageData }) {
  return (
    <div className="px-4 pt-6 pb-4 border-b">
      <div className="flex items-center gap-3">
        {vendor.avatarUrl ? (
          <Image
            src={vendor.avatarUrl}
            alt={vendor.businessName}
            width={56}
            height={56}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-2xl">
            💅
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg leading-tight truncate">{vendor.businessName}</h1>
          {vendor.locationArea && (
            <p className="text-sm text-muted-foreground">
              📍 {vendor.locationArea}
            </p>
          )}
          {vendor.avgRating && (
            <p className="text-sm text-muted-foreground">
              ⭐ {parseFloat(vendor.avgRating).toFixed(1)} · {vendor.totalClientsServed} clients
            </p>
          )}
        </div>
      </div>
      {vendor.bio && (
        <p className="mt-3 text-sm text-muted-foreground">{vendor.bio}</p>
      )}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {vendor.serviceTypes.map((type) => (
          <Badge key={type} variant="secondary" className="text-xs">{type}</Badge>
        ))}
      </div>
    </div>
  );
}
