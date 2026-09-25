import { formatNaira, calculateDeposit } from '@primsett/utils';
import type { ServiceData } from '@/app/[slug]/page';

export function ServicePicker({
  services,
  onSelect,
}: {
  services: ServiceData[];
  onSelect: (svc: ServiceData) => void;
}) {
  return (
    <div className="space-y-4 pt-4">
      <h2 className="font-semibold text-lg">Choose a service</h2>
      <div className="space-y-2">
        {services.map((svc) => {
          const depositKobo = svc.requiresDeposit
            ? calculateDeposit(svc.basePriceKobo, svc.depositType, svc.depositValue)
            : 0;

          return (
            <button
              key={svc.id}
              onClick={() => onSelect(svc)}
              className="w-full text-left p-4 rounded-xl border border-border hover:border-primary hover:bg-accent/30 transition-colors min-h-[72px]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight">{svc.name}</p>
                  {svc.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {svc.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    ⏱ {svc.durationMinutes} mins
                    {depositKobo > 0 && ` · ${formatNaira(depositKobo)} deposit`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{formatNaira(svc.basePriceKobo)}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
