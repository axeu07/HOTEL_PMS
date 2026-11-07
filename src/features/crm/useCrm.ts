import { useMemo } from 'react';
import { buildOccasionRows } from '@/domain/occasions';
import { buildStayedGuests, leadRevenue } from '@/domain/customers';
import { useResource } from '@/hooks/useResource';
import { today } from '@/lib/dates';
import { billingService, communicationService, guestService, occasionService, leadService, reservationService, roomService, staffService, templateService } from '@/services';

/** Everything the customer screens and the dashboard share, loaded once and indexed. */
export function useCrm() {
  const { data } = useResource(async () => {
    const [leads, guests, reservations, invoices, categories, staff, templates, communications, occasions] = await Promise.all([
      leadService.list(),
      guestService.list(),
      reservationService.list(),
      billingService.listViews(),
      roomService.categories(),
      staffService.list(),
      templateService.list(),
      communicationService.list(),
      occasionService.list(),
    ]);
    return { leads, guests, reservations, invoices, categories, staff, templates, communications, occasions };
  });

  return useMemo(() => {
    if (!data) return null;
    const now = today();
    const billed = new Map<string, number>();
    data.invoices.forEach((v) => {
      if (v.invoice.status !== 'void') billed.set(v.invoice.reservationId, (billed.get(v.invoice.reservationId) ?? 0) + v.totals.total);
    });
    const reservationById = new Map(data.reservations.map((r) => [r.id, r]));
    const categoryById = new Map(data.categories.map((c) => [c.id, c]));
    const staffById = new Map(data.staff.map((s) => [s.id, s]));
    const guestById = new Map(data.guests.map((g) => [g.id, g]));
    const stayed = buildStayedGuests(data.guests, data.reservations, data.invoices, now);
    const occasionRows = buildOccasionRows(data.occasions, data.guests, data.reservations, now);
    const revenueOf = (lead: (typeof data.leads)[number]) => leadRevenue(lead, lead.reservationId ? reservationById.get(lead.reservationId) : undefined, billed);
    return { ...data, now, billed, reservationById, categoryById, staffById, guestById, stayed, occasionRows, revenueOf };
  }, [data]);
}

export type Crm = NonNullable<ReturnType<typeof useCrm>>;
