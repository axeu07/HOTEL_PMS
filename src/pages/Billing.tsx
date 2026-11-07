import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { INVOICE_STATUS } from '@/app/labels';
import { Badge, DataTable, EmptyState, PageHead, PageLoading, Panel, SearchInput, StatCard, StatGrid, type Column } from '@/components/ui';
import { BillShareButtons } from '@/features/BillShare';
import { InvoiceModal } from '@/features/InvoiceModal';
import { useLookups } from '@/features/useLookups';
import { useResource } from '@/hooks/useResource';
import { today } from '@/lib/dates';
import { fmtDate, money, moneyCompact } from '@/lib/format';
import { billingService, guestName, type InvoiceView } from '@/services';

export default function Billing() {
  const lookups = useLookups();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const { data: views } = useResource(() => billingService.listViews());
  const openId = params.get('invoice');

  const stats = useMemo(() => {
    const live = (views ?? []).filter((v) => v.invoice.status !== 'void');
    const now = today();
    const collectedToday = live.flatMap((v) => v.payments).filter((p) => p.receivedOn === now).reduce((s, p) => s + p.amount, 0);
    // Upcoming stays carry a folio before arrival; "outstanding" means guests who have arrived.
    const started = live.filter((v) => {
      const reservation = lookups?.reservations.find((r) => r.id === v.invoice.reservationId);
      return reservation && ['checked_in', 'checked_out'].includes(reservation.status);
    });
    const outstanding = started.reduce((s, v) => s + Math.max(0, v.totals.balance), 0);
    return {
      collectedToday,
      outstanding,
      openCount: started.filter((v) => v.totals.balance > 0).length,
      invoiced: live.reduce((s, v) => s + v.totals.total, 0),
      paid: live.reduce((s, v) => s + v.totals.paid, 0),
    };
  }, [views, lookups]);

  const rows = useMemo(() => {
    if (!views || !lookups) return [];
    const q = query.trim().toLowerCase();
    return views.filter((v) => {
      if (status && v.invoice.status !== status) return false;
      if (dueOnly && v.totals.balance <= 0) return false;
      if (q) {
        const guest = guestName(lookups.guestById.get(v.invoice.guestId));
        const code = lookups.reservations.find((r) => r.id === v.invoice.reservationId)?.code ?? '';
        if (!`${guest} ${v.invoice.number} ${code}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [views, lookups, query, status, dueOnly]);

  if (!views || !lookups) return <PageLoading />;

  const columns: Column<InvoiceView>[] = [
    {
      key: 'number',
      header: 'Invoice',
      primary: true,
      sort: (v) => v.invoice.number,
      render: (v) => (
        <>
          <div className="cell-title">{v.invoice.number}</div>
          <div className="cell-sub">{guestName(lookups.guestById.get(v.invoice.guestId))}</div>
        </>
      ),
    },
    { key: 'issued', header: 'Issued', sort: (v) => v.invoice.issuedOn, render: (v) => <span className="nowrap">{fmtDate(v.invoice.issuedOn)}</span> },
    { key: 'tax', header: 'Tax', num: true, hideOnMobile: true, render: (v) => money(v.totals.tax) },
    { key: 'total', header: 'Total', num: true, sort: (v) => v.totals.total, render: (v) => money(v.totals.total) },
    { key: 'balance', header: 'Balance', num: true, sort: (v) => v.totals.balance, render: (v) => <span className={v.totals.balance > 0 ? 'strong' : 'muted'} style={v.totals.balance > 0 ? { color: 'var(--warn)' } : undefined}>{money(Math.max(0, v.totals.balance))}</span> },
    { key: 'status', header: 'Status', sort: (v) => v.invoice.status, render: (v) => <Badge tone={INVOICE_STATUS[v.invoice.status].tone}>{INVOICE_STATUS[v.invoice.status].label}</Badge> },
    {
      key: 'share',
      header: 'Send',
      actions: true,
      render: (v) => {
        const stay = lookups.reservations.find((r) => r.id === v.invoice.reservationId);
        return <BillShareButtons view={v} guest={lookups.guestById.get(v.invoice.guestId)} stay={stay} size="sm" />;
      },
    },
  ];

  return (
    <>
      <PageHead title="Billing & Payments" subtitle="Guest folios, tax and payments in one place." />
      <StatGrid columns={3}>
        <StatCard icon="hourglass" tone="warn" label="Outstanding from guests" testId="kpi-outstanding" value={moneyCompact(stats.outstanding)} note={`${stats.openCount} bills with a balance`} />
        <StatCard icon="wallet" tone="good" label="Collected today" value={moneyCompact(stats.collectedToday)} note="Across all payment methods" />
        <StatCard
          icon="receipt"
          tone="gold"
          label="Total invoiced"
          value={moneyCompact(stats.invoiced)}
          note={`Including tax, excluding voids · ${stats.invoiced ? Math.round((stats.paid / stats.invoiced) * 100) : 0}% paid`}
          meter={stats.invoiced ? (stats.paid / stats.invoiced) * 100 : 0}
        />
      </StatGrid>
      <Panel>
        <div className="toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Guest, invoice or booking number" />
          <select className="input" aria-label="Payment status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(INVOICE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <label className="check"><input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} /> Balance due only</label>
        </div>
        <DataTable
          caption="Invoices"
          columns={columns}
          rows={rows}
          rowKey={(v) => v.invoice.id}
          onRowClick={(v) => setParams({ invoice: v.invoice.id })}
          empty={<EmptyState icon="receipt" title="No invoices match" message="Try widening your filters." />}
        />
      </Panel>
      {openId && <InvoiceModal invoiceId={openId} onClose={() => setParams({})} />}
    </>
  );
}
