import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp, useAuth } from '@/app/providers';
import { Art } from '@/components/art';
import { Icon } from '@/components/icons';
import { Button, Modal, SelectField, TextAreaField, TextField, useFeedback } from '@/components/ui';
import { AMENITIES, FACTS, GALLERY } from '@/data/siteContent';
import { HotelHero } from '@/features/hero3d/HotelHero';
import { useResource } from '@/hooks/useResource';
import { addDays, nightsBetween, today } from '@/lib/dates';
import { money } from '@/lib/format';
import { errorMessage, hasErrors, required, validEmail, validPhone } from '@/lib/validation';
import { authService, reservationService, roomService } from '@/services';
import type { Reservation, RoomCategory } from '@/types/domain';

interface StayQuery {
  checkIn: string;
  checkOut: string;
  categoryId: string;
  guests: number;
}

/* ---------- Stay request ---------- */

function RequestStay({ query, categories, onClose }: { query: StayQuery; categories: RoomCategory[]; onClose: () => void }) {
  const navigate = useNavigate();
  const { signInAs } = useAuth();
  const [form, setForm] = useState({
    ...query,
    categoryId: query.categoryId || categories[0]?.id,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [done, setDone] = useState<Reservation | null>(null);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const category = categories.find((c) => c.id === form.categoryId);
  const nights = form.checkOut > form.checkIn ? nightsBetween(form.checkIn, form.checkOut) : 0;

  const { data: roomsLeft } = useResource(async () => {
    if (form.checkOut <= form.checkIn) return null;
    const counts = await Promise.all(categories.map((c) => roomService.sellable({ checkIn: form.checkIn, checkOut: form.checkOut }, c.id)));
    return new Map(categories.map((c, i) => [c.id, counts[i]]));
  }, [form.checkIn, form.checkOut, categories]);

  // "Any room type" opens on the first type that actually has room for these dates.
  const [choseType, setChoseType] = useState(!!query.categoryId);
  useEffect(() => {
    if (choseType || !roomsLeft) return;
    const available = categories.find((c) => (roomsLeft.get(c.id) ?? 0) > 0);
    if (available) setForm((f) => ({ ...f, categoryId: available.id }));
  }, [roomsLeft, choseType, categories]);

  const left = roomsLeft?.get(form.categoryId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      firstName: required(form.firstName, 'First name'),
      lastName: required(form.lastName, 'Last name'),
      email: required(form.email, 'Email') || validEmail(form.email),
      phone: required(form.phone, 'Phone') || validPhone(form.phone),
      checkIn: form.checkIn < today() ? 'Choose today or a later date' : '',
      checkOut: form.checkOut <= form.checkIn ? 'Must be after check-in' : '',
      guests: category && Number(form.guests) > category.capacity ? `${category.name} sleeps up to ${category.capacity}` : '',
    };
    setErrors(next);
    if (hasErrors(next)) return;
    setFailure('');
    try {
      const reservation = await reservationService.requestFromWebsite({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        categoryId: form.categoryId,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        adults: Number(form.guests),
        children: 0,
        notes: form.notes,
      });
      setDone(reservation);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  if (done) {
    return (
      <div className="site-modal">
        <Modal
          title="Your request is with the front desk"
          onClose={onClose}
          footer={
            <>
              <Button onClick={onClose}>Back to the site</Button>
              <Button
                variant="primary"
                icon="arrow"
                onClick={async () => {
                  await signInAs('user-reception');
                  navigate(`/app/reservations?open=${done.id}`);
                }}
              >
                See it as the front desk
              </Button>
            </>
          }
        >
          <div className="stack-sm">
            <div className="alert alert-good"><Icon name="check" /><span>Reference <b>{done.code}</b> has been created.</span></div>
            <p className="muted">
              This is the demo moment: the request has just landed in the software as a pending booking,
              with a guest profile and an open folio, waiting to be confirmed and given a room.
            </p>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <Modal
      title="Request your stay"
      subtitle="No payment is taken. This creates a pending booking in the demo."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="request-stay">Send request</Button>
        </>
      }
    >
      <form id="request-stay" className="form-grid" onSubmit={submit} noValidate>
        <SelectField
          label="Room type"
          value={form.categoryId}
          onChange={(e) => {
            setChoseType(true);
            set('categoryId')(e);
          }}
          wrapClass="full"
          error={left === 0 ? 'Sold out for these dates. Try another room type or other dates.' : undefined}
          hint={left ? `${left} room${left === 1 ? '' : 's'} left for these dates` : undefined}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · from {money(c.basePrice)} a night{roomsLeft?.get(c.id) === 0 ? ' (sold out)' : ''}
            </option>
          ))}
        </SelectField>
        <TextField label="Check-in" type="date" min={today()} value={form.checkIn} onChange={set('checkIn')} error={errors.checkIn} />
        <TextField label="Check-out" type="date" min={form.checkIn} value={form.checkOut} onChange={set('checkOut')} error={errors.checkOut} />
        <TextField label="First name" value={form.firstName} onChange={set('firstName')} error={errors.firstName} autoComplete="off" />
        <TextField label="Last name" value={form.lastName} onChange={set('lastName')} error={errors.lastName} autoComplete="off" />
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="off" />
        <TextField label="Phone" value={form.phone} onChange={set('phone')} error={errors.phone} autoComplete="off" />
        <TextField label="Guests" type="number" min={1} value={form.guests} onChange={set('guests')} error={errors.guests} />
        <div className="field">
          <span className="field-label">Estimate before tax</span>
          <span className="serif" style={{ fontSize: 22 }}>{category && nights ? money(category.basePrice * nights) : '–'}</span>
          {nights > 0 && <span className="field-hint">{nights} night{nights === 1 ? '' : 's'}</span>}
        </div>
        <TextAreaField label="Anything we should know?" wrapClass="full" value={form.notes} onChange={set('notes')} />
        {failure && <div className="alert alert-bad full"><Icon name="alert" /><span>{failure}</span></div>}
      </form>
    </Modal>
  );
}

