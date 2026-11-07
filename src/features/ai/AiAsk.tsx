import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '@/components/icons';

interface Topic {
  /** Chips shown above the input. Each has a written answer. */
  qa: { q: string; a: string }[];
  /** Keyword hints for free-typed questions, then a general answer when nothing matches. */
  keywords: { words: string[]; a: string }[];
  fallback: string;
}

/** Canned, simulated answers. Nothing here is computed or sent anywhere. */
const TOPICS: Record<string, Topic> = {
  '/app/ai/overview': {
    qa: [
      { q: 'Summarise today for me', a: 'Occupancy is tracking above last week, arrivals are front-loaded after 3 pm, and a few bookings carry a higher cancellation risk. The health score is 84, which is good.' },
      { q: 'Which arrivals might cancel?', a: 'The flagged bookings in “Cancellation prediction” below are the ones to reach first. Reminders to the top-risk guests protect the most revenue.' },
      { q: 'What should I act on first?', a: 'Start with the recommended actions below: reach at-risk bookings, then review the suggested rate changes in Smart Pricing.' },
    ],
    keywords: [
      { words: ['cancel', 'risk'], a: 'Cancellation risk is highest for non-refundable-free bookings made far ahead with no deposit. See the prediction panel below.' },
      { words: ['revenue', 'money'], a: 'Revenue looks on track this week. Smart Pricing and Revenue Insights hold the biggest opportunities.' },
    ],
    fallback: 'The Overview pulls the day together: a summary, a 14-day demand outlook, key predictions and recommended actions. Try one of the suggestions above.',
  },
  '/app/ai/smart-pricing': {
    qa: [
      { q: 'Which rooms should cost more this weekend?', a: 'Three of five categories are priced under the market. Raising those is where most of the estimated ₹5.1L a month comes from. The table below shows each one.' },
      { q: 'Show the biggest revenue gains', a: 'Sort the table by “Est. impact / month”. It is already sorted that way, so the top rows are the biggest gains.' },
      { q: 'Why is Deluxe underpriced?', a: 'Its rate sits below the market average while its occupancy is high, so demand suggests guests would still book at a higher price.' },
    ],
    keywords: [
      { words: ['confidence', 'sure'], a: 'Average confidence across suggestions is 83%. Smaller price moves carry higher confidence.' },
      { words: ['occupancy'], a: 'The suggested rates are expected to cost about 0.6 points of occupancy, outweighed by the rate gain.' },
    ],
    fallback: 'Smart Pricing compares your current rate, the suggested rate and the market average per room category. Ask about a category or the impact.',
  },
  '/app/ai/guest-timing': {
    qa: [
      { q: 'When do most guests arrive?', a: 'Most arrivals land between early afternoon and early evening, with a smaller wave late at night.' },
      { q: 'Which arrivals need early check-in?', a: 'Guests arriving off overnight travel are the likeliest to ask. Preparing those rooms first avoids a queue at the desk.' },
      { q: 'Plan late check-outs', a: 'Offer late check-out to guests whose rooms are not needed until the next evening. It is a low-effort upsell.' },
    ],
    keywords: [{ words: ['peak', 'busy', 'rush'], a: 'The desk is busiest in the mid-afternoon arrival window. Extra cover then keeps wait times short.' }],
    fallback: 'Guest Timing shows when guests arrive and leave so the desk and housekeeping can plan around it.',
  },
  '/app/ai/guest-insights': {
    qa: [
      { q: 'Who are my most loyal guests?', a: 'Repeat guests with three or more stays rank highest. They tend to book direct and stay longer.' },
      { q: 'Which guests may book again?', a: 'Guests with a recent positive review and a stay under a year ago are the most likely to return.' },
      { q: 'What do families prefer?', a: 'Families lean towards connecting rooms, breakfast included and quieter floors.' },
    ],
    keywords: [{ words: ['vip', 'loyal', 'repeat'], a: 'Loyal guests are a small share of stays but a large share of revenue. A personal welcome goes a long way.' }],
    fallback: 'Guest Insights groups guests by behaviour and preference. Ask about a segment such as families, couples or business travellers.',
  },
  '/app/ai/occupancy-forecast': {
    qa: [
      { q: 'How busy is next month?', a: 'Demand builds through the month, with the strongest stretch around the weekends. The chart shows the likely range.' },
      { q: 'Which days will be quiet?', a: 'Mid-week days show the lowest predicted occupancy, which makes them good for promotions or maintenance.' },
      { q: 'Compare with last year', a: 'The forecast runs a little ahead of last year on most days. Turn on the last-year line in the chart to compare.' },
    ],
    keywords: [{ words: ['weekend', 'friday', 'saturday'], a: 'Weekends are forecast to be the fullest days of the week.' }],
    fallback: 'The Occupancy Forecast predicts how full the hotel will be, with a shaded range for how sure the prediction is.',
  },
  '/app/ai/review-intelligence': {
    qa: [
      { q: 'What do guests complain about most?', a: 'The themes marked negative below show it. Check the top one first; each comes with a suggested task.' },
      { q: 'Summarise this month’s reviews', a: 'Overall sentiment is positive. Guests praise service and location, and raise occasional points on speed and noise.' },
      { q: 'Which themes are improving?', a: 'Themes with a rising trend are shown with an upward marker. Housekeeping and breakfast are moving the right way.' },
    ],
    keywords: [{ words: ['praise', 'love', 'positive'], a: 'Staff friendliness and the location are the most praised themes.' }],
    fallback: 'Review Intelligence turns reviews into themes with sentiment. Ask about complaints, praise or trends.',
  },
  '/app/ai/staff-planner': {
    qa: [
      { q: 'How many housekeepers do I need Friday?', a: 'Friday has a heavy checkout and arrival load, so plan for a full team plus one floater in the morning.' },
      { q: 'Where are we understaffed?', a: 'Slots marked short in the planner are the gaps. They usually fall on weekend mornings.' },
      { q: 'Suggest a shift plan', a: 'Shift the start of one team earlier on busy days, and use a split shift to cover the afternoon arrival wave.' },
    ],
    keywords: [{ words: ['overtime', 'cost'], a: 'Spreading shifts evenly avoids most overtime. The plan below aims for that.' }],
    fallback: 'The Staff Planner matches the team to expected workload each day. Ask about a day or a department.',
  },
  '/app/ai/revenue-insights': {
    qa: [
      { q: 'Where can I earn more per guest?', a: 'Upselling room upgrades, breakfast and late check-out has the best return. See “Upselling suggestions” below.' },
      { q: 'Best upsell this week', a: 'Room upgrades for guests staying two nights or more convert best.' },
      { q: 'Forecast next quarter’s revenue', a: 'With the suggestions applied, revenue sits about 5 to 9 percent above the current pace.' },
    ],
    keywords: [{ words: ['restaurant', 'food', 'breakfast'], a: 'Breakfast packages add steady revenue with little extra effort.' }],
    fallback: 'Revenue Insights shows where revenue comes from and where more is possible. Try one of the suggestions above.',
  },
};

