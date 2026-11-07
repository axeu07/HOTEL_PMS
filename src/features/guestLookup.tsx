import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Icon } from '@/components/icons';
import { Badge, SelectField, TextField } from '@/components/ui';
import { REG_ID_TYPES, splitName } from '@/domain/registration';
import { fmtDate, timeAgo } from '@/lib/format';
import { isLookupReady } from '@/lib/phone';
import { guestService, registrationService, type GuestMatch } from '@/services';
import type { Guest, QrRegistration } from '@/types/domain';

/** What the walk-in form collects about the guest. Strings, because they are typed into inputs. */
export interface WalkInGuestDraft {
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  age: string;
  idType: Guest['idType'];
  idNumber: string;
  nationality: string;
  city: string;
  company: string;
}

export const emptyWalkInDraft = (phone = ''): WalkInGuestDraft => ({
  phone, firstName: '', lastName: '', email: '', age: '', idType: '', idNumber: '', nationality: '', city: '', company: '',
});

const fromGuest = (g: Guest, phone: string): WalkInGuestDraft => ({
  phone,
  firstName: g.firstName,
  lastName: g.lastName,
  email: g.email,
  age: g.age ? String(g.age) : '',
  idType: g.idType,
  idNumber: g.idNumber,
  nationality: g.nationality,
  city: g.city,
  company: g.company,
});

const PREF_LABEL: Record<string, string> = {
  high: 'High floor', low: 'Low floor', king: 'King bed', twin: 'Twin beds', soft: 'Soft pillows', firm: 'Firm pillows',
  hypoallergenic: 'Hypoallergenic pillows', vegetarian: 'Vegetarian', vegan: 'Vegan', jain: 'Jain', gluten_free: 'Gluten free',
};

function preferenceChips(g: Guest): string[] {
  const p = g.preferences;
  return [p.floor, p.bed, p.pillow, p.dietary].map((v) => PREF_LABEL[v]).filter(Boolean);
}

/**
 * The phone number is the key. Once there are enough digits it looks for a saved guest and, if one
 * exists, fills in what is already known so a returning guest never repeats it. Every field stays
 * editable. With no match it offers the plain new-guest fields.
 */
