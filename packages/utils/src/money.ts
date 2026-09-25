/** All money is stored as integer kobo. ₦1 = 100 kobo. Never use floats. */

export type Kobo = number;

export const toKobo = (naira: number): Kobo => Math.round(naira * 100);

export const toNaira = (kobo: Kobo): number => kobo / 100;

export const formatNaira = (kobo: Kobo): string =>
  `₦${toNaira(kobo).toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

/** Calculate deposit amount from service deposit settings. */
export function calculateDeposit(
  basePriceKobo: Kobo,
  depositType: 'fixed' | 'percentage',
  depositValue: number,
): Kobo {
  if (depositType === 'fixed') return depositValue;
  // depositValue is in basis points: 3000 = 30%
  return Math.round((basePriceKobo * depositValue) / 10000);
}

/** Apply platform fee (currently 2.5%). Returns fee in kobo. */
export function platformFee(amountKobo: Kobo): Kobo {
  return Math.round(amountKobo * 0.025);
}