/** More ready-made questions per page, so the chat has something to offer after the first few. */
const EXTRA: Record<string, { q: string; a: string }[]> = {
  '/app/ai/overview': [
    { q: 'How is occupancy trending?', a: 'Occupancy is up about 4 points on the same weekday last week, and the 14-day outlook stays steady with a bump on the weekend.' },
    { q: 'Any issues I should know about?', a: 'Two rooms are waiting on maintenance and one VIP arrival has a special request. Neither blocks sales today.' },
  ],
  '/app/ai/smart-pricing': [
    { q: 'How confident are these prices?', a: 'Average confidence is 83%. Small moves of under 8% are the safest; larger jumps are worth a second look.' },
    { q: 'What if I apply all of them?', a: 'Estimated gain is about ₹5.1L a month, at a cost of roughly 0.6 points of occupancy.' },
  ],
  '/app/ai/guest-timing': [
    { q: 'When should housekeeping start?', a: 'Starting the first checkout floors at 10 am clears most rooms before the 2 pm arrival wave.' },
    { q: 'When is the front desk busiest?', a: 'Between 3 pm and 6 pm. Extra cover in that window keeps check-in under five minutes.' },
  ],
  '/app/ai/guest-insights': [
    { q: 'How far ahead do guests book?', a: 'On average 23 days out. Couples book about 31 days ahead and groups around 52.' },
    { q: 'Which segment spends the most?', a: 'Couples bring the most revenue at about ₹10.4K a stay, ahead of families on longer stays.' },
  ],
  '/app/ai/occupancy-forecast': [
    { q: 'What is the busiest week ahead?', a: 'The third week is forecast to peak, with Friday and Saturday close to full.' },
    { q: 'How accurate is the forecast?', a: 'Recent forecasts landed within about 4 points of actual occupancy. The shaded band shows the likely range.' },
  ],
  '/app/ai/review-intelligence': [
    { q: 'What do guests love most?', a: 'Staff friendliness and the location. Both appear in more than a third of positive reviews.' },
    { q: 'Any new complaints this week?', a: 'A few mentions of slow breakfast service on weekends. It is flagged with a suggested task below.' },
  ],
  '/app/ai/staff-planner': [
    { q: 'Which day is the busiest?', a: 'Saturday carries the heaviest workload, with a full checkout and a large arrival wave on the same day.' },
    { q: 'Can I reduce overtime?', a: 'Yes. Moving one shift start earlier on Friday and Saturday removes most predicted overtime.' },
  ],
  '/app/ai/revenue-insights': [
    { q: 'Which channel earns the most?', a: 'Direct bookings lead on revenue per stay because they avoid commission and tend to be longer.' },
    { q: 'How do I lift weekday revenue?', a: 'Weekday corporate packages with breakfast and late check-out fill quiet nights at a good margin.' },
  ],
};

