import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, useAuth } from '@/app/providers';
import { EmailLogo, WhatsAppLogo } from '@/components/brandIcons';
import { Icon } from '@/components/icons';
import { Badge, Modal, SelectField, TextField, useFeedback } from '@/components/ui';
import { outreachLink } from '@/domain/outreach';
import { CHANNEL_LABEL, renderTemplate, type TemplateValues } from '@/domain/templates';
import { useResource } from '@/hooks/useResource';
import { fmtDate, money } from '@/lib/format';
import { communicationService, leadService, roomService, templateService } from '@/services';
import type { ID, MessageChannel, MessageTemplate } from '@/types/domain';
import { MessageEditor, MessagePreview } from './MessageEditor';

/** Someone a message is going to, with whatever is known about the stay they might book. */
export interface Recipient {
  key: string;
  name: string;
  phone: string;
  email: string;
  guestId?: ID;
  leadId?: ID;
  categoryId?: ID | '';
  /** Per night. */
  price?: number;
  checkIn?: string;
  checkOut?: string;
  bookingToken?: string;
}

/**
 * Pick a channel and a template, adjust the wording, and open WhatsApp or the mail app for each person.
 * One recipient or many: every message is filled in for its own recipient, and each is opened one by one.
 * Nothing is sent from here, so a recipient is only ever marked "Opened", never "Sent".
 */
