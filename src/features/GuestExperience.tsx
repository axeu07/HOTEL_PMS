import { useMemo, useState } from 'react';
import { Icon } from '@/components/icons';
import { downloadQrPng, QrCode } from '@/components/qr';
import { Badge, Button, EmptyState, Modal, Panel, useFeedback } from '@/components/ui';
import { newestFirst, RATINGS, RATING_FACES, reviewsInPeriod, reviewsWithRating, summarizeReviews, type DatePreset } from '@/domain/reviews';
import { useApp } from '@/app/providers';
import { useNow } from '@/hooks/useNow';
import { useResource } from '@/hooks/useResource';
import { fmtDate, fmtTime } from '@/lib/format';
import { toISODate } from '@/lib/dates';
import { reviewService } from '@/services';
import type { GuestReview, ReviewRating } from '@/types/domain';

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: '90', label: 'Last 90 days' },
  { id: 'custom', label: 'Custom range' },
];

const PAGE_SIZE = 8;

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="gx-stars" role="img" aria-label={`${value} out of 5`} style={{ fontSize: size }}>
      {RATINGS.map((n) => <span key={n} data-on={n <= Math.round(value) || undefined}>★</span>)}
    </span>
  );
}

function ReviewCard({ review }: { review: GuestReview }) {
  const face = RATING_FACES[review.rating];
  const day = toISODate(new Date(review.createdAt));
  return (
    <li className="gx-review" data-testid="review-item" data-rating={review.rating}>
      <span className="gx-review-face" aria-hidden="true">{face.emoji}</span>
      <div className="gx-review-main">
        <div className="gx-review-top">
          <strong data-testid="review-guest">{review.guestName || 'Guest'}</strong>
          {review.roomNumber && <Badge tone="quiet">Room {review.roomNumber}</Badge>}
          <Stars value={review.rating} size={14} />
          <span className="gx-review-rating">{review.rating}/5 · {face.label}</span>
        </div>
        {review.comment ? <p className="gx-review-comment">{review.comment}</p> : <p className="gx-review-comment muted">No written comment</p>}
      </div>
      <time className="gx-review-date" dateTime={review.createdAt}>{fmtDate(day)}<br />{fmtTime(review.createdAt)}</time>
    </li>
  );
}

function QrDialog({ onClose }: { onClose: () => void }) {
  const { hotel } = useApp();
  const { toast } = useFeedback();
  const { data: url } = useResource(() => reviewService.publicUrl());
  const slug = hotel.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url!);
      toast('Review link copied');
    } catch {
      toast('Copy is blocked here. Select the link and copy it by hand.');
    }
  };

  return (
    <Modal
      title="Guest review QR"
      subtitle="Guests scan this to rate their stay. No sign-in needed."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button icon="download" disabled={!url} onClick={() => downloadQrPng(url!, `${slug}-review-qr.png`)}>Download PNG</Button>
          <Button variant="primary" icon="print" disabled={!url} onClick={() => window.print()}>Print</Button>
        </>
      }
    >
      {url && (
        <div className="print-area gx-poster" data-testid="review-qr-poster">
          <p className="gx-poster-kicker">{hotel.name}</p>
          <h3 className="gx-poster-title">How was your stay?</h3>
          <p className="gx-poster-sub">Scan with your phone camera to share your feedback. It takes less than a minute.</p>
          <QrCode value={url} label={`QR code to review ${hotel.name}`} />
          <p className="gx-poster-url" data-testid="review-url">{url}</p>
        </div>
      )}
      <div className="gx-qr-tools no-print">
        <Button size="sm" icon="check" onClick={copy} disabled={!url}>Copy link</Button>
        <a className="btn btn-sm" href={url ?? '#'} target="_blank" rel="noreferrer">Open guest page</a>
      </div>
      <p className="small muted no-print gx-qr-note">
        <Icon name="info" size={14} /> The code opens the page on this site&apos;s address. A phone can only reach it if this site is hosted somewhere the phone can open.
      </p>
    </Modal>
  );
}

