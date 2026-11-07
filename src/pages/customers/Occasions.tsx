import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead, PageLoading, Panel, StatCard, StatGrid } from '@/components/ui';
import { GuestOccasionsRow, OccasionList } from '@/features/crm/GuestOccasions';
import { useCrm } from '@/features/crm/useCrm';
import { OCCASION_CATEGORIES } from '@/domain/occasions';
import type { OccasionType } from '@/types/domain';

export default function Occasions() {
  const crm = useCrm();
  const navigate = useNavigate();
  const [type, setType] = useState<OccasionType | ''>('');
  if (!crm) return <PageLoading />;

  const rows = crm.occasionRows.filter((r) => OCCASION_CATEGORIES.includes(r.occasion.type));
  const upcoming = rows.filter((r) => r.upcoming);
  const guests = new Set(rows.map((r) => r.guest.id)).size;
  const week = upcoming.filter((r) => r.occursOn && r.occursOn <= new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));

  return (
    <>
      <PageHead title="Guest occasions" subtitle="Birthdays, anniversaries and celebrations guests share at booking or check-in. Plan a welcome before they arrive." />
      <div className="stayed-kpis"><StatGrid>
        <StatCard icon="cake" label="Occasions recorded" value={rows.length} note="Across all guests" />
        <StatCard icon="calendar" tone="info" label="Upcoming" value={upcoming.length} note="Still to be celebrated" />
        <StatCard icon="gift" tone="gold" label="Within 7 days" value={week.length} note="Worth preparing for" />
        <StatCard icon="users" tone="good" label="Guests celebrating" value={guests} note="With at least one occasion" />
      </StatGrid></div>
      <GuestOccasionsRow rows={crm.occasionRows} onOpen={(t) => setType(type === t ? '' : t)} active={type} />
      <Panel>
        <div style={{ padding: 14 }}>
          <OccasionList rows={crm.occasionRows} type={type} onTypeChange={setType} onOpenGuest={(id) => navigate(`/app/customers/stayed?open=${id}`)} />
        </div>
      </Panel>
    </>
  );
}
