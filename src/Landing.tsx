import { useEffect, useState, type FormEvent } from 'react';
import { Art } from '@/components/art';
import { DoorEntrance } from '@/components/DoorEntrance';
import { FacilityArt } from '@/components/facilityArt';
import { Icon } from '@/components/icons';
import { CountUp, GlowDefs, Reveal, useCarousel } from '@/components/motion';
import { RoomScene } from '@/components/roomScenes';
import { RidgeDivider, VisitScene } from '@/components/visitScene';
import { Button, Modal, SelectField, TextAreaField, TextField } from '@/components/ui';
import { AMENITIES, FACTS, GALLERY, type GalleryItem, HOTEL as hotel, ROOM_CATEGORIES as categories } from '@/data/site';
import { HotelHero } from '@/features/hero3d/HotelHero';
import { addDays, nightsBetween, today } from '@/lib/dates';
import { money } from '@/lib/format';
import { hasErrors, required, validEmail, validPhone } from '@/lib/validation';

interface StayQuery {
  checkIn: string;
  checkOut: string;
  categoryId: string;
  guests: number;
}

/* ---------- Stay request ---------- */

/** There is no booking backend: sending a request opens the visitor's email app with the details filled in. */
function RequestStay({ query, onClose }: { query: StayQuery; onClose: () => void }) {
  const [form, setForm] = useState({
    ...query,
    categoryId: query.categoryId || categories[0].id,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const category = categories.find((c) => c.id === form.categoryId);
  const nights = form.checkOut > form.checkIn ? nightsBetween(form.checkIn, form.checkOut) : 0;

  const submit = (e: FormEvent) => {
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

    const body = [
      `Room type: ${category?.name}`,
      `Check-in: ${form.checkIn}`,
      `Check-out: ${form.checkOut} (${nights} night${nights === 1 ? '' : 's'})`,
      `Guests: ${form.guests}`,
      '',
      `Name: ${form.firstName} ${form.lastName}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone}`,
      form.notes ? `\nNotes: ${form.notes}` : '',
    ].join('\n');
    window.location.href = `mailto:${hotel.email}?subject=${encodeURIComponent(`Stay request: ${category?.name}`)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  if (sent) {
    return (
      <div className="site-modal">
        <Modal title="Your request is ready to send" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Back to the site</Button>}>
          <div className="stack-sm">
            <div className="alert alert-good"><Icon name="check" /><span>We opened your email app with the details filled in.</span></div>
            <p className="muted">Press send there and the front desk will reply to confirm availability. Prefer to call? Reach us on {hotel.phone}.</p>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <Modal
      title="Request your stay"
      subtitle="No payment is taken. We confirm availability by email."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="request-stay">Send request</Button>
        </>
      }
    >
      <form id="request-stay" className="form-grid" onSubmit={submit} noValidate>
        <SelectField label="Room type" value={form.categoryId} onChange={set('categoryId')} wrapClass="full">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name} · from {money(c.basePrice)} a night</option>
          ))}
        </SelectField>
        <TextField label="Check-in" type="date" min={today()} value={form.checkIn} onChange={set('checkIn')} error={errors.checkIn} />
        <TextField label="Check-out" type="date" min={form.checkIn} value={form.checkOut} onChange={set('checkOut')} error={errors.checkOut} />
        <TextField label="First name" value={form.firstName} onChange={set('firstName')} error={errors.firstName} autoComplete="given-name" />
        <TextField label="Last name" value={form.lastName} onChange={set('lastName')} error={errors.lastName} autoComplete="family-name" />
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" />
        <TextField label="Phone" value={form.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" />
        <TextField label="Guests" type="number" min={1} value={form.guests} onChange={set('guests')} error={errors.guests} />
        <div className="field">
          <span className="field-label">Estimate before tax</span>
          <span className="serif" style={{ fontSize: 22 }}>{category && nights ? money(category.basePrice * nights) : '–'}</span>
          {nights > 0 && <span className="field-hint">{nights} night{nights === 1 ? '' : 's'}</span>}
        </div>
        <TextAreaField label="Anything we should know?" wrapClass="full" value={form.notes} onChange={set('notes')} />
      </form>
    </Modal>
  );
}

/* ---------- Gallery ---------- */

const photoUrl = (file: string) => `${import.meta.env.BASE_URL}images/gallery/${file}`;

function GalleryPicture({ item, slice = true }: { item: GalleryItem; slice?: boolean }) {
  if (item.photo) return <img className="g-photo" src={photoUrl(item.photo)} alt={item.caption} loading="lazy" decoding="async" />;
  return <Art name={item.art ?? 'courtyard'} title={item.caption} slice={slice} />;
}

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
      <Reveal>
        <div className="eyebrow peak">Gallery</div>
        <h2 className="site-h2">A walk around the court</h2>
        <span className="sec-rule" />
        <p className="sec-lede">Balconies above the snowline, tea with the peaks in view, breakfast on the terrace. Tap any picture to see it larger.</p>
      </Reveal>
      <div className="gallery">
        {GALLERY.map((item, i) => (
          <Reveal key={item.photo ?? item.art} className="g-item" delay={(i % 3) * 110} style={{ gridColumn: item.start ? `${item.start} / span ${item.span}` : `span ${item.span}`, height: item.height }}>
            <button type="button" aria-label={`View ${item.caption}`} onClick={() => setIndex(i)}>
              <GalleryPicture item={item} />
              <span className="zoom" aria-hidden="true"><Icon name="arrow" size={16} /></span>
              <span className="cap">{item.caption}</span>
            </button>
          </Reveal>
        ))}
      </div>
      {active && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={active.caption} onClick={(e) => e.target === e.currentTarget && setIndex(null)}>
          <button type="button" className="lb-close" aria-label="Close" onClick={() => setIndex(null)}><Icon name="x" size={20} /></button>
          <button type="button" aria-label="Previous image" onClick={() => setIndex((index! - 1 + GALLERY.length) % GALLERY.length)}><Icon name="prev" size={20} /></button>
          <figure>
            <GalleryPicture item={active} slice={false} />
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
  const [query, setQuery] = useState<StayQuery>({
    checkIn: addDays(today(), 7),
    checkOut: addDays(today(), 9),
    categoryId: '',
    guests: 2,
  });
  const [requesting, setRequesting] = useState(false);
  const rooms = useCarousel<HTMLDivElement>();
  const facilities = useCarousel<HTMLDivElement>();

  useEffect(() => {
    document.title = `${hotel.name} · ${hotel.tagline}`;
  }, []);

  const openRequest = (categoryId?: string) => {
    if (categoryId) setQuery((q) => ({ ...q, categoryId }));
    setRequesting(true);
  };

  return (
    <div className="site">
      <GlowDefs />
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
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        <TextField label="Guests" type="number" min={1} max={6} value={query.guests} onChange={(e) => setQuery({ ...query, guests: Number(e.target.value) })} />
        <Button variant="primary" type="submit" className="full">Check dates</Button>
      </form>

      <section id="about" className="site-section about">
        <div>
          <div className="eyebrow">The hotel</div>
          <h2 className="site-h2">Built as a summer court. Kept as a place to rest.</h2>
          <p className="prose">
            {hotel.name} was raised in 1926 as a lakeside retreat, and it has never quite lost the habit of
            hospitality. Thick lime walls keep the summers cool; the winters are spent beside the fire in the
            reading room. Our team of sixty has an average tenure of nine years, and many of them will know
            your name by the second morning.
          </p>
          <div className="facts">
            {FACTS.map((f) => <div key={f.label}><b>{f.value}</b><span>{f.label}</span></div>)}
          </div>
        </div>
      </section>

      <DoorEntrance />

      <section id="rooms" className="site-section" style={{ paddingTop: 0 }}>
        <Reveal>
          <div className="eyebrow peak">Rooms & suites</div>
          <h2 className="site-h2">Four ways to stay</h2>
          <span className="sec-rule" />
          <p className="sec-lede">From a cosy valley-view Standard to a Suite with its own fire, every room looks out at the mountains.</p>
        </Reveal>
        <div className="room-grid" ref={rooms.ref}>
          {categories.map((c, i) => (
            <Reveal key={c.id} className="room-slot" delay={i * 120}>
              <article className={`room-ad${c.id === 'cat-premium' ? ' is-featured' : ''}`}>
                <div className="scene">
                  <RoomScene scene={c.scene} />
                  <span className="ad-badge">{c.badge}</span>
                  <span className="ad-code">{c.code}</span>
                </div>
                <div className="ad-body">
                  <h3>{c.name}</h3>
                  <p className="ad-tagline">{c.tagline}</p>
                  <p className="ad-desc">{c.description}</p>
                  <ul className="ad-specs">
                    <li><Icon name="size" size={15} />{c.sizeSqm} m²</li>
                    <li><Icon name="bed" size={15} />{c.bed}</li>
                    <li><Icon name="guests" size={15} />Sleeps {c.capacity}</li>
                    <li><Icon name="view" size={15} />{c.view}</li>
                  </ul>
                  <div className="tag-list ad-tags">
                    {c.amenities.slice(0, 2).map((a) => <span key={a} className="tag">{a}</span>)}
                    {c.amenities.length > 2 && <span className="tag">+{c.amenities.length - 2} more</span>}
                  </div>
                  <div className="ad-foot">
                    <div className="ad-price">
                      <small>From</small>
                      <b><CountUp value={c.basePrice} /></b>
                      <small>a night, before tax</small>
                    </div>
                    <Button variant="primary" className="ad-cta" onClick={() => openRequest(c.id)} aria-label={`Request a ${c.name} room`}>
                      Request <Icon name="arrow" size={16} />
                    </Button>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
        <div className="room-dots" role="tablist" aria-label="Choose a room">
          {categories.map((c, i) => (
            <button key={c.id} type="button" role="tab" aria-selected={rooms.active === i} aria-label={c.name} className={rooms.active === i ? 'on' : ''} onClick={() => rooms.goTo(i)} />
          ))}
        </div>
        <p className="room-swipe">Swipe to see all four rooms</p>
      </section>

      <RidgeDivider from="#f6f1e5" to="#14302a" />

      <section id="amenities" className="band">
        <div className="site-section">
          <Reveal>
            <div className="eyebrow peak">Facilities</div>
            <h2 className="site-h2">Everything within a short walk</h2>
            <span className="sec-rule" />
            <p className="sec-lede">Steam off the kitchen, a fire in the reading room, lanterns over the courtyard: a day at the hotel, from first light to last.</p>
          </Reveal>
          <div className="facility-grid" ref={facilities.ref}>
            {AMENITIES.map((a, i) => (
              <Reveal key={a.title} className="facility-slot" delay={(i % 3) * 120}>
                <div className="facility">
                  <div className="art"><FacilityArt name={a.key} title={a.title} /></div>
                  <div className="facility-text">
                    <div className="facility-kicker">{a.kicker}</div>
                    <h3>{a.title}</h3>
                    <p>{a.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="room-dots" role="tablist" aria-label="Choose a facility">
            {AMENITIES.map((a, i) => (
              <button key={a.title} type="button" role="tab" aria-selected={facilities.active === i} aria-label={a.title} className={facilities.active === i ? 'on' : ''} onClick={() => facilities.goTo(i)} />
            ))}
          </div>
          <p className="room-swipe">Swipe to see all six</p>
        </div>
      </section>

      <RidgeDivider from="#14302a" to="#f6f1e5" />

      <Gallery />

      <RidgeDivider from="#f6f1e5" to="#0a1426" />

      <footer id="visit" className="visit">
        <Reveal className="visit-top">
          <VisitScene />
          <div className="visit-hero">
            <div className="eyebrow">Visit</div>
            <h2>Come up for the weekend</h2>
            <p>{hotel.tagline}. Check-in from {hotel.checkInTime}, with a fire lit if the evening turns cold.</p>
            <div className="visit-actions">
              <Button variant="primary" onClick={() => openRequest()}>Request your stay</Button>
              <a className="btn" href={`tel:${hotel.phone.replace(/\s/g, '')}`}>Call the front desk</a>
            </div>
          </div>
        </Reveal>
        <div className="visit-body">
          <div className="visit-grid">
            <Reveal className="visit-card">
              <span className="ico"><Icon name="pin" size={20} /></span>
              <div>
                <h3>Find us</h3>
                <p>{hotel.address}</p>
                <p>{hotel.city}, {hotel.country}</p>
              </div>
            </Reveal>
            <Reveal className="visit-card" delay={120}>
              <span className="ico"><Icon name="phone" size={20} /></span>
              <div>
                <h3>Reach us</h3>
                <p><a href={`tel:${hotel.phone.replace(/\s/g, '')}`}>{hotel.phone}</a></p>
                <p><a href={`mailto:${hotel.email}`}>{hotel.email}</a></p>
              </div>
            </Reveal>
            <Reveal className="visit-card" delay={240}>
              <span className="ico"><Icon name="clock" size={20} /></span>
              <div>
                <h3>Arrivals</h3>
                <p>Check-in from {hotel.checkInTime}</p>
                <p>Check-out by {hotel.checkOutTime}</p>
              </div>
            </Reveal>
          </div>
          <div className="visit-legal">
            <span>© {new Date().getFullYear()} {hotel.name}</span>
            <span>{hotel.city}, {hotel.country}</span>
          </div>
        </div>
      </footer>

      {requesting && <RequestStay query={query} onClose={() => setRequesting(false)} />}
    </div>
  );
}
