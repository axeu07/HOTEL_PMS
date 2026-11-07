import { useMemo, useState } from 'react';
import { RESERVATION_STATUS, SOURCE_LABEL } from '@/app/labels';
import { useApp } from '@/app/providers';
import { Bars, Legend, RankedBars, SERIES, TrendArea, type SeriesDef } from '@/components/charts';
import { Badge, Button, DataTable, EmptyState, PageHead, PageLoading, Panel, PersonCell, StatCard, StatGrid, Tabs, useFeedback, type Column } from '@/components/ui';
import { useLookups } from '@/features/useLookups';
import { useResource } from '@/hooks/useResource';
import { addDays, nightsBetween, today } from '@/lib/dates';
import { fmtDate, fmtDayMonth, money, moneyCompact, percent } from '@/lib/format';
import { downloadCsv, guestName, reportService } from '@/services';
import type { Reservation } from '@/types/domain';

type Tab = 'revenue' | 'occupancy' | 'bookings' | 'movements';

const REVENUE_SERIES: SeriesDef[] = [
  { key: 'room', name: 'Rooms', color: SERIES[0] },
  { key: 'food', name: 'Food & beverage', color: SERIES[1] },
  { key: 'service', name: 'Services', color: SERIES[2] },
];

const MOVEMENT_SERIES: SeriesDef[] = [
  { key: 'arrivals', name: 'Check-ins', color: SERIES[0] },
  { key: 'departures', name: 'Check-outs', color: SERIES[1] },
];

