import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { COMMENT_MAX, NAME_MAX, RATINGS, RATING_FACES, ROOM_MAX } from '@/domain/reviews';
import { errorMessage } from '@/lib/validation';
import { publicReviewService, type PublicHotel } from '@/services';
import type { ReviewRating } from '@/types/domain';

/*
 * The page a guest lands on after scanning the QR. Public: no sign-in, no app shell, and it only ever
 * learns the hotel's name and tagline. Styling is self-contained (see reviews.css).
 */

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

function ThankYou({ hotel, rating }: { hotel: PublicHotel; rating: ReviewRating }) {
  const warm = rating >= 4;
  return (
    <div className="gr-thanks" role="status" data-testid="review-thanks">
      <svg className="gr-check" viewBox="0 0 80 80" aria-hidden="true">
        <circle className="gr-check-ring" cx="40" cy="40" r="34" />
        <path className="gr-check-tick" d="M25 41l11 11 20-23" />
      </svg>
      <div className="gr-sparks" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => <span key={i} style={{ ['--i' as string]: i }} />)}
      </div>
      <h1>Thank you!</h1>
      <p>{warm ? `We're delighted you enjoyed ${hotel.name}. Your words mean a lot to our team.` : `Thank you for being honest with us. Our team at ${hotel.name} will read every word.`}</p>
      <p className="gr-thanks-sign">We hope to welcome you back.</p>
    </div>
  );
}

export default function GuestReview() {
  const { token = '' } = useParams();
  const [hotel, setHotel] = useState<PublicHotel | null | undefined>(undefined);
  const [rating, setRating] = useState<ReviewRating | null>(null);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [trap, setTrap] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const sending = useRef(false);

  useEffect(() => {
    let live = true;
    publicReviewService.hotel(token).then((h) => live && setHotel(h));
    document.title = 'Share your stay';
    return () => { live = false; };
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending.current) return; // A second tap while the first is in flight does nothing.
    if (!rating) {
      setError('Please choose how your stay was.');
      return;
    }
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      await publicReviewService.submit(token, { rating, comment, guestName: name, roomNumber: room, submissionKey: key.current, website: trap });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
      sending.current = false;
    } finally {
      setBusy(false);
    }
  };

  if (hotel === undefined) return <main className="gr" aria-busy="true" />;

  if (hotel === null) {
    return (
      <main className="gr">
        <div className="gr-card gr-center" data-testid="review-invalid">
          <h1>This link isn&apos;t valid</h1>
          <p>Please scan the QR code at the hotel again, or ask the front desk for help.</p>
        </div>
      </main>
    );
  }

  const face = rating ? RATING_FACES[rating] : null;

  return (
    <main className="gr">
      <div className="gr-card">
        {done && rating ? (
          <ThankYou hotel={hotel} rating={rating} />
        ) : (
          <form onSubmit={submit} noValidate aria-describedby={error ? 'gr-error' : undefined}>
            <p className="gr-kicker">{hotel.name}</p>
            <h1>How was your stay at {hotel.name}?</h1>
            <p className="gr-lead">Tap the face that fits best.</p>

            <div className="gr-faces" role="radiogroup" aria-label="Your rating">
              {RATINGS.map((n) => {
                const f = RATING_FACES[n];
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} – ${f.label}`}
                    className="gr-face"
                    data-rating={n}
                    data-state={rating === null ? 'idle' : rating === n ? 'on' : 'off'}
                    onClick={() => { setRating(n); setError(''); }}
                  >
                    <span className="gr-float" aria-hidden="true">
                      <span className="gr-emoji"><span className="gr-glyph">{f.emoji}</span></span>
                      {rating === n && (
                        <span className="gr-stars">
                          {Array.from({ length: 6 }, (_, i) => <i key={i} style={{ ['--a' as string]: `${i * 60 + 20}deg`, ['--s' as string]: i % 2 ? 0.7 : 1 }} />)}
                        </span>
                      )}
                    </span>
                    <span className="gr-face-label">{f.label}</span>
                  </button>
                );
              })}
            </div>

            <p className="gr-message" aria-live="polite" data-testid="review-message" key={rating ?? 0}>{face?.message ?? ' '}</p>

            <label className="gr-field">
              <span>Tell us more <em>(optional)</em></span>
              <textarea rows={4} maxLength={COMMENT_MAX} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What did you love, or what could we do better?" />
              <small>{comment.length}/{COMMENT_MAX}</small>
            </label>

            <div className="gr-row">
              <label className="gr-field">
                <span>Your name <em>(optional)</em></span>
                <input type="text" autoComplete="name" maxLength={NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="gr-field">
                <span>Room <em>(optional)</em></span>
                <input type="text" inputMode="text" maxLength={ROOM_MAX} value={room} onChange={(e) => setRoom(e.target.value)} />
              </label>
            </div>

            {/* Real guests never see or fill this. */}
            <div className="gr-trap" aria-hidden="true">
              <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
            </div>

            {error && <p id="gr-error" className="gr-error" role="alert">{error}</p>}

            <button type="submit" className="gr-submit" disabled={busy} data-ready={rating ? 'yes' : 'no'}>
              {busy ? 'Sending…' : 'Submit Review'}
            </button>
            <p className="gr-privacy">Your feedback goes only to {hotel.name}.</p>
          </form>
        )}
      </div>
    </main>
  );
}