export function GuestExperience() {
  const now = useNow();
  const { data: reviews } = useResource(() => reviewService.list());
  const [rating, setRating] = useState<ReviewRating | null>(null);
  const [preset, setPreset] = useState<DatePreset>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [qrOpen, setQrOpen] = useState(false);

  const inPeriod = useMemo(() => reviewsInPeriod(reviews ?? [], { preset, from, to }, now), [reviews, preset, from, to, now]);
  const summary = useMemo(() => summarizeReviews(inPeriod), [inPeriod]);
  const list = useMemo(() => newestFirst(reviewsWithRating(inPeriod, rating)), [inPeriod, rating]);
  const everything = reviews?.length ?? 0;
  const filtered = rating !== null || preset !== 'all';

  return (
    <>
      <Panel
        className="gx-hero"
        icon="star"
        title="Guest reviews"
        subtitle="What guests say after scanning the review QR at the hotel"
        actions={<Button variant="primary" icon="plus" onClick={() => setQrOpen(true)}>Generate Review QR</Button>}
      >
        <div className="panel-body">
        {!reviews ? (
          <div className="skeleton" style={{ height: 150 }} aria-busy="true" />
        ) : everything === 0 ? (
          <EmptyState
            icon="star"
            title="No reviews yet"
            message="Generate the review QR and place it in rooms or at the front desk. Reviews appear here as soon as guests send them."
          />
        ) : (
          <div className="gx-summary">
            <div className="gx-average">
              <div className="gx-average-value" data-testid="review-average">{summary.average === null ? '–' : summary.average.toFixed(1)}</div>
              <div className="gx-average-scale">out of 5</div>
              {summary.average !== null && <Stars value={summary.average} size={20} />}
              <div className="gx-average-count"><span data-testid="review-total">{summary.count}</span> {summary.count === 1 ? 'review' : 'reviews'}</div>
            </div>
            <div className="gx-distribution" role="list" aria-label="Rating distribution">
              {[...RATINGS].reverse().map((n) => {
                const count = summary.distribution[n];
                const pct = summary.count ? (count / summary.count) * 100 : 0;
                return (
                  <div key={n} className="gx-bar" role="listitem" data-testid={`review-dist-${n}`}>
                    <span className="gx-bar-label">{n} <span aria-hidden="true">★</span></span>
                    <span className="gx-bar-track"><span className="gx-bar-fill" style={{ width: `${pct}%` }} /></span>
                    <span className="gx-bar-count" data-testid={`review-dist-count-${n}`}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </Panel>

      {everything > 0 && (
        <Panel title="Recent feedback" subtitle={`${list.length} ${list.length === 1 ? 'review' : 'reviews'}${filtered ? ' match the filters' : ''}`}>
          <div className="panel-body">
          <div className="gx-filters">
            <div className="segmented" role="group" aria-label="Filter by rating">
              <button type="button" aria-pressed={rating === null} onClick={() => { setRating(null); setShown(PAGE_SIZE); }}>All ratings</button>
              {[...RATINGS].reverse().map((n) => (
                <button key={n} type="button" aria-pressed={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => { setRating(n); setShown(PAGE_SIZE); }}>
                  {n} ★ <span className="qa-seg-count">{summary.distribution[n]}</span>
                </button>
              ))}
            </div>
            <select className="input gx-date" aria-label="Date range" value={preset} onChange={(e) => { setPreset(e.target.value as DatePreset); setShown(PAGE_SIZE); }}>
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            {preset === 'custom' && (
              <div className="gx-range">
                <input className="input" type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                <span aria-hidden="true">to</span>
                <input className="input" type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </div>
            )}
          </div>

          {list.length === 0 ? (
            <EmptyState icon="search" title="No reviews match" message="Try another rating or a wider date range." action={<Button onClick={() => { setRating(null); setPreset('all'); setFrom(''); setTo(''); }}>Clear filters</Button>} />
          ) : (
            <>
              <ul className="gx-list">{list.slice(0, shown).map((r) => <ReviewCard key={r.id} review={r} />)}</ul>
              {list.length > shown && (
                <button type="button" className="link-btn small qa-more" onClick={() => setShown((n) => n + PAGE_SIZE)}>Show more ({list.length - shown} left)</button>
              )}
            </>
          )}
          </div>
        </Panel>
      )}

      {qrOpen && <QrDialog onClose={() => setQrOpen(false)} />}
    </>
  );
}
