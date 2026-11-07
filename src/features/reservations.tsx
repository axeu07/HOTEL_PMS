import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CLEANING_STATUS, PAYMENT_METHOD, RESERVATION_STATUS, SOURCE_LABEL } from '@/app/labels';
import { useApp, useAuth } from '@/app/providers';
import { Icon } from '@/components/icons';
import { Badge, Button, ComboboxField, Modal, SelectField, TextAreaField, TextField, useFeedback } from '@/components/ui';
import { freeRooms as findFreeRooms } from '@/domain/availability';
import { computeRoomTaxRate } from '@/domain/billing';
import { useResource } from '@/hooks/useResource';
import { GuestLookupFields, emptyWalkInDraft, type WalkInGuestDraft } from './guestLookup';
import { addDays, nightsBetween, today } from '@/lib/dates';
import { fmtDate, money, round2 } from '@/lib/format';
import { errorMessage, hasErrors, positive, required, validEmail, validPhone } from '@/lib/validation';
import {
  billingService,
  emptyGuest,
  guestName,
  guestService,
  reservationService,
  roomService,
  type DepartureBill,
  type GuestInput,
  type GuestMatch,
} from '@/services';
import type { BookingSource, ID, PaymentMethod, Reservation, Room } from '@/types/domain';
import { InvoiceModal } from './InvoiceModal';
import type { Lookups } from './useLookups';

const SOURCES = Object.keys(SOURCE_LABEL) as BookingSource[];

/* ---------- Room picker ---------- */

function useFreeRooms(checkIn: string, checkOut: string, categoryId: string, excludeReservationId?: ID) {
  const valid = !!categoryId && !!checkIn && checkOut > checkIn;
  const { data } = useResource(
    async () => (valid ? roomService.available({ checkIn, checkOut, excludeReservationId }, categoryId) : []),
    [checkIn, checkOut, categoryId, excludeReservationId, valid],
  );
  return data ?? [];
}

/* ---------- Create & edit ---------- */

/** The saved record the form's guest fields describe. Blank optional fields are left off rather than saved empty. */
function guestFromDraft(d: WalkInGuestDraft): GuestInput {
  const base = emptyGuest();
  return {
    ...base,
    firstName: d.firstName.trim(),
    lastName: d.lastName.trim(),
    email: d.email.trim(),
    phone: d.phone.trim(),
    idType: d.idType,
    idNumber: d.idNumber.trim(),
    ...(d.age.trim() ? { age: Number(d.age) } : {}),
    ...(d.nationality.trim() ? { nationality: d.nationality.trim() } : {}),
    ...(d.city.trim() ? { city: d.city.trim() } : {}),
    ...(d.company.trim() ? { company: d.company.trim() } : {}),
  };
}

