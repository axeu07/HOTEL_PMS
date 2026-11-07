import { useEffect, useState } from 'react';
import { useAuth } from '@/app/providers';
import { Icon } from '@/components/icons';
import { Button, Modal, useFeedback } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { errorMessage } from '@/lib/validation';
import { leadService } from '@/services';
import type { Lead, MessageChannel } from '@/types/domain';
import { OutreachButtons } from './OutreachButtons';
import type { Crm } from './useCrm';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

/** A personal booking link for one lead: made on opening, ready to copy or send. */
export function BookingLinkModal({ lead, crm, onClose, onSend }: { lead: Lead; crm: Crm; onClose: () => void; onSend: (channel: MessageChannel) => void }) {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const [url, setUrl] = useState('');
  const [fresh, setFresh] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    leadService.generateLink(lead.id, user?.name ?? 'Staff').then(
      (r) => { if (live) { setUrl(r.url); setFresh(r.created); } },
      (e) => { if (live) setError(errorMessage(e)); },
    );
    return () => { live = false; };
    // The link is made once per opening of the modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const category = crm.categoryById.get(lead.categoryId);
  const live = crm.leads.find((l) => l.id === lead.id) ?? lead;

  return (
    <Modal
      title="Personal booking link"
      subtitle={`For ${lead.name}`}
      onClose={onClose}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      {error ? (
        <div className="alert alert-warn" role="alert"><Icon name="alert" /><span>{error}</span></div>
      ) : (
        <div className="stack">
          <div className="link-box">
            <input className="input" readOnly value={url || 'Preparing the link…'} aria-label="Booking link" onFocus={(e) => e.currentTarget.select()} />
            <Button
              variant="primary"
              icon="copy"
              disabled={!url}
              onClick={async () => toast((await copyText(url)) ? 'Booking link copied' : 'Press Ctrl+C to copy the selected link')}
            >
              Copy
            </Button>
            {url && <a className="btn" href={url} target="_blank" rel="noopener noreferrer"><Icon name="external" />Preview</a>}
          </div>
          {url && (
            <p className="small muted">
              {fresh ? 'A new link was created for this lead.' : 'This lead already had a link, so the same one is shown.'}
              {live.linkOpenedAt ? ' They have opened it.' : ' They have not opened it yet.'}
            </p>
          )}
          <dl className="dl">
            <dt>Opens for</dt><dd>{lead.name}</dd>
            <dt>Dates</dt><dd>{lead.checkIn && lead.checkOut ? `${fmtDate(lead.checkIn)} to ${fmtDate(lead.checkOut)}` : 'They choose'}</dd>
            <dt>Room</dt><dd>{category?.name ?? 'They choose'}</dd>
            <dt>Guests</dt><dd>{lead.adults}</dd>
          </dl>
          <p className="small muted">
            The page greets them by first name with these details filled in. When they request the stay, a pending booking is created and this lead is marked Converted. No payment is taken.
          </p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className="strong">Send it by</span>
            <OutreachButtons name={lead.name} size="md" disabled={!url} onPick={onSend} />
          </div>
        </div>
      )}
    </Modal>
  );
}