export default function Reports() {
  const { hotel } = useApp();
  const lookups = useLookups();
  const { toast } = useFeedback();
  const [tab, setTab] = useState<Tab>('revenue');
  const now = today();
  const [from, setFrom] = useState(addDays(now, -29));
  const [to, setTo] = useState(now);
  const [preset, setPreset] = useState('30');

  const { data } = useResource(() => reportService.build(from, to), [from, to]);

  const applyPreset = (value: string) => {
    setPreset(value);
    if (value !== 'custom') {
      setFrom(addDays(now, -(Number(value) - 1)));
      setTo(now);
    }
  };

  const totals = useMemo(() => {
    if (!data) return null;
    const revenue = data.revenue.reduce((acc, d) => ({ room: acc.room + d.room, food: acc.food + d.food, service: acc.service + d.service, total: acc.total + d.total }), { room: 0, food: 0, service: 0, total: 0 });
    const occupied = data.occupancy.reduce((s, d) => s + d.occupied, 0);
    const avgOcc = data.occupancy.length ? data.occupancy.reduce((s, d) => s + d.percent, 0) / data.occupancy.length : 0;
    const peak = data.occupancy.reduce((best, d) => (d.percent > best.percent ? d : best), data.occupancy[0]);
    const arrivals = data.movements.reduce((s, d) => s + d.arrivals, 0);
    const departures = data.movements.reduce((s, d) => s + d.departures, 0);
    return { revenue, occupied, avgOcc, peak, arrivals, departures };
  }, [data]);

  if (!data || !totals || !lookups) return <PageLoading />;

  const invalidRange = to < from;
  const days = nightsBetween(from, to) + 1;
  const stamp = `${from}_to_${to}`;

  const exportCsv = () => {
    if (tab === 'revenue') {
      downloadCsv(`revenue_${stamp}.csv`, [['Date', 'Rooms', 'Food & beverage', 'Services', 'Total'], ...data.revenue.map((d) => [d.date, d.room, d.food, d.service, d.total])]);
    } else if (tab === 'occupancy') {
      downloadCsv(`occupancy_${stamp}.csv`, [['Date', 'Rooms occupied', 'Occupancy %'], ...data.occupancy.map((d) => [d.date, d.occupied, d.percent.toFixed(1)])]);
    } else if (tab === 'bookings') {
      downloadCsv(`bookings_${stamp}.csv`, [
        ['Booking', 'Guest', 'Check-in', 'Check-out', 'Category', 'Source', 'Rate', 'Status'],
        ...data.rows.map((r) => [r.code, guestName(lookups.guestById.get(r.guestId)), r.checkIn, r.checkOut, lookups.categoryById.get(r.categoryId)?.name ?? '', SOURCE_LABEL[r.source], r.ratePerNight, RESERVATION_STATUS[r.status].label]),
      ]);
    } else {
      downloadCsv(`movements_${stamp}.csv`, [['Date', 'Check-ins', 'Check-outs'], ...data.movements.map((d) => [d.date, d.arrivals, d.departures])]);
    }
    toast('Report downloaded as CSV');
  };

  const bookingColumns: Column<Reservation>[] = [
    { key: 'code', header: 'Booking', primary: true, sort: (r) => r.code, render: (r) => <PersonCell name={guestName(lookups.guestById.get(r.guestId))} sub={r.code} /> },
    { key: 'in', header: 'Check-in', sort: (r) => r.checkIn, render: (r) => <span className="nowrap">{fmtDate(r.checkIn)}</span> },
    { key: 'nights', header: 'Nights', num: true, sort: (r) => nightsBetween(r.checkIn, r.checkOut), render: (r) => nightsBetween(r.checkIn, r.checkOut) },
    { key: 'cat', header: 'Category', hideOnMobile: true, render: (r) => lookups.categoryById.get(r.categoryId)?.name },
    { key: 'source', header: 'Source', hideOnMobile: true, sort: (r) => r.source, render: (r) => SOURCE_LABEL[r.source] },
    { key: 'status', header: 'Status', sort: (r) => r.status, render: (r) => <Badge tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Badge> },
  ];

  return (
    <>
      <PageHead
        title="Reports"
        subtitle={`${hotel.name}, ${fmtDate(from)} to ${fmtDate(to)}`}
        actions={
          <div className="row no-print">
            <Button icon="download" onClick={exportCsv}>Export CSV</Button>
            <Button icon="print" onClick={() => window.print()}>Print</Button>
          </div>
        }
      />
      <div className="row no-print" style={{ marginBottom: 14 }}>
        <div className="segmented" role="group" aria-label="Period">
          {[['7', '7 days'], ['30', '30 days'], ['90', '90 days']].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={preset === value} onClick={() => applyPreset(value)}>{label}</button>
          ))}
          <button type="button" aria-pressed={preset === 'custom'} onClick={() => setPreset('custom')}>Custom</button>
        </div>
        {preset === 'custom' && (
          <>
            <label className="row small muted" style={{ gap: 5 }}>From <input className="input" style={{ width: 'auto' }} type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
            <label className="row small muted" style={{ gap: 5 }}>To <input className="input" style={{ width: 'auto' }} type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
          </>
        )}
      </div>
      <div className="no-print" style={{ marginBottom: 18 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'revenue', label: 'Revenue' },
            { id: 'occupancy', label: 'Occupancy' },
            { id: 'bookings', label: 'Bookings' },
            { id: 'movements', label: 'Check-in / check-out' },
          ]}
        />
      </div>

      {invalidRange ? (
        <Panel><EmptyState icon="calendar" title="Check your dates" message="The start date needs to be before the end date." /></Panel>
      ) : (
        <div className="print-area">
          <h2 className="print-only" style={{ marginBottom: 12 }}>{hotel.name}: {tab} report, {fmtDate(from)} to {fmtDate(to)}</h2>
          {tab === 'revenue' && (
            <>
              <StatGrid>
                <StatCard icon="wallet" tone="gold" label="Total revenue" value={moneyCompact(totals.revenue.total)} note="Before tax" />
                <StatCard icon="bed" label="Rooms" value={moneyCompact(totals.revenue.room)} note={totals.revenue.total ? percent((totals.revenue.room / totals.revenue.total) * 100) : '–'} />
                <StatCard icon="fork" tone="gold" label="Food & beverage" value={moneyCompact(totals.revenue.food)} note={totals.revenue.total ? percent((totals.revenue.food / totals.revenue.total) * 100) : '–'} />
                <StatCard icon="concierge" tone="info" label="Services" value={moneyCompact(totals.revenue.service)} note={totals.revenue.total ? percent((totals.revenue.service / totals.revenue.total) * 100) : '–'} />
              </StatGrid>
              <div className="grid-2-1">
                <Panel title="Daily revenue" icon="chart" actions={<Legend series={REVENUE_SERIES} />}>
                  <div className="panel-body">
                    <Bars
                      data={data.revenue}
                      xKey="date"
                      series={REVENUE_SERIES}
                      stacked
                      format={(v) => money(v)}
                      axisFormat={moneyCompact}
                      xFormat={fmtDayMonth}
                      height={290}
                      label={`Stacked daily revenue by type over ${days} days, totalling ${money(totals.revenue.total)}`}
                    />
                  </div>
                </Panel>
                <Panel title="By room category" icon="layers" subtitle="Room revenue in this period.">
                  <RankedBars rows={data.byCategory.map((c) => ({ label: c.category.name, value: c.revenue }))} format={moneyCompact} />
                </Panel>
              </div>
            </>
          )}

          {tab === 'occupancy' && (
            <>
              <StatGrid>
                <StatCard icon="percent" label="Average occupancy" value={percent(totals.avgOcc, 1)} meter={totals.avgOcc} />
                <StatCard icon="bed" tone="info" label="Room nights sold" value={totals.occupied.toLocaleString('en-IN')} />
                <StatCard icon="trendUp" tone="good" label="Peak day" value={percent(totals.peak?.percent ?? 0)} note={totals.peak ? fmtDate(totals.peak.date) : undefined} />
                <StatCard icon="banknote" tone="gold" label="Average rate" value={money(totals.occupied ? Math.round(totals.revenue.room / totals.occupied) : 0)} note="Per room night" />
              </StatGrid>
              <Panel title="Occupancy by day" icon="activity">
                <div className="panel-body">
                  <TrendArea
                    data={data.occupancy}
                    xKey="date"
                    series={{ key: 'percent', name: 'Occupancy', color: SERIES[0] }}
                    format={(v) => percent(v, 1)}
                    axisFormat={(v) => `${v}%`}
                    xFormat={fmtDayMonth}
                    yMax={100}
                    height={300}
                    label={`Daily occupancy, averaging ${percent(totals.avgOcc, 1)}`}
                  />
                </div>
              </Panel>
              <div className="section-gap">
                <Panel title="By room category" icon="layers" subtitle="Room nights in this period.">
                  <RankedBars rows={data.byCategory.map((c) => ({ label: c.category.name, value: c.nights }))} format={(v) => `${v} nights`} />
                </Panel>
              </div>
            </>
          )}

          {tab === 'bookings' && (
            <>
              <StatGrid>
                <StatCard icon="calendar" label="Bookings" value={data.bookings.total} note="Arriving in this period" />
                <StatCard icon="clock" tone="info" label="Average stay" value={`${data.bookings.averageStay.toFixed(1)} nights`} />
                <StatCard icon="ban" tone="bad" label="Cancelled" value={data.bookings.cancelled} note={data.bookings.total ? percent((data.bookings.cancelled / data.bookings.total) * 100, 1) : undefined} />
                <StatCard icon="alert" tone="warn" label="No-shows" value={data.bookings.noShow} />
              </StatGrid>
              <div className="grid-2-1">
                <Panel title="Bookings in this period" icon="calendar">
                  <DataTable caption="Bookings" columns={bookingColumns} rows={data.rows} rowKey={(r) => r.id} pageSize={10} empty={<EmptyState icon="calendar" title="No bookings in this period" />} />
                </Panel>
                <Panel title="By source" icon="globe">
                  <RankedBars rows={data.bySource.map((s) => ({ label: SOURCE_LABEL[s.source], value: s.count }))} format={(v) => String(v)} />
                </Panel>
              </div>
            </>
          )}

          {tab === 'movements' && (
            <>
              <StatGrid columns={3}>
                <StatCard icon="login" label="Check-ins" value={totals.arrivals} />
                <StatCard icon="logout" tone="info" label="Check-outs" value={totals.departures} />
                <StatCard icon="activity" tone="gold" label="Average per day" value={(totals.arrivals / Math.max(1, days)).toFixed(1)} note="Check-ins" />
              </StatGrid>
              <Panel title="Check-ins and check-outs by day" icon="chart" actions={<Legend series={MOVEMENT_SERIES} />}>
                <div className="panel-body">
                  <Bars
                    data={data.movements}
                    xKey="date"
                    series={MOVEMENT_SERIES}
                    format={(v) => String(v)}
                    axisFormat={(v) => String(v)}
                    xFormat={fmtDayMonth}
                    height={300}
                    label={`${totals.arrivals} check-ins and ${totals.departures} check-outs over ${days} days`}
                  />
                </div>
              </Panel>
            </>
          )}
        </div>
      )}
    </>
  );
}
