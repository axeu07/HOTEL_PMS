import { round2 } from '@/lib/format';
import type { Invoice, InvoiceStatus, InvoiceTotals, Payment, TaxConfig } from '@/types/domain';

/** Pure money rules, with no storage or UI, so they can move server-side unchanged. */

export function computeRoomTaxRate(ratePerNight: number, tax: TaxConfig): number {
  return ratePerNight <= tax.roomThreshold ? tax.roomLowRate : tax.roomHighRate;
}

export function computeTotals(invoice: Invoice, payments: Payment[]): InvoiceTotals {
  let roomSubtotal = 0;
  let foodSubtotal = 0;
  let serviceSubtotal = 0;
  let tax = 0;
  for (const line of invoice.lines) {
    const amount = line.quantity * line.unitPrice;
    if (line.kind === 'room') roomSubtotal += amount;
    else if (line.kind === 'food') foodSubtotal += amount;
    else serviceSubtotal += amount;
    tax += (amount * line.taxRate) / 100;
  }
  const subtotal = roomSubtotal + foodSubtotal + serviceSubtotal;
  const total = round2(subtotal + tax);
  const paid = round2(payments.filter((p) => p.invoiceId === invoice.id).reduce((sum, p) => sum + p.amount, 0));
  return {
    roomSubtotal,
    foodSubtotal,
    serviceSubtotal,
    subtotal,
    tax: round2(tax),
    total,
    paid,
    balance: round2(total - paid),
  };
}

export function deriveInvoiceStatus(totals: InvoiceTotals, current: InvoiceStatus): InvoiceStatus {
  if (current === 'void') return 'void';
  if (totals.total > 0 && totals.balance <= 0) return 'paid';
  return totals.paid > 0 ? 'partial' : 'unpaid';
}

/** Tax on a line, split by rate, for the summary block on a printed invoice. */
export function taxByRate(invoice: Invoice): { rate: number; taxable: number; tax: number }[] {
  const groups = new Map<number, { taxable: number; tax: number }>();
  for (const line of invoice.lines) {
    const amount = line.quantity * line.unitPrice;
    const group = groups.get(line.taxRate) ?? { taxable: 0, tax: 0 };
    group.taxable += amount;
    group.tax += (amount * line.taxRate) / 100;
    groups.set(line.taxRate, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, g]) => ({ rate, taxable: g.taxable, tax: round2(g.tax) }));
}