/* ---------- Demo access ---------- */

function DemoAccess() {
  const navigate = useNavigate();
  const { signInAs } = useAuth();
  const { run, toast } = useFeedback();
  const { data } = useResource(async () => {
    const [users, roles] = await Promise.all([authService.demoAccounts(), authService.roles()]);
    return users.map((user) => ({ user, role: roles.find((r) => r.id === user.roleId)! }));
  });

  const enter = (userId: string) =>
    run(async () => {
      await signInAs(userId);
      navigate('/app/dashboard');
    });

  const copy = async (email: string, password: string) => {
    try {
      await navigator.clipboard.writeText(`${email} / ${password}`);
      toast('Sample login copied');
    } catch {
      toast(`${email} / ${password}`);
    }
  };

  return (
    <section id="demo" className="demo-band">
      <div className="site-section">
        <div className="eyebrow">Product demonstration</div>
        <h2 className="site-h2">Step behind the front desk</h2>
        <p className="prose">
          Everything above is the guest's view of Checkmate Stays. Enter as one of four team members to run the
          hotel in Folio, our management suite. All data is fictional and resets with one click.
        </p>
        <div className="role-grid">
          {data?.map(({ user, role }) => (
            <article key={user.id} className="role-card" data-testid={`role-${role.id}`}>
              <h3>{role.name}</h3>
              <p>{role.description}</p>
              <div className="cred">
                <div><span>Email</span><code>{user.email}</code></div>
                <div><span>Password</span><code>{user.demoPassword}</code></div>
              </div>
              <Button variant="primary" block icon="arrow" onClick={() => enter(user.id)}>Enter as {role.name.replace(/^(Hotel|General) /, '')}</Button>
              <Button size="sm" block onClick={() => copy(user.email, user.demoPassword)}>Copy login</Button>
            </article>
          ))}
        </div>
        <p className="small" style={{ marginTop: 18, color: '#5a635d' }}>
          Prefer typing it in? <Link to="/login">Use the sign-in page</Link>.
        </p>
      </div>
    </section>
  );
}

/* ---------- Gallery ---------- */

function Gallery() {
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIndex(null);
      if (e.key === 'ArrowRight') setIndex((i) => (i === null ? i : (i + 1) % GALLERY.length));
      if (e.key === 'ArrowLeft') setIndex((i) => (i === null ? i : (i - 1 + GALLERY.length) % GALLERY.length));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index]);

  const active = index === null ? null : GALLERY[index];

  return (
    <section id="gallery" className="site-section">
      <div className="eyebrow">Gallery</div>
      <h2 className="site-h2">A walk around the court</h2>
      <div className="gallery">
        {GALLERY.map((item, i) => (
          <button
            key={item.art}
            type="button"
            aria-label={`View ${item.caption}`}
            style={{ gridColumn: `span ${item.span}`, height: item.tall ? 420 : 280 }}
            onClick={() => setIndex(i)}
          >
            <Art name={item.art} title={item.caption} />
            <span className="cap">{item.caption}</span>
          </button>
        ))}
      </div>
      {active && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={active.caption} onClick={(e) => e.target === e.currentTarget && setIndex(null)}>
          <button type="button" className="lb-close" aria-label="Close" onClick={() => setIndex(null)}><Icon name="x" size={20} /></button>
          <button type="button" aria-label="Previous image" onClick={() => setIndex((index! - 1 + GALLERY.length) % GALLERY.length)}><Icon name="prev" size={20} /></button>
          <figure>
            <Art name={active.art} title={active.caption} slice={false} />
            <figcaption>{active.caption}</figcaption>
          </figure>
          <button type="button" aria-label="Next image" onClick={() => setIndex((index! + 1) % GALLERY.length)}><Icon name="next" size={20} /></button>
        </div>
      )}
    </section>
  );
}

