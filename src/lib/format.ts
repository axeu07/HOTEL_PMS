const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** Whole-rupee price, e.g. "₹6,800". */
export function money(value: number): string {
  return formatter.format(value);
}
