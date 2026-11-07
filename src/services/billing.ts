import { computeRoomTaxRate, computeTotals, deriveInvoiceStatus } from '@/domain/billing';
import { nightsBetween, today } from '@/lib/dates';
import { round2 } from '@/lib/format';
import { DomainError } from '@/lib/validation';
import { repositories } from '@/repositories';
import type { ChargeKind, ID, Invoice, InvoiceLine, InvoiceTotals, Payment, PaymentMethod, Reservation } from '@/types/domain';
import { activityService, hotelService, newId } from './core';

export interface InvoiceView {
  invoice: Invoice;
  totals: InvoiceTotals;
  payments: Payment[];
}

async function refreshStatus(invoiceId: ID) {
  const invoice = await repositories.invoices.get(invoiceId);
  if (!invoice) return;
  const payments = await repositories.payments.list();
  const status = deriveInvoiceStatus(computeTotals(invoice, payments), invoice.status);
  if (status !== invoice.status) await repositories.invoices.update(invoiceId, { status });
}

export const billingService = {
  async listViews(): Promise<InvoiceView[]> {
    const [invoices, payments] = await Promise.all([repositories.invoices.list(), repositories.payments.list()]);
    const byInvoice = new Map<ID, Payment[]>();
    payments.forEach((p) => byInvoice.set(p.invoiceId, [...(byInvoice.get(p.invoiceId) ?? []), p]));
    return invoices
      .map((invoice) => {
        const own = byInvoice.get(invoice.id) ?? [];
        return { invoice, payments: own, totals: computeTotals(invoice, own) };
      })
      .sort((a, b) => b.invoice.number.localeCompare(a.invoice.number));
  },

  async view(invoiceId: ID): Promise<InvoiceView | null> {
    const invoice = await repositories.invoices.get(invoiceId);
    if (!invoice) return null;
    const payments = (await repositories.payments.list()).filter((p) => p.invoiceId === invoiceId);
    return { invoice, payments, totals: computeTotals(invoice, payments) };
  },

  async viewForReservation(reservationId: ID): Promise<InvoiceView | null> {
    const invoices = await repositories.invoices.list();
    const invoice = invoices.find((i) => i.reservationId === reservationId);
    return invoice ? billingService.view(invoice.id) : null;
  },

  /** Opens a folio for a booking, with its room charge as the first line. */
  async createForReservation(reservation: Reservation, categoryName: string): Promise<Invoice> {
    const hotel = await hotelService.get();
    const invoices = await repositories.invoices.list();
    const year = today().slice(0, 4);
    const nextSeq =
      invoices.reduce((max, inv) => Math.max(max, Number(inv.number.split('/').pop()) || 0), 0) + 1;
    const nights = nightsBetween(reservation.checkIn, reservation.checkOut);
    const invoice: Invoice = {
      id: newId('inv'),
      number: `${hotel.invoicePrefix}/${year}/${String(nextSeq).padStart(5, '0')}`,
      reservationId: reservation.id,
      guestId: reservation.guestId,
      status: 'unpaid',
      issuedOn: today(),
      lines: [
        {
          id: newId('line'),
          kind: 'room',
          description: `${categoryName} · ${nights} night${nights === 1 ? '' : 's'}`,
          date: reservation.checkIn,
          quantity: nights,
          unitPrice: reservation.ratePerNight,
          taxRate: computeRoomTaxRate(reservation.ratePerNight, hotel.tax),
          orderId: null,
        },
      ],
    };
    return repositories.invoices.create(invoice);
  },

  /** Keeps the room charge in step when a stay's dates or rate change. */
  async syncRoomCharge(reservation: Reservation, categoryName: string) {
    const invoices = await repositories.invoices.list();
    const invoice = invoices.find((i) => i.reservationId === reservation.id);
    if (!invoice) return;
    const hotel = await hotelService.get();
    const nights = nightsBetween(reservation.checkIn, reservation.checkOut);
    const lines = invoice.lines.map((line) =>
      line.kind === 'room' && !line.orderId
        ? {
            ...line,
            description: `${categoryName} · ${nights} night${nights === 1 ? '' : 's'}`,
            date: reservation.checkIn,
            quantity: nights,
            unitPrice: reservation.ratePerNight,
            taxRate: computeRoomTaxRate(reservation.ratePerNight, hotel.tax),
          }
        : line,
    );
    await repositories.invoices.update(invoice.id, { lines, guestId: reservation.guestId });
    await refreshStatus(invoice.id);
  },

  async voidForReservation(reservationId: ID) {
    const invoices = await repositories.invoices.list();
    const invoice = invoices.find((i) => i.reservationId === reservationId);
    if (invoice) await repositories.invoices.update(invoice.id, { status: 'void' });
  },

  async addCharge(
    invoiceId: ID,
    input: { kind: Exclude<ChargeKind, 'room'>; description: string; quantity: number; unitPrice: number; date?: string; orderId?: ID },
  ): Promise<void> {
    const invoice = await repositories.invoices.get(invoiceId);
    if (!invoice) throw new DomainError('Invoice not found.');
    if (invoice.status === 'void') throw new DomainError('This invoice has been voided and cannot be charged.');
    const { tax } = await hotelService.get();
    const line: InvoiceLine = {
      id: newId('line'),
      kind: input.kind,
      description: input.description,
      date: input.date ?? today(),
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      taxRate: input.kind === 'food' ? tax.foodRate : tax.serviceRate,
      orderId: input.orderId ?? null,
    };
    await repositories.invoices.update(invoiceId, { lines: [...invoice.lines, line] });
    await refreshStatus(invoiceId);
  },

  async removeCharge(invoiceId: ID, lineId: ID) {
    const invoice = await repositories.invoices.get(invoiceId);
    if (!invoice) throw new DomainError('Invoice not found.');
    const line = invoice.lines.find((l) => l.id === lineId);
    if (line?.kind === 'room') throw new DomainError('Room charges follow the booking. Edit the reservation to change them.');
    await repositories.invoices.update(invoiceId, { lines: invoice.lines.filter((l) => l.id !== lineId) });
    if (line?.orderId) {
      await repositories.restaurantOrders.update(line.orderId, { postedInvoiceId: null });
    }
    await refreshStatus(invoiceId);
  },

  async recordPayment(invoiceId: ID, input: { amount: number; method: PaymentMethod; reference: string }): Promise<void> {
    const view = await billingService.view(invoiceId);
    if (!view) throw new DomainError('Invoice not found.');
    if (view.invoice.status === 'void') throw new DomainError('This invoice has been voided.');
    if (input.amount <= 0) throw new DomainError('Enter an amount greater than zero.');
    if (round2(input.amount) > view.totals.balance) {
      throw new DomainError('That is more than the balance due on this invoice.');
    }
    await repositories.payments.create({
      id: newId('pay'),
      invoiceId,
      amount: round2(input.amount),
      method: input.method,
      reference: input.reference.trim(),
      receivedOn: today(),
    });
    await refreshStatus(invoiceId);
    await activityService.log(`Payment recorded on invoice ${view.invoice.number}`, 'success', `/app/billing?invoice=${invoiceId}`);
  },
};
