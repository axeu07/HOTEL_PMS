import { useApp } from '@/app/providers';
import { EmailLogo, WhatsAppLogo } from '@/components/brandIcons';
import { useFeedback } from '@/components/ui';
import { billMessage, billSubject, shareLink, type ShareChannel } from '@/domain/billShare';
import { fmtDate, money } from '@/lib/format';
import type { InvoiceView } from '@/services';
import type { Guest, ISODate } from '@/types/domain';

const LABEL: Record<ShareChannel, string> = { whatsapp: 'WhatsApp', email: 'Email' };

/**
 * Two ways to hand a bill to the guest. Each opens the guest's own app with the message already
 * written; staff read it and press Send there. Nothing is sent from here, so nothing says it was.
 */
export function BillShareButtons({
  view,
  guest,
  stay,
  size = 'md',
}: {
  view: InvoiceView;
  guest: Guest | undefined;
  stay?: { checkIn: ISODate; checkOut: ISODate };
  size?: 'md' | 'sm';
}) {
  const { hotel } = useApp();
  const { toast, toastError } = useFeedback();
  const { invoice, totals } = view;
  const name = guest ? `${guest.firstName} ${guest.lastName}`.trim() : 'This guest';

  const message = billMessage({
    hotelName: hotel.name,
    hotelPhone: hotel.phone,
    guestFirstName: guest?.firstName ?? '',
    invoiceNumber: invoice.number,
    stay: stay ? `${fmtDate(stay.checkIn)} to ${fmtDate(stay.checkOut)}` : undefined,
    total: money(totals.total),
    paid: money(totals.paid),
    balance: money(Math.max(0, totals.balance)),
    balanceDue: invoice.status !== 'void' && totals.balance > 0,
  });
  const subject = billSubject(hotel.name, invoice.number);
  const isVoid = invoice.status === 'void';

  const render = (channel: ShareChannel) => {
    const label = `Send bill ${invoice.number} by ${LABEL[channel]}`;
    const link = shareLink(channel, { name, phone: guest?.phone, email: guest?.email }, message, subject);
    const logo = channel === 'whatsapp' ? <WhatsAppLogo size={size === 'sm' ? 20 : 22} /> : <EmailLogo size={size === 'sm' ? 20 : 22} />;
    const cls = `share-btn share-${channel}${size === 'sm' ? ' share-sm' : ''}`;

    if (isVoid) {
      return <button key={channel} type="button" className={cls} disabled aria-label={`${label} (voided invoice)`} title="A voided invoice cannot be shared">{logo}</button>;
    }
    if (!link.ok) {
      // Not disabled on purpose: a tap explains what is missing instead of doing nothing.
      return (
        <button
          key={channel}
          type="button"
          className={`${cls} share-missing`}
          aria-label={label}
          title={link.reason}
          data-testid={`share-${channel}`}
          data-missing=""
          onClick={() => toastError(new Error(link.reason))}
        >
          {logo}
        </button>
      );
    }
    return (
      <a
        key={channel}
        className={cls}
        href={link.href}
        target={channel === 'whatsapp' ? '_blank' : undefined}
        rel="noopener noreferrer"
        aria-label={label}
        title={label}
        data-testid={`share-${channel}`}
        onClick={() => toast(channel === 'whatsapp' ? 'WhatsApp opened with the bill message. Review it and press Send there.' : 'Your mail app opened with the bill message. Review it and press Send there.')}
      >
        {logo}
      </a>
    );
  };

  return (
    <span className="share-group no-print" role="group" aria-label="Share bill with the guest">
      {render('whatsapp')}
      {render('email')}
    </span>
  );
}
