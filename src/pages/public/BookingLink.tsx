import { useEffect, useState, type FormEvent } from 'react';
import { asksCelebrant, asksDate, emptyOccasionDraft, OCCASION_CHOICES, type OccasionDraft } from '@/domain/occasions';
import { useParams } from 'react-router-dom';
import { addDays, nightsBetween, today } from '@/lib/dates';
import { fmtDate, money } from '@/lib/format';
import { errorMessage } from '@/lib/validation';
import { publicLeadService, roomService, type PublicOffer } from '@/services';

/*
 * The page a lead lands on from their personal booking link. Public: no sign-in and no app shell. It
 * learns the hotel, the guest's first name and their own enquiry, nothing about anyone else. Styling
 * borrows the guest review page's self-contained look (see reviews.css).
 */

export default function BookingLink() {
  const { token = '' } = useParams();
  const [offer, setOffer] = useState<PublicOffer | null | undefined>(undefined);
  const [categoryId, setCategoryId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);
  const [notes, setNotes] = useState('');
  const [occasion, setOccasion] = useState<OccasionDraft>(emptyOccasionDraft());
  const [left, setLeft] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    document.title = 'Your stay';
    publicLeadService.offer(token).then((o) => {
      if (!live) return;
      setOffer(o);
      if (o) {
        const start = o.checkIn && o.checkIn >= today() ? o.checkIn : addDays(today(), 7);
        setCheckIn(start);
        setCheckOut(o.checkOut && o.checkOut > start ? o.checkOut : addDays(start, 2));
        setCategoryId(o.categoryId || o.categories[0]?.id || '');
        setGuests(o.adults || 2);
        if (o.bookedCode) setDone(o.bookedCode);
      }
    });
    return () => { live = false; };
  }, [token]);

  useEffect(() => {
    if (!offer || checkOut <= checkIn) return;
    let live = true;
    Promise.all(offer.categories.map((c) => roomService.sellable({ checkIn, checkOut }, c.id))).then((counts) => {
      if (live) setLeft(Object.fromEntries(offer.categories.map((c, i) => [c.id, counts[i]])));
    });
    return () => { live = false; };
  }, [offer, checkIn, checkOut]);

  if (offer === undefined) return <main className="gr" aria-busy="true" />;
  if (offer === null) {
    return (
      <main className="gr">
        <div className="gr-card gr-center" data-testid="booking-invalid">
          <p className="gr-kicker">Booking link</p>
          <h1>This link is not valid</h1>
          <p className="gr-lead">It may have been mistyped or replaced. Please ask the hotel to send you a new one.</p>
        </div>
      </main>
    );
  }

  const category = offer.categories.find((c) => c.id === categoryId);
  const nights = checkOut > checkIn ? nightsBetween(checkIn, checkOut) : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!category) return setError('Please choose a room type.');
    if (nights < 1) return setError('Check-out must be after check-in.');
    if (guests > category.capacity) return setError(`${category.name} sleeps up to ${category.capacity} guests.`);
    setBusy(true);
    setError('');
    try {
      const { code } = await publicLeadService.book(token, { categoryId, checkIn, checkOut, adults: guests, notes, occasion });
      setDone(code);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  if (done) {
    return (
      <main className="gr">
        <div className="gr-card gr-center" role="status" data-testid="booking-done" style={{ width: 'min(100%, 560px)' }}>
          <p className="gr-kicker">{offer.hotel.name}</p>
          <h1>Thank you, {offer.guestFirstName}</h1>
          <p className="gr-lead">Your stay request is with our team. Your reference is <b data-testid="booking-code">{done}</b>. We will confirm your room shortly{offer.hotel.phone ? ` or you can call us on ${offer.hotel.phone}` : ''}.</p>
          <p className="gr-lead">No payment has been taken.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="gr">
      <form className="gr-card bk-card" onSubmit={submit} noValidate data-testid="booking-form">
        <p className="gr-kicker">{offer.hotel.name} · {offer.hotel.city}</p>
        <h1>Hello {offer.guestFirstName}, your stay is nearly ready</h1>
        <p className="gr-lead">We have set this page up for you using what you told us. Check the details, choose a room and send your request. No payment is taken now.</p>

        <div className="gr-row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <label className="gr-field">Check-in
            <input type="date" min={today()} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (checkOut <= e.target.value) setCheckOut(addDays(e.target.value, 1)); }} />
          </label>
          <label className="gr-field">Check-out
            <input type="date" min={addDays(checkIn || today(), 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </label>
        </div>
        <label className="gr-field">Guests
          <input type="number" min={1} max={8} value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} />
        </label>

        <fieldset className="bk-rooms">
          <legend className="gr-field">Choose your room</legend>
          {offer.categories.map((c) => {
            const available = left[c.id];
            const soldOut = available === 0;
            return (
              <label key={c.id} className="bk-room" data-selected={c.id === categoryId || undefined} data-soldout={soldOut || undefined}>
                <input type="radio" name="room" value={c.id} checked={c.id === categoryId} disabled={soldOut} onChange={() => setCategoryId(c.id)} />
                <span className="bk-room-text">
                  <b>{c.name}</b>
                  <span>{c.bed} · {c.view} · sleeps {c.capacity}</span>
                  {c.id === offer.categoryId && <em>The room you asked about</em>}
                </span>
                <span className="bk-room-price">
                  {money(c.basePrice)}<small>/ night</small>
                  {soldOut ? <small>Sold out</small> : available !== undefined && available <= 3 ? <small>{available} left</small> : null}
                </span>
              </label>
            );
          })}
        </fieldset>

        <label className="gr-field">What’s the occasion for your stay? <em>(optional)</em>
          <select value={occasion.type} name="occasion-type" onChange={(e) => setOccasion({ ...occasion, type: e.target.value as OccasionDraft['type'] })}>
            <option value="">Select an occasion</option>
            {OCCASION_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        {occasion.type && occasion.type !== 'none' && (
          <>
            {asksDate(occasion.type) && (
              <label className="gr-field">Occasion date <em>(optional)</em>
                <input type="date" name="occasion-date" value={occasion.date} onChange={(e) => setOccasion({ ...occasion, date: e.target.value })} />
              </label>
            )}
            {asksCelebrant(occasion.type) && (
              <label className="gr-field">{occasion.type === 'anniversary' ? 'Whose anniversary is it?' : occasion.type === 'birthday' ? 'Whose birthday is it?' : 'Who are we celebrating?'} <em>(optional)</em>
                <input type="text" name="occasion-celebrant" maxLength={80} value={occasion.celebrant} onChange={(e) => setOccasion({ ...occasion, celebrant: e.target.value })} />
              </label>
            )}
            <label className="gr-field">Notes or preferences <em>(optional)</em>
              <textarea rows={2} maxLength={500} name="occasion-notes" value={occasion.notes} onChange={(e) => setOccasion({ ...occasion, notes: e.target.value })} />
            </label>
          </>
        )}

        <label className="gr-field">Anything we should know? <em>(optional)</em>
          <textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {category && nights > 0 && (
          <p className="bk-summary" data-testid="booking-summary">
            {nights} night{nights === 1 ? '' : 's'} · {fmtDate(checkIn)} to {fmtDate(checkOut)} · {money(category.basePrice * nights)} before taxes
          </p>
        )}
        {error && <p className="gr-error" role="alert" data-testid="booking-error">{error}</p>}
        <button type="submit" className="gr-submit" disabled={busy} data-ready={category && nights > 0 ? 'yes' : 'no'}>
          {busy ? 'Sending…' : 'Request this stay'}
        </button>
      </form>
    </main>
  );
}