/* ---------- Page ---------- */

export default function Landing() {
  const { hotel } = useApp();
  const { data: categories } = useResource(() => roomService.categories());
  const [query, setQuery] = useState<StayQuery>({
    checkIn: addDays(today(), 7),
    checkOut: addDays(today(), 9),
    categoryId: '',
    guests: 2,
  });
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    document.title = `${hotel.name} · Folio hotel management demo`;
  }, [hotel.name]);

  const openRequest = (categoryId?: string) => {
    if (categoryId) setQuery((q) => ({ ...q, categoryId }));
    setRequesting(true);
  };

  return (
    <div className="site">
      <HotelHero />

      <form
        className="booking-bar"
        aria-label="Check availability"
        onSubmit={(e) => {
          e.preventDefault();
          openRequest();
        }}
      >
        <TextField label="Check-in" type="date" min={today()} value={query.checkIn} onChange={(e) => setQuery({ ...query, checkIn: e.target.value })} />
        <TextField label="Check-out" type="date" min={query.checkIn} value={query.checkOut} onChange={(e) => setQuery({ ...query, checkOut: e.target.value })} />
        <SelectField label="Room type" wrapClass="full" value={query.categoryId} onChange={(e) => setQuery({ ...query, categoryId: e.target.value })}>
          <option value="">Any room type</option>
          {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        <TextField label="Guests" type="number" min={1} max={6} value={query.guests} onChange={(e) => setQuery({ ...query, guests: Number(e.target.value) })} />
        <Button variant="primary" type="submit" className="full">Check dates</Button>
      </form>

      <section id="about" className="site-section about">
        <div>
          <div className="eyebrow">The hotel</div>
          <h2 className="site-h2">Built as a summer court. Kept as a place to rest.</h2>
          <p className="prose">
            Checkmate Stays was raised in 1926 as a lakeside retreat, and it has never quite lost the habit of
            hospitality. Thick lime walls keep the summers cool; the winters are spent beside the fire in the
            reading room. Our team of sixty has an average tenure of nine years, and many of them will know
            your name by the second morning.
          </p>
          <div className="facts">
            {FACTS.map((f) => <div key={f.label}><b>{f.value}</b><span>{f.label}</span></div>)}
          </div>
        </div>
        <div style={{ borderRadius: '180px 180px 6px 6px', overflow: 'hidden', height: 420 }}>
          <Art name="courtyard" title="The jasmine courtyard" />
        </div>
      </section>

      <section id="rooms" className="site-section" style={{ paddingTop: 0 }}>
        <div className="eyebrow">Rooms & suites</div>
        <h2 className="site-h2">Five ways to stay</h2>
        <div className="room-list">
          {categories?.map((c) => (
            <article key={c.id} className="room-row">
              <div className="room-art"><Art name={c.art} title={c.name} /></div>
              <div>
                <h3>{c.name}</h3>
                <p>{c.description}</p>
                <p className="small">{c.sizeSqm} m² · {c.bed} bed · {c.view} view · Sleeps {c.capacity}</p>
                <div className="tag-list" style={{ marginTop: 10 }}>
                  {c.amenities.slice(0, 5).map((a) => <span key={a} className="tag">{a}</span>)}
                </div>
              </div>
              <div className="room-price">
                <span className="small muted">From</span>
                <b>{money(c.basePrice)}</b>
                <span className="small muted">a night, before tax</span>
                <div style={{ marginTop: 10 }}><Button onClick={() => openRequest(c.id)}>Request</Button></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="amenities" className="band">
        <div className="site-section">
          <div className="eyebrow">Facilities</div>
          <h2 className="site-h2">Everything within a short walk</h2>
          <div className="amenity-grid">
            {AMENITIES.map((a) => (
              <div key={a.title} className="amenity">
                <h3>{a.title}</h3>
                <p>{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Gallery />
      <DemoAccess />

      <footer id="visit" className="site-foot">
        <div className="site-foot-inner">
          <div>
            <h3>{hotel.name}</h3>
            <p>{hotel.address}, {hotel.city}, {hotel.country}</p>
            <p>Check-in from {hotel.checkInTime} · Check-out by {hotel.checkOutTime}</p>
          </div>
          <div>
            <h3>Reach us</h3>
            <p>{hotel.phone}</p>
            <p>{hotel.email}</p>
          </div>
          <div>
            <h3>About this demo</h3>
            <p>{hotel.name}, its people and its history are invented to demonstrate Folio. Contact details do not reach anyone, and no payment is ever taken.</p>
          </div>
        </div>
      </footer>

      {requesting && categories && <RequestStay query={query} categories={categories} onClose={() => setRequesting(false)} />}
    </div>
  );
}