export function GuestLookupFields({
  draft,
  setDraft,
  errors,
  onMatch,
}: {
  draft: WalkInGuestDraft;
  setDraft: Dispatch<SetStateAction<WalkInGuestDraft>>;
  errors: Record<string, string>;
  onMatch: (match: GuestMatch | null) => void;
}) {
  const [match, setMatch] = useState<GuestMatch | null>(null);
  const [qr, setQr] = useState<QrRegistration | null>(null);
  const [phase, setPhase] = useState<'idle' | 'searching' | 'done'>('idle');
  const matchRef = useRef<GuestMatch | null>(null);
  const onMatchRef = useRef(onMatch);
  onMatchRef.current = onMatch;

  useEffect(() => {
    if (!isLookupReady(draft.phone)) {
      setPhase('idle');
      setQr(null);
      if (matchRef.current) {
        // The number no longer points at that guest, so their details must not stay behind in the form.
        matchRef.current = null;
        setMatch(null);
        onMatchRef.current(null);
        setDraft((d) => emptyWalkInDraft(d.phone));
      }
      return;
    }
    setPhase('searching');
    let live = true;
    const timer = window.setTimeout(async () => {
      const [found, pending] = await Promise.all([guestService.findByPhone(draft.phone), registrationService.pendingForPhone(draft.phone)]);
      if (!live) return;
      const previous = matchRef.current;
      matchRef.current = found;
      setMatch(found);
      setQr(found ? null : pending ?? null);
      setPhase('done');
      onMatchRef.current(found);
      if (found && found.guest.id !== previous?.guest.id) setDraft((d) => fromGuest(found.guest, d.phone));
      // Moved from one guest straight to a number with no record: do not keep the first guest's details.
      if (!found && previous) setDraft((d) => emptyWalkInDraft(d.phone));
    }, 250);
    return () => { live = false; window.clearTimeout(timer); };
  }, [draft.phone, setDraft]);

  const set = <K extends keyof WalkInGuestDraft>(key: K, value: WalkInGuestDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const useQr = () => {
    if (!qr) return;
    const { firstName, lastName } = splitName(qr.name);
    setDraft((d) => ({ ...d, firstName, lastName, age: String(qr.age), idType: qr.idType }));
    setQr(null);
  };

  const hint =
    phase === 'searching' ? 'Looking for a saved guest…'
    : phase === 'idle' ? 'Enter the phone number to find a returning guest.'
    : undefined;

  return (
    <>
      <TextField
        label="Phone number"
        wrapClass="full"
        type="tel"
        inputMode="tel"
        value={draft.phone}
        onChange={(e) => set('phone', e.target.value)}
        error={errors.phone}
        hint={hint}
        autoComplete="off"
        placeholder="e.g. 1234567890"
        data-testid="walkin-phone"
      />

      <div className="full" aria-live="polite">
        {match && (
          <div className="lookup-card" data-kind="returning" data-testid="lookup-returning">
            <div className="lookup-head">
              <span className="lookup-icon"><Icon name="check" size={15} /></span>
              <strong>Returning guest found</strong>
              <Badge tone="good">{match.visits} {match.visits === 1 ? 'visit' : 'visits'}</Badge>
              {match.guest.vip && <Badge tone="brass">VIP</Badge>}
            </div>
            <p className="lookup-line">
              Details below come from the saved record. Change anything that is out of date.
            </p>
            <dl className="lookup-facts">
              <div><dt>Last stay</dt><dd>{match.lastVisit ? `${fmtDate(match.lastVisit)}${match.lastRoomType ? ` · ${match.lastRoomType}` : ''}` : 'Not yet completed'}</dd></div>
              <div><dt>Nights with us</dt><dd>{match.nights}</dd></div>
              {preferenceChips(match.guest).length > 0 && <div><dt>Preferences</dt><dd>{preferenceChips(match.guest).join(' · ')}</dd></div>}
              {match.guest.preferences.notes && <div className="wide"><dt>Notes</dt><dd>{match.guest.preferences.notes}</dd></div>}
            </dl>
          </div>
        )}
        {!match && phase === 'done' && !qr && (
          <div className="lookup-card" data-kind="new" data-testid="lookup-new">
            <div className="lookup-head">
              <span className="lookup-icon"><Icon name="user" size={15} /></span>
              <strong>New guest</strong>
            </div>
            <p className="lookup-line">No saved record for this number. Fill in the guest&apos;s details below.</p>
          </div>
        )}
        {!match && qr && (
          <div className="lookup-card" data-kind="qr" data-testid="lookup-qr">
            <div className="lookup-head">
              <span className="lookup-icon"><Icon name="shield" size={15} /></span>
              <strong>Self-registered by QR {timeAgo(qr.submittedAt)}</strong>
              <Badge tone="warn">Not yet verified</Badge>
            </div>
            <p className="lookup-line">{qr.name}, {qr.age}. Verify the ID under Front Desk, QR registrations, or use the details as typed.</p>
            <button type="button" className="btn btn-sm" onClick={useQr}>Use these details</button>
          </div>
        )}
      </div>

      <TextField label="First name" value={draft.firstName} onChange={(e) => set('firstName', e.target.value)} error={errors.firstName} autoComplete="off" />
      <TextField label="Last name" value={draft.lastName} onChange={(e) => set('lastName', e.target.value)} error={errors.lastName} autoComplete="off" />
      <TextField label="Age (optional)" type="number" inputMode="numeric" min={1} max={120} value={draft.age} onChange={(e) => set('age', e.target.value)} error={errors.age} />
      <TextField label="Email (optional)" type="email" value={draft.email} onChange={(e) => set('email', e.target.value)} error={errors.email} autoComplete="off" />
      <SelectField label="ID document (optional)" value={draft.idType} onChange={(e) => set('idType', e.target.value as Guest['idType'])}>
        <option value="">Not collected yet</option>
        {REG_ID_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </SelectField>
      <TextField label="ID number" value={draft.idNumber} onChange={(e) => set('idNumber', e.target.value)} error={errors.idNumber} autoComplete="off" />
      {match && (
        <>
          <TextField label="Nationality" value={draft.nationality} onChange={(e) => set('nationality', e.target.value)} autoComplete="off" />
          <TextField label="City" value={draft.city} onChange={(e) => set('city', e.target.value)} autoComplete="off" />
          <TextField label="Company" wrapClass="full" value={draft.company} onChange={(e) => set('company', e.target.value)} autoComplete="off" />
        </>
      )}
    </>
  );
}