export function ReservationFormModal({
  lookups,
  reservation,
  defaults,
  walkIn,
  initialPhone,
  onClose,
  onSaved,
}: {
  lookups: Lookups;
  reservation?: Reservation;
  defaults?: Partial<Pick<Reservation, 'guestId' | 'roomId' | 'categoryId' | 'checkIn' | 'checkOut'>>;
  walkIn?: boolean;
  /** Opens the walk-in lookup already holding this number, e.g. after a QR registration is verified. */
  initialPhone?: string;
  onClose: () => void;
  onSaved?: (reservation: Reservation) => void;
}) {
  const { hotel } = useApp();
  const { toast } = useFeedback();
  const editing = !!reservation;
  const inHouse = reservation?.status === 'checked_in';
  const startCheckIn = walkIn ? today() : (reservation?.checkIn ?? defaults?.checkIn ?? today());
  // A walk-in opens on the first category with a room ready right now.
  const readyCategory = walkIn
    ? lookups.categories.find((c) =>
        findFreeRooms(lookups.rooms, { checkIn: startCheckIn, checkOut: addDays(startCheckIn, 2) }, lookups.reservations, c.id).some(
          (r) => r.status === 'vacant' && r.cleaning === 'clean',
        ),
      )
    : undefined;
  const startCategory = reservation?.categoryId ?? defaults?.categoryId ?? readyCategory?.id ?? lookups.categories[0]?.id ?? '';

  const [form, setForm] = useState({
    guestId: reservation?.guestId ?? defaults?.guestId ?? '',
    categoryId: startCategory,
    roomId: reservation?.roomId ?? defaults?.roomId ?? '',
    checkIn: startCheckIn,
    checkOut: reservation?.checkOut ?? defaults?.checkOut ?? addDays(startCheckIn, 2),
    adults: reservation?.adults ?? 2,
    children: reservation?.children ?? 0,
    source: reservation?.source ?? (walkIn ? 'walk_in' : 'direct') as BookingSource,
    ratePerNight: reservation?.ratePerNight ?? lookups.categoryById.get(startCategory)?.basePrice ?? 0,
    status: (reservation?.status === 'pending' ? 'pending' : 'confirmed') as 'pending' | 'confirmed',
    notes: reservation?.notes ?? '',
  });
  const [guestMode, setGuestMode] = useState<'existing' | 'new'>(walkIn && !defaults?.guestId ? 'new' : 'existing');
  const [draft, setDraft] = useState<WalkInGuestDraft>(() => emptyWalkInDraft(initialPhone ?? ''));
  const [match, setMatch] = useState<GuestMatch | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);

  const allFree = useFreeRooms(form.checkIn, form.checkOut, form.categoryId, reservation?.id);
  // A walk-in goes straight into the room, so it has to be empty and clean now.
  const freeRooms = walkIn ? allFree.filter((r) => r.status === 'vacant' && r.cleaning === 'clean') : allFree;
  const nights = form.checkOut > form.checkIn ? nightsBetween(form.checkIn, form.checkOut) : 0;
  const category = lookups.categoryById.get(form.categoryId);
  const subtotal = nights * form.ratePerNight;
  const taxRate = computeRoomTaxRate(form.ratePerNight, hotel.tax);
  const tax = round2((subtotal * taxRate) / 100);

  // Keep the chosen room honest as dates and category change.
  useEffect(() => {
    if (form.roomId && allFree.length > 0 && !freeRooms.some((r) => r.id === form.roomId)) {
      setForm((f) => ({ ...f, roomId: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeRooms.map((r) => r.id).join()]);

  const guestOptions = useMemo(
    () => lookups.guests.map((g) => ({
      value: g.id,
      label: `${g.lastName}, ${g.firstName}${g.vip ? ' (VIP)' : ''} · ${g.phone}`,
      search: `${g.firstName} ${g.lastName} ${g.lastName} ${g.firstName} ${g.phone}`,
    })),
    [lookups.guests],
  );

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const changeCategory = (categoryId: string) => {
    const next = lookups.categoryById.get(categoryId);
    setForm((f) => ({ ...f, categoryId, roomId: '', ratePerNight: next?.basePrice ?? f.ratePerNight }));
  };

  const changeRoom = (roomId: string) => {
    const room = lookups.roomById.get(roomId);
    setForm((f) => ({ ...f, roomId, ratePerNight: room?.priceOverride ?? f.ratePerNight }));
  };

  const validate = () => {
    const next: Record<string, string> = {
      checkIn: !inHouse && !editing && form.checkIn < today() ? 'Choose today or a later date' : required(form.checkIn, 'Check-in'),
      checkOut: form.checkOut <= form.checkIn ? 'Must be after check-in' : '',
      ratePerNight: positive(Number(form.ratePerNight), 'Rate'),
      adults: Number(form.adults) < 1 ? 'At least one adult' : '',
      guests: category && Number(form.adults) + Number(form.children) > category.capacity ? `${category.name} sleeps up to ${category.capacity}` : '',
      roomId: walkIn && !form.roomId ? 'Choose a room for the walk-in' : '',
    };
    if (guestMode === 'existing') {
      next.guestId = required(form.guestId, 'Guest');
    } else {
      next.firstName = required(draft.firstName, 'First name');
      next.lastName = required(draft.lastName, 'Last name');
      next.email = validEmail(draft.email);
      next.phone = required(draft.phone, 'Phone') || validPhone(draft.phone);
      next.age = draft.age.trim() && (!Number.isInteger(Number(draft.age)) || Number(draft.age) < 1 || Number(draft.age) > 120) ? 'Enter an age between 1 and 120' : '';
    }
    setErrors(next);
    return !hasErrors(next);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setFailure('');
    try {
      let saved: Reservation;
      if (walkIn) {
        // A returning guest's record is brought up to date with whatever staff corrected, never duplicated.
        if (guestMode === 'new' && match) {
          const { phone: _kept, ...edits } = guestFromDraft(draft);
          await guestService.update(match.guest.id, edits);
        }
        saved = await reservationService.walkIn({
          guest: guestFromDraft(draft),
          existingGuestId: guestMode === 'existing' ? form.guestId : guestMode === 'new' ? match?.guest.id : undefined,
          categoryId: form.categoryId,
          roomId: form.roomId,
          checkOut: form.checkOut,
          adults: Number(form.adults),
          children: Number(form.children),
          ratePerNight: Number(form.ratePerNight),
          notes: form.notes,
        });
        toast(`Walk-in checked in to room ${lookups.roomById.get(form.roomId)?.number}`);
      } else {
        const guestId = guestMode === 'existing' ? form.guestId : (await guestService.create(guestFromDraft(draft))).id;
        const input = {
          guestId,
          categoryId: form.categoryId,
          roomId: form.roomId || null,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          adults: Number(form.adults),
          children: Number(form.children),
          source: form.source,
          ratePerNight: Number(form.ratePerNight),
          notes: form.notes,
          status: form.status,
        };
        saved = editing ? await reservationService.update(reservation.id, input) : await reservationService.create(input);
        toast(editing ? `Booking ${saved.code} updated` : `Booking ${saved.code} created`);
      }
      onSaved?.(saved);
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const title = walkIn ? 'Walk-in booking' : editing ? `Edit booking ${reservation.code}` : 'New booking';

  return (
    <Modal
      title={title}
      subtitle={walkIn ? 'Creates the guest and booking, then checks them in straight away.' : undefined}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <span className="left small muted">
            {nights > 0 ? <>{nights} night{nights === 1 ? '' : 's'} · <b>{money(round2(subtotal + tax))}</b> incl. {hotel.tax.label} at {taxRate}%</> : 'Choose your dates'}
          </span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="reservation-form" loading={saving}>
            {walkIn ? 'Create and check in' : editing ? 'Save changes' : 'Create booking'}
          </Button>
        </>
      }
    >
      <form id="reservation-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="row-between full">
          <span className="form-section" style={{ padding: 0 }}>Guest</span>
          {!editing && (
            <div className="segmented" role="group" aria-label="Guest type">
              <button type="button" aria-pressed={guestMode === 'existing'} onClick={() => setGuestMode('existing')}>{walkIn ? 'Pick from list' : 'Existing guest'}</button>
              <button type="button" aria-pressed={guestMode === 'new'} onClick={() => setGuestMode('new')}>{walkIn ? 'Find by phone' : 'New guest'}</button>
            </div>
          )}
        </div>
        {guestMode === 'existing' ? (
          <ComboboxField
            label="Guest"
            wrapClass="full"
            placeholder="Search by name or phone number"
            options={guestOptions}
            value={form.guestId}
            onChange={(id) => set('guestId', id)}
            error={errors.guestId}
            disabled={editing}
          />
        ) : walkIn ? (
          <GuestLookupFields draft={draft} setDraft={setDraft} errors={errors} onMatch={setMatch} />
        ) : (
          <>
            <TextField label="First name" value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} error={errors.firstName} autoComplete="off" />
            <TextField label="Last name" value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} error={errors.lastName} autoComplete="off" />
            <TextField label="Phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} error={errors.phone} autoComplete="off" />
            <TextField label="Email (optional)" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} error={errors.email} autoComplete="off" />
          </>
        )}

        <span className="form-section">Stay</span>
        <TextField label="Check-in" type="date" value={form.checkIn} min={editing ? undefined : today()} disabled={walkIn || inHouse} onChange={(e) => set('checkIn', e.target.value)} error={errors.checkIn} />
        <TextField label="Check-out" type="date" value={form.checkOut} min={form.checkIn} onChange={(e) => set('checkOut', e.target.value)} error={errors.checkOut} />
        <TextField label="Adults" type="number" min={1} value={form.adults} onChange={(e) => set('adults', Number(e.target.value))} error={errors.adults} />
        <TextField label="Children" type="number" min={0} value={form.children} onChange={(e) => set('children', Number(e.target.value))} error={errors.guests} />
        <SelectField label="Room category" value={form.categoryId} disabled={inHouse} onChange={(e) => changeCategory(e.target.value)}>
          {lookups.categories.map((c) => <option key={c.id} value={c.id}>{c.name} (sleeps {c.capacity})</option>)}
        </SelectField>
        <SelectField
          label="Room allocation"
          value={form.roomId}
          onChange={(e) => changeRoom(e.target.value)}
          error={errors.roomId}
          hint={nights > 0 ? `${freeRooms.length} ${walkIn ? 'clean ' : ''}room${freeRooms.length === 1 ? '' : 's'} free for these dates` : undefined}
        >
          {!walkIn && !inHouse && <option value="">Assign later</option>}
          {walkIn && <option value="">Choose a room</option>}
          {freeRooms.map((r) => <option key={r.id} value={r.id}>Room {r.number} · floor {r.floor}{r.cleaning !== 'clean' ? ` · ${CLEANING_STATUS[r.cleaning].label.toLowerCase()}` : ''}</option>)}
        </SelectField>
        <TextField label={`Rate per night (${hotel.currency})`} type="number" min={0} step={100} value={form.ratePerNight} onChange={(e) => set('ratePerNight', Number(e.target.value))} error={errors.ratePerNight} />
        {!walkIn && (
          <SelectField label="Source" value={form.source} onChange={(e) => set('source', e.target.value as BookingSource)}>
            {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </SelectField>
        )}
        {!walkIn && !inHouse && (
          <SelectField label="Booking status" value={form.status} onChange={(e) => set('status', e.target.value as 'pending' | 'confirmed')}>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
          </SelectField>
        )}
        <TextAreaField label="Notes" wrapClass="full" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        {failure && <div className="alert alert-bad full"><Icon name="alert" /><span>{failure}</span></div>}
      </form>
    </Modal>
  );
}

/* ---------- Check-in ---------- */

export function CheckInModal({ reservation, lookups, onClose }: { reservation: Reservation; lookups: Lookups; onClose: () => void }) {
  const { toast } = useFeedback();
  const guest = lookups.guestById.get(reservation.guestId);
  const free = useFreeRooms(reservation.checkIn, reservation.checkOut, reservation.categoryId, reservation.id);
  const [roomId, setRoomId] = useState(reservation.roomId ?? '');
  const [idType, setIdType] = useState(guest?.idType || 'national_id');
  const [idNumber, setIdNumber] = useState(guest?.idNumber ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');

  const isReady = (room: Room) => room.status === 'vacant' && room.cleaning === 'clean';
  const selected = lookups.roomById.get(roomId);
  const notReady = selected && !isReady(selected);
  // Ready rooms first. Rooms still being turned around show but cannot be picked,
  // apart from the one already assigned, which stays visible with its warning.
  const options = useMemo(() => {
    const list = [...free];
    if (selected && !list.some((r) => r.id === selected.id)) list.push(selected);
    return list.sort((a, b) => Number(isReady(b)) - Number(isReady(a)) || a.number.localeCompare(b.number));
  }, [free, selected]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      roomId: required(roomId, 'Room'),
      idNumber: required(idNumber, 'ID number'),
    };
    setErrors(next);
    if (hasErrors(next)) return;
    setFailure('');
    try {
      if (guest) await guestService.update(guest.id, { idType: idType as typeof guest.idType, idNumber });
      if (roomId !== reservation.roomId) await reservationService.assignRoom(reservation.id, roomId);
      await reservationService.checkIn(reservation.id);
      toast(`${guestName(guest)} checked in to room ${selected?.number}`);
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <Modal
      title={`Check in ${guestName(guest)}`}
      subtitle={`${reservation.code} · ${fmtDate(reservation.checkIn)} to ${fmtDate(reservation.checkOut)}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="check-in-form" icon="key" disabled={!!notReady}>Complete check-in</Button>
        </>
      }
    >
      <form id="check-in-form" className="form-grid" onSubmit={submit} noValidate>
        <SelectField label="Room" wrapClass="full" value={roomId} onChange={(e) => setRoomId(e.target.value)} error={errors.roomId}>
          <option value="">Choose a room</option>
          {options.map((r) => (
            <option key={r.id} value={r.id} disabled={!isReady(r) && r.id !== roomId}>
              Room {r.number} · {r.status === 'occupied' ? 'guest still in room' : CLEANING_STATUS[r.cleaning].label}
            </option>
          ))}
        </SelectField>
        {notReady && (
          <div className="alert alert-warn full">
            <Icon name="alert" />
            <span>Room {selected.number} is not ready. Choose another room or ask housekeeping to finish it first.</span>
          </div>
        )}
        <SelectField label="ID type" value={idType} onChange={(e) => setIdType(e.target.value as typeof idType)}>
          <option value="national_id">National ID</option>
          <option value="passport">Passport</option>
          <option value="driving_licence">Driving licence</option>
        </SelectField>
        <TextField label="ID number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} error={errors.idNumber} hint="Fictional data only, please." autoComplete="off" />
        {failure && <div className="alert alert-bad full"><Icon name="alert" /><span>{failure}</span></div>}
      </form>
    </Modal>
  );
}

/* ---------- Check-out ---------- */

export function CheckOutModal({ reservation, lookups, onClose }: { reservation: Reservation; lookups: Lookups; onClose: () => void }) {
  const { toast } = useFeedback();
  const { data: bill } = useResource<DepartureBill>(() => reservationService.departureBill(reservation.id), [reservation.id]);
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [reference, setReference] = useState('');
  const [failure, setFailure] = useState('');
  const [showInvoice, setShowInvoice] = useState(false);
  const guest = lookups.guestById.get(reservation.guestId);
  const due = bill ? bill.totals.balance > 0.009 : false;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFailure('');
    try {
      await reservationService.checkOut(reservation.id, due ? { method, reference } : undefined);
      toast(`${guestName(guest)} checked out. Room queued for cleaning.`);
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <Modal
      title={`Check out ${guestName(guest)}`}
      subtitle={`${reservation.code} · room ${lookups.roomById.get(reservation.roomId ?? '')?.number ?? '–'}`}
      onClose={onClose}
      footer={
        <>
          {bill && <Button className="left" icon="receipt" onClick={() => setShowInvoice(true)}>View bill</Button>}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="check-out-form" disabled={!bill}>
            {due && bill ? `Take ${money(bill.totals.balance)} and check out` : 'Complete check-out'}
          </Button>
        </>
      }
    >
      {bill && (
        <form id="check-out-form" className="stack" onSubmit={submit} noValidate>
          {bill.nights !== bill.bookedNights && (
            <div className="alert alert-info">
              <Icon name="info" />
              <span>Booked for {bill.bookedNights} night{bill.bookedNights === 1 ? '' : 's'}, leaving after {bill.nights}. The room charge below is for the nights stayed.</span>
            </div>
          )}
          <dl className="dl">
            <dt>Room charges</dt><dd className="right">{money(bill.totals.roomSubtotal)}</dd>
            <dt>Food & beverage</dt><dd className="right">{money(bill.totals.foodSubtotal)}</dd>
            <dt>Other services</dt><dd className="right">{money(bill.totals.serviceSubtotal)}</dd>
            <dt>Tax</dt><dd className="right">{money(bill.totals.tax)}</dd>
            <dt className="strong">Total</dt><dd className="right strong">{money(bill.totals.total)}</dd>
            <dt>Paid</dt><dd className="right">{money(bill.totals.paid)}</dd>
            <dt className="strong">{bill.totals.balance < 0 ? 'Credit due to guest' : 'Balance due'}</dt>
            <dd className="right strong" data-testid="balance-due">{money(Math.abs(bill.totals.balance))}</dd>
          </dl>
          {due && (
            <div className="form-grid">
              <SelectField label="Payment method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => <option key={m} value={m}>{PAYMENT_METHOD[m]}</option>)}
              </SelectField>
              <TextField label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" />
            </div>
          )}
          <p className="small muted">No real payment is processed. The room will be marked for cleaning and sent to housekeeping.</p>
          {failure && <div className="alert alert-bad"><Icon name="alert" /><span>{failure}</span></div>}
        </form>
      )}
      {showInvoice && bill && <InvoiceModal invoiceId={bill.invoiceId} onClose={() => setShowInvoice(false)} />}
    </Modal>
  );
}

/* ---------- Cancel ---------- */

export function CancelModal({ reservation, onClose }: { reservation: Reservation; onClose: () => void }) {
  const { run } = useFeedback();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  return (
    <Modal
      title={`Cancel booking ${reservation.code}?`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Keep booking</Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (!reason.trim()) {
                setError('Please record why this was cancelled');
                return;
              }
              if (await run(() => reservationService.cancel(reservation.id, reason), `Booking ${reservation.code} cancelled`)) onClose();
            }}
          >
            Cancel booking
          </Button>
        </>
      }
    >
      <div className="stack-sm">
        <p className="muted">The room is released and the invoice is voided.</p>
        <TextAreaField label="Reason" value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }} error={error} />
      </div>
    </Modal>
  );
}

/* ---------- Detail ---------- */

export function ReservationDetailModal({ reservationId, lookups, onClose }: { reservationId: ID; lookups: Lookups; onClose: () => void }) {
  const { can } = useAuth();
  const { run, confirm } = useFeedback();
  const reservation = lookups.reservations.find((r) => r.id === reservationId);
  const { data: view } = useResource(() => billingService.viewForReservation(reservationId), [reservationId]);
  const [dialog, setDialog] = useState<null | 'edit' | 'checkin' | 'checkout' | 'cancel' | 'invoice'>(null);

  const free = useFreeRooms(reservation?.checkIn ?? '', reservation?.checkOut ?? '', reservation?.categoryId ?? '', reservationId);

  if (!reservation) {
    return (
      <Modal title="Booking not found" size="sm" onClose={onClose}>
        <p className="muted">This booking is no longer in the demo data. It may have been cleared by a reset.</p>
      </Modal>
    );
  }

  const guest = lookups.guestById.get(reservation.guestId);
  const room = reservation.roomId ? lookups.roomById.get(reservation.roomId) : null;
  const category = lookups.categoryById.get(reservation.categoryId);
  const nights = nightsBetween(reservation.checkIn, reservation.checkOut);
  const status = RESERVATION_STATUS[reservation.status];
  const manage = can('reservations.manage');
  const open = reservation.status === 'pending' || reservation.status === 'confirmed';
  const arrivesToday = reservation.checkIn <= today();

  return (
    <Modal
      title={guestName(guest)}
      subtitle={<>{reservation.code} · booked {fmtDate(reservation.createdAt.slice(0, 10))} via {SOURCE_LABEL[reservation.source].toLowerCase()}</>}
      size="lg"
      onClose={onClose}
      footer={
        manage ? (
          <>
            {open && (
              <Button className="left" variant="danger" onClick={() => setDialog('cancel')}>Cancel booking</Button>
            )}
            {open && reservation.checkIn < today() && (
              <Button
                onClick={async () => {
                  const ok = await confirm({ title: 'Mark as no-show?', message: 'The room is released and the invoice is voided.', confirmLabel: 'Mark no-show', danger: true });
                  if (ok) run(() => reservationService.markNoShow(reservation.id), 'Marked as a no-show');
                }}
              >
                No-show
              </Button>
            )}
            {(open || reservation.status === 'checked_in') && <Button icon="edit" onClick={() => setDialog('edit')}>Edit</Button>}
            {reservation.status === 'pending' && (
              <Button onClick={() => run(() => reservationService.confirm(reservation.id), 'Booking confirmed')}>Confirm</Button>
            )}
            {open && arrivesToday && <Button variant="primary" icon="key" onClick={() => setDialog('checkin')}>Check in</Button>}
            {reservation.status === 'checked_in' && <Button variant="primary" onClick={() => setDialog('checkout')}>Check out</Button>}
          </>
        ) : undefined
      }
    >
      <div className="stack">
        <div className="row">
          <Badge tone={status.tone}>{status.label}</Badge>
          {guest?.vip && <Badge tone="brass">VIP</Badge>}
          {reservation.status === 'cancelled' && reservation.cancelReason && <span className="small muted">Reason: {reservation.cancelReason}</span>}
        </div>
        <div className="grid-1-1">
          <dl className="dl">
            <dt>Check-in</dt><dd>{fmtDate(reservation.checkIn)}</dd>
            <dt>Check-out</dt><dd>{fmtDate(reservation.checkOut)}</dd>
            <dt>Nights</dt><dd>{nights}</dd>
            <dt>Guests</dt><dd>{reservation.adults} adult{reservation.adults === 1 ? '' : 's'}{reservation.children ? `, ${reservation.children} child${reservation.children === 1 ? '' : 'ren'}` : ''}</dd>
            <dt>Rate</dt><dd>{money(reservation.ratePerNight)} a night</dd>
          </dl>
          <dl className="dl">
            <dt>Category</dt><dd>{category?.name}</dd>
            <dt>Room</dt><dd>{room ? `Room ${room.number}` : 'Not assigned'}</dd>
            <dt>Phone</dt><dd>{guest?.phone}</dd>
            <dt>Email</dt><dd>{guest?.email || '–'}</dd>
            {view && (
              <>
                <dt>Bill</dt>
                <dd>
                  {money(view.totals.total)} · {view.totals.balance > 0 ? `${money(view.totals.balance)} due` : 'settled'}
                </dd>
              </>
            )}
          </dl>
        </div>
        {reservation.notes && <div className="alert alert-info"><Icon name="info" /><span>{reservation.notes}</span></div>}
        {manage && open && (
          <SelectField
            label="Allocate a room"
            value={reservation.roomId ?? ''}
            hint={`${free.length} free ${category?.name} room${free.length === 1 ? '' : 's'} for these dates`}
            onChange={(e) => run(() => reservationService.assignRoom(reservation.id, e.target.value || null), e.target.value ? 'Room allocated' : 'Room released')}
          >
            <option value="">Assign later</option>
            {[...(room && !free.some((r) => r.id === room.id) ? [room] : []), ...free].map((r) => (
              <option key={r.id} value={r.id}>Room {r.number} · {CLEANING_STATUS[r.cleaning].label}</option>
            ))}
          </SelectField>
        )}
        {view && can('billing.use') && (
          <div><button type="button" className="link-btn" onClick={() => setDialog('invoice')}>Open invoice {view.invoice.number}</button></div>
        )}
      </div>

      {dialog === 'edit' && <ReservationFormModal lookups={lookups} reservation={reservation} onClose={() => setDialog(null)} />}
      {dialog === 'checkin' && <CheckInModal reservation={reservation} lookups={lookups} onClose={() => setDialog(null)} />}
      {dialog === 'checkout' && <CheckOutModal reservation={reservation} lookups={lookups} onClose={() => setDialog(null)} />}
      {dialog === 'cancel' && <CancelModal reservation={reservation} onClose={() => setDialog(null)} />}
      {dialog === 'invoice' && view && <InvoiceModal invoiceId={view.invoice.id} onClose={() => setDialog(null)} />}
    </Modal>
  );
}