function answerFor(topic: Topic, text: string) {
  const t = text.trim().toLowerCase();
  const exact = topic.qa.find((x) => x.q.toLowerCase() === t);
  if (exact) return exact.a;
  const hit = topic.keywords.find((k) => k.words.some((w) => t.includes(w)));
  return hit ? hit.a : topic.fallback;
}

/** Stays closed while moving between AI Insights pages, until the person reopens it. */
let askClosed = false;

/** `shown` is how many characters of the answer have been typed out so far. */
type Turn = { q: string; a?: string; shown: number };

/** Suggested prompts sit above the input, all inside one composer. Answers are written ahead of time; nothing is sent anywhere. */
export function AiAsk() {
  const { pathname } = useLocation();
  const base = TOPICS[pathname];
  const topic = base ? { ...base, qa: [...base.qa, ...(EXTRA[pathname] ?? [])] } : undefined;
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [closed, setClosed] = useState(askClosed);
  const timer = useRef<number>();
  const typer = useRef<number>();
  const end = useRef<HTMLDivElement>(null);
  const clearTimers = () => {
    window.clearTimeout(timer.current);
    window.clearInterval(typer.current);
  };
  useEffect(() => clearTimers, []);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'nearest' });
  }, [turns]);
  if (!topic) return null;

  const ask = (q: string) => {
    const value = q.trim();
    if (!value) return;
    clearTimers();
    setText('');
    // An interrupted answer is shown in full before the next question goes in.
    setTurns((t) => [...t.map((x) => (x.a ? { ...x, shown: x.a.length } : x)), { q: value, shown: 0 }].slice(-6));
    timer.current = window.setTimeout(() => {
      const a = answerFor(topic, value);
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a } : x)));
      typer.current = window.setInterval(() => {
        setTurns((t) =>
          t.map((x, i) => {
            if (i !== t.length - 1 || !x.a) return x;
            const next = Math.min(x.a.length, x.shown + 3);
            if (next >= x.a.length) window.clearInterval(typer.current);
            return { ...x, shown: next };
          }),
        );
      }, 22);
    }, 900);
  };

  const setClosedBoth = (v: boolean) => {
    askClosed = v;
    setClosed(v);
    if (v) {
      clearTimers();
      setTurns([]);
      setText('');
    }
  };

  if (closed) {
    return (
      <button type="button" className="ai-ask-reopen no-print" onClick={() => setClosedBoth(false)}>
        <Icon name="ai" size={14} /> Ask AI
      </button>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(text);
  };

  const asked = new Set(turns.map((t) => t.q));
  const chips = topic.qa.filter((x) => !asked.has(x.q)).slice(0, 4);
  const last = turns[turns.length - 1];
  const busy = !!last && (!last.a || last.shown < last.a.length);

  return (
    <form key={pathname} className="ai-ask no-print" onSubmit={submit} aria-label="Ask AI Insights">
      {turns.length > 0 && (
        <button type="button" className="ai-ask-close" aria-label="Close the question box" title="Close" onClick={() => setClosedBoth(true)}>
          <Icon name="x" size={15} />
        </button>
      )}
      {chips.length > 0 && (
        <div className="ai-ask-chips" role="group" aria-label="Suggested questions">
          {chips.map(({ q }) => (
            <button key={q} type="button" className="ai-ask-chip" disabled={busy} onClick={() => ask(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      <div className="ai-ask-row">
        <Icon name="ai" size={16} />
        <input
          className="ai-ask-input"
          aria-label="Ask a question about this page"
          placeholder={turns.length ? 'Ask a follow-up…' : 'Ask anything about this page…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="ai-ask-send" aria-label="Send" disabled={!text.trim() || busy}>
          <Icon name="arrow" size={16} />
        </button>
      </div>
      {turns.length > 0 && (
        <div className="ai-ask-thread" aria-live="polite">
          {turns.map((t, i) => (
            <div key={i} className="ai-ask-turn">
              <p className="ai-ask-q">{t.q}</p>
              {t.a ? (
                <p className="ai-ask-a">
                  <Icon name="ai" size={14} />
                  <span>
                    {t.a.slice(0, t.shown)}
                    {t.shown < t.a.length ? <span className="ai-caret" /> : <em> Simulated answer.</em>}
                  </span>
                </p>
              ) : (
                <p className="ai-ask-a"><span className="ai-dots" aria-label="Thinking"><i /><i /><i /></span></p>
              )}
            </div>
          ))}
          <div ref={end} />
        </div>
      )}
    </form>
  );
}