export function ContactModal({
  recipients,
  title,
  subtitle,
  initialChannel = 'whatsapp',
  initialTemplateKey,
  onClose,
}: {
  recipients: Recipient[];
  title: string;
  subtitle?: string;
  initialChannel?: MessageChannel;
  /** Built-in template to start from, e.g. "birthday". */
  initialTemplateKey?: string;
  onClose: () => void;
}) {
  const { hotel } = useApp();
  const { user } = useAuth();
  const { toast, toastError } = useFeedback();
  const { data: templates } = useResource(() => templateService.list());
  const { data: categories } = useResource(() => roomService.categories());

  const [channel, setChannel] = useState<MessageChannel>(initialChannel);
  const [templateId, setTemplateId] = useState('');
  const [draft, setDraft] = useState({ subject: '', body: '' });
  const [categoryId, setCategoryId] = useState('');
  const [priceText, setPriceText] = useState('');
  const [previewKey, setPreviewKey] = useState(recipients[0]?.key ?? '');
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [tokens, setTokens] = useState<Record<ID, string>>(() => Object.fromEntries(recipients.filter((r) => r.leadId && r.bookingToken).map((r) => [r.leadId!, r.bookingToken!])));
  const [linkError, setLinkError] = useState('');
  const generating = useRef(new Set<ID>());

  const forChannel = useMemo(() => (templates ?? []).filter((t) => t.channel === channel), [templates, channel]);

  // Start from the requested built-in template, or the first one, and again whenever the channel changes.
  const choose = (t: MessageTemplate | undefined) => {
    setTemplateId(t?.id ?? '');
    if (t) setDraft({ subject: t.subject, body: t.body });
  };
  const firstPick = useRef(true);
  useEffect(() => {
    if (!templates) return;
    const wanted = (firstPick.current && initialTemplateKey ? forChannel.find((t) => t.builtInKey === initialTemplateKey) : undefined) ?? forChannel[0];
    firstPick.current = false;
    choose(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, channel]);

  const template = forChannel.find((t) => t.id === templateId);
  const needsLink = draft.body.includes('{booking_link}') || draft.subject.includes('{booking_link}');

  // Personal booking links are made when the wording uses one, so the link in the message already works.
  useEffect(() => {
    if (!needsLink) return;
    const by = user?.name ?? 'Staff';
    recipients.forEach((r) => {
      if (!r.leadId || tokens[r.leadId] || generating.current.has(r.leadId)) return;
      generating.current.add(r.leadId);
      leadService.generateLink(r.leadId, by).then(
        ({ lead }) => setTokens((t) => ({ ...t, [lead.id]: lead.bookingToken })),
        (e) => setLinkError(e instanceof Error ? e.message : 'A booking link could not be made.'),
      );
    });
  }, [needsLink, recipients, tokens, user]);

  const category = (categories ?? []).find((c) => c.id === categoryId);
  const staffFirst = (user?.name ?? '').split(' ')[0];

  const valuesFor = (r: Recipient): TemplateValues => {
    const cat = category ?? (categories ?? []).find((c) => c.id === r.categoryId) ?? (categories ?? [])[0];
    const price = Number(priceText) > 0 ? Number(priceText) : r.price || cat?.basePrice || 0;
    const link = r.leadId ? (tokens[r.leadId] ? leadService.linkUrl(tokens[r.leadId]) : '') : `${window.location.origin}/`;
    return {
      guest_name: r.name.trim().split(/\s+/)[0],
      hotel_name: hotel.name,
      hotel_phone: hotel.phone,
      room_type: cat?.name,
      price: price ? money(price) : undefined,
      booking_link: link || undefined,
      check_in: r.checkIn ? fmtDate(r.checkIn) : undefined,
      check_out: r.checkOut ? fmtDate(r.checkOut) : undefined,
      staff_name: staffFirst || undefined,
    };
  };

  const compose = (r: Recipient) => {
    const values = valuesFor(r);
    return { subject: renderTemplate(draft.subject, values), body: renderTemplate(draft.body, values) };
  };

  const preview = recipients.find((r) => r.key === previewKey) ?? recipients[0];
  const shown = preview ? compose(preview) : { subject: '', body: '' };

  const open = (r: Recipient) => {
    const message = compose(r);
    void communicationService
      .log({
        channel,
        guestId: r.guestId ?? null,
        leadId: r.leadId ?? null,
        recipient: channel === 'whatsapp' ? r.phone : r.email,
        templateName: template?.name ?? 'Custom message',
        subject: message.subject,
        body: message.body,
        by: user?.name ?? 'Staff',
      })
      .then(() => {
        setOpened((o) => new Set(o).add(r.key));
        toast(channel === 'whatsapp' ? `WhatsApp opened for ${r.name}. Review the message and press Send there.` : `Your mail app opened for ${r.name}. Review the message and press Send there.`);
      })
      .catch(toastError);
  };

  const many = recipients.length > 1;
  const logo = channel === 'whatsapp' ? <WhatsAppLogo size={20} /> : <EmailLogo size={20} />;

  return (
    <Modal title={title} subtitle={subtitle} size="xl" onClose={onClose} footer={<button type="button" className="btn" onClick={onClose}>Done</button>}>
      <div className="contact-grid">
        <div className="stack">
          <div className="channel-switch" role="group" aria-label="Channel">
            {(['whatsapp', 'email'] as const).map((c) => (
              <button key={c} type="button" className="channel-opt" aria-pressed={channel === c} onClick={() => setChannel(c)}>
                {c === 'whatsapp' ? <WhatsAppLogo size={22} /> : <EmailLogo size={22} />}
                <span>{CHANNEL_LABEL[c]}</span>
              </button>
            ))}
          </div>
          <SelectField label="Template" value={templateId} onChange={(e) => choose(forChannel.find((t) => t.id === e.target.value))}>
            {forChannel.map((t) => <option key={t.id} value={t.id}>{t.name}{t.builtInKey ? '' : ' (custom)'}</option>)}
          </SelectField>
          <div className="form-grid">
            <SelectField label="Room type" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} hint="Fills {room_type}">
              <option value="">{many ? 'Each guest’s own room type' : 'Guest’s preferred room'}</option>
              {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectField>
            <TextField label="Offer price per night" inputMode="numeric" placeholder="Room’s usual rate" value={priceText} onChange={(e) => setPriceText(e.target.value.replace(/[^\d]/g, ''))} hint="Fills {price}" />
          </div>
          <MessageEditor channel={channel} subject={draft.subject} body={draft.body} onChange={setDraft} />
        </div>

        <div className="stack">
          <div className="row-between">
            <h3 className="contact-h">Preview</h3>
            {many && (
              <select className="input chart-filter" aria-label="Preview for" value={preview?.key} onChange={(e) => setPreviewKey(e.target.value)}>
                {recipients.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
              </select>
            )}
          </div>
          <MessagePreview channel={channel} subject={shown.subject} body={shown.body} to={preview ? (channel === 'email' ? preview.email : preview.phone) : undefined} />
          {linkError && <div className="alert alert-warn"><Icon name="alert" /><span>{linkError}</span></div>}
          {needsLink && !linkError && recipients.some((r) => r.leadId) && (
            <p className="small muted"><Icon name="check" size={13} /> Each lead gets their own booking link. Opening it marks the lead as having viewed it, and booking through it converts the lead.</p>
          )}

          <h3 className="contact-h">{many ? `Recipients (${recipients.length})` : 'Recipient'}</h3>
          <ul className="recipient-list">
            {recipients.map((r) => {
              const message = compose(r);
              const link = outreachLink(channel, r, message.body, message.subject);
              const waiting = needsLink && !!r.leadId && !tokens[r.leadId];
              const done = opened.has(r.key);
              return (
                <li key={r.key}>
                  <span className="grow">
                    <span className="cell-title">{r.name}</span>
                    <span className="cell-sub" style={{ display: 'block' }}>{link.ok ? (channel === 'whatsapp' ? r.phone : r.email) : link.reason}</span>
                  </span>
                  {done && <Badge tone="good">Opened</Badge>}
                  {link.ok && !waiting ? (
                    <a
                      className="outreach-btn"
                      href={link.href}
                      target={channel === 'whatsapp' ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      data-testid={`open-${channel}`}
                      aria-label={`${channel === 'whatsapp' ? 'Open WhatsApp' : 'Open email'} for ${r.name}`}
                      onClick={() => open(r)}
                    >
                      {logo}
                      <span>{done ? 'Open again' : channel === 'whatsapp' ? 'Open WhatsApp' : 'Open email'}</span>
                    </a>
                  ) : (
                    <button type="button" className="outreach-btn" disabled aria-label={link.ok ? 'Preparing the booking link' : link.reason}>
                      {logo}
                      <span>{link.ok ? 'Preparing…' : 'Unavailable'}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="small muted">The message opens ready to send in {channel === 'whatsapp' ? 'WhatsApp' : 'your mail app'}. Nothing is sent from here; press Send there.</p>
        </div>
      </div>
    </Modal>
  );
}
