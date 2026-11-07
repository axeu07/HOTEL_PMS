import { useRef } from 'react';
import { Field } from '@/components/ui';
import { TEMPLATE_VARIABLES, unknownVariables } from '@/domain/templates';
import type { MessageChannel } from '@/types/domain';

/**
 * Subject (email only) and body, with one-click placeholders. A placeholder is dropped in at the
 * cursor, so staff never have to remember the exact spelling.
 */
export function MessageEditor({
  channel,
  subject,
  body,
  onChange,
  rows = 9,
}: {
  channel: MessageChannel;
  subject: string;
  body: string;
  onChange: (next: { subject: string; body: string }) => void;
  rows?: number;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const unknown = unknownVariables(`${subject}\n${body}`);

  const insert = (key: string) => {
    const el = area.current;
    const token = `{${key}}`;
    if (!el) return onChange({ subject, body: body + token });
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    onChange({ subject, body: body.slice(0, start) + token + body.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="stack-sm">
      {channel === 'email' && (
        <Field label="Subject line">
          {(id) => <input id={id} className="input" value={subject} onChange={(e) => onChange({ subject: e.target.value, body })} />}
        </Field>
      )}
      <Field label={channel === 'email' ? 'Message' : 'WhatsApp message'} error={unknown.length ? `Unknown placeholder: ${unknown.map((u) => `{${u}}`).join(', ')}` : undefined}>
        {(id) => <textarea id={id} ref={area} className="input msg-area" rows={rows} value={body} onChange={(e) => onChange({ subject, body: e.target.value })} />}
      </Field>
      <div className="var-chips" role="group" aria-label="Insert a placeholder">
        <span className="small muted">Insert</span>
        {TEMPLATE_VARIABLES.map((v) => (
          <button key={v.key} type="button" className="var-chip" title={`${v.label}, e.g. ${v.sample}`} onClick={() => insert(v.key)}>
            {`{${v.key}}`}
          </button>
        ))}
      </div>
    </div>
  );
}

/** How a message will look to the guest: a chat bubble for WhatsApp, a letter for email. */
export function MessagePreview({ channel, subject, body, to }: { channel: MessageChannel; subject: string; body: string; to?: string }) {
  const leftover = [...new Set([...`${subject}\n${body}`.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[0]))];
  return (
    <div className="stack-sm">
      {channel === 'whatsapp' ? (
        <div className="wa-preview" aria-label="WhatsApp preview">
          <div className="wa-bubble">{body}</div>
        </div>
      ) : (
        <div className="mail-preview" aria-label="Email preview">
          <div className="mail-head">
            {to && <div><span>To</span> {to}</div>}
            <div><span>Subject</span> <b>{subject}</b></div>
          </div>
          <div className="mail-body">{body}</div>
        </div>
      )}
      {leftover.length > 0 && (
        <p className="small msg-warn">Still to fill in before sending: {leftover.join(', ')}</p>
      )}
    </div>
  );
}
