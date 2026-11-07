import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icons';
import { Mascot } from './Mascot';

type Mode = 'closed' | 'open' | 'minimized';
const KEY = 'folio.demo.assistant';

function readMode(): Mode {
  try {
    const v = sessionStorage.getItem(KEY);
    return v === 'open' || v === 'minimized' ? v : 'closed';
  } catch {
    return 'closed';
  }
}

interface Msg {
  from: 'bot' | 'me';
  text: string;
}

const GREETING: Msg = { from: 'bot', text: 'Hello! 👋 How can I help you today?' };

/** Demo replies, written ahead of time. Nothing is computed or sent anywhere. */
const SUGGESTIONS: { q: string; a: string }[] = [
  { q: 'What are today’s arrivals?', a: 'You have arrivals due today, most landing between 2 and 6 pm. Open Front Desk to see each guest, their room and any special requests before they reach the desk.' },
  { q: 'How is occupancy today?', a: 'Occupancy is running ahead of the same day last week. The Dashboard shows rooms occupied, vacant and being cleaned, and AI Insights has a 30-day forecast.' },
  { q: 'Which rooms need cleaning?', a: 'Rooms from this morning’s checkouts are first in the housekeeping queue. Open Housekeeping to mark rooms clean and release them for sale.' },
  { q: 'How do I create a booking?', a: 'Go to Bookings and choose New booking. Pick the dates and a room, add the guest’s details, then confirm. You can take a deposit at the same step.' },
  { q: 'Show me this week’s revenue', a: 'Revenue is on track this week. Reports breaks it down by room, restaurant and channel, and AI Insights › Revenue Insights suggests where to earn more.' },
  { q: 'Suggest a room rate', a: 'Smart Pricing compares your rate with the market for each room category. Several categories are priced under the market, so raising them is the quickest win.' },
];

const KEYWORDS: { words: string[]; a: string }[] = [
  { words: ['hi', 'hello', 'hey'], a: 'Hi there! I can help with bookings, rooms, housekeeping, guests and reports. Try one of the suggestions below.' },
  { words: ['thank'], a: 'You’re welcome! Let me know if there is anything else.' },
  { words: ['check-in', 'check in', 'checkin', 'arrival'], a: SUGGESTIONS[0].a },
  { words: ['check-out', 'checkout', 'check out'], a: 'Departures are listed in Front Desk. Open a stay, review the bill, take payment and check the guest out. The room then goes to housekeeping automatically.' },
  { words: ['occupan'], a: SUGGESTIONS[1].a },
  { words: ['clean', 'housekeep'], a: SUGGESTIONS[2].a },
  { words: ['book', 'reserv'], a: SUGGESTIONS[3].a },
  { words: ['revenue', 'sales', 'income', 'report'], a: SUGGESTIONS[4].a },
  { words: ['rate', 'price', 'pricing'], a: SUGGESTIONS[5].a },
  { words: ['guest', 'customer'], a: 'Guest profiles hold stay history, preferences and notes. AI Insights › Guest Insights groups them into segments such as couples, families and business.' },
  { words: ['restaurant', 'food', 'menu', 'order'], a: 'Restaurant lets you take orders by table and post them to a room bill. Open it from the sidebar.' },
  { words: ['cancel', 'refund'], a: 'Open the booking and choose Cancel. The cancellation terms of the rate decide whether a deposit is refunded.' },
];

const FALLBACK = 'I’m a demo assistant, so I can only answer a few things. Try asking about arrivals, occupancy, housekeeping, bookings, revenue or room rates.';

function reply(text: string) {
  const t = text.trim().toLowerCase();
  const exact = SUGGESTIONS.find((s) => s.q.toLowerCase() === t);
  if (exact) return exact.a;
  const tokens = t.split(/[^a-z-]+/);
  const hit = KEYWORDS.find((k) => k.words.some((w) => (w.length <= 3 ? tokens.includes(w) : t.includes(w))));
  return hit ? hit.a : FALLBACK;
}

/**
 * One global, demonstration-only chat launcher. It is mounted once by the Shell, so it persists
 * across every page, and its open state survives navigation and reloads of the tab.
 */
export function FloatingAssistant() {
  const [mode, setModeState] = useState<Mode>(readMode);
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number>();
  const [thinking, setThinking] = useState(false);

  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      sessionStorage.setItem(KEY, m);
    } catch {
      /* State lasts for this render only. */
    }
  };

  useEffect(() => {
    if (mode === 'open') inputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [msgs, thinking]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const ask = (value: string) => {
    if (!value || thinking) return;
    setMsgs((m) => [...m, { from: 'me', text: value }]);
    setText('');
    setThinking(true);
    timer.current = window.setTimeout(() => {
      setMsgs((m) => [...m, { from: 'bot', text: reply(value) }]);
      setThinking(false);
    }, 900 + Math.min(value.length * 15, 600));
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    ask(text.trim());
  };

  const asked = new Set(msgs.filter((m) => m.from === 'me').map((m) => m.text));
  const chips = SUGGESTIONS.filter((s) => !asked.has(s.q)).slice(0, 3);

  const expanded = mode === 'open';

  return (
    <div className="fa no-print">
      {expanded && (
        <section className="fa-panel" role="dialog" aria-label="AI assistant" onKeyDown={(e) => e.key === 'Escape' && setMode('closed')}>
          <header className="fa-head">
            <span className="fa-avatar"><Mascot size={30} headOnly look={false} /></span>
            <span className="fa-title">
              <b>Folio Assistant</b>
              <small>Demo preview</small>
            </span>
            <button type="button" className="fa-icon-btn" aria-label="Minimize assistant" onClick={() => setMode('minimized')}>
              <Icon name="chevronDown" size={17} />
            </button>
            <button type="button" className="fa-icon-btn" aria-label="Close assistant" onClick={() => setMode('closed')}>
              <Icon name="x" size={17} />
            </button>
          </header>
          <div className="fa-log" ref={logRef} aria-live="polite">
            {msgs.map((m, i) => (
              <p key={i} className={`fa-msg fa-${m.from}`}>{m.text}</p>
            ))}
            {thinking && (
              <p className="fa-msg fa-bot" aria-label="Assistant is typing"><span className="ai-dots"><i /><i /><i /></span></p>
            )}
          </div>
          {chips.length > 0 && (
            <div className="fa-chips" role="group" aria-label="Suggested questions">
              {chips.map((s) => (
                <button key={s.q} type="button" className="fa-chip" disabled={thinking} onClick={() => ask(s.q)}>{s.q}</button>
              ))}
            </div>
          )}
          <form className="fa-form" onSubmit={send}>
            <input ref={inputRef} className="fa-input" aria-label="Message the assistant" placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)} />
            <button type="submit" className="fa-send" aria-label="Send message" disabled={!text.trim() || thinking}>
              <Icon name="arrow" size={17} />
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        className="fa-fab"
        aria-label={expanded ? 'Minimize AI assistant' : mode === 'minimized' ? 'Restore AI assistant' : 'Open AI assistant'}
        aria-expanded={expanded}
        onClick={() => setMode(expanded ? 'minimized' : 'open')}
      >
        <Mascot size={70} />
      </button>
    </div>
  );
}
