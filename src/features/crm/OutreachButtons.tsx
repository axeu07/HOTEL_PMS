import { EmailLogo, WhatsAppLogo } from '@/components/brandIcons';
import type { MessageChannel } from '@/types/domain';

/** The two ways to reach someone, drawn as the apps they open. Pressing one starts a message; nothing is sent yet. */
export function OutreachButtons({
  name,
  onPick,
  size = 'sm',
  disabled,
}: {
  name: string;
  onPick: (channel: MessageChannel) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
}) {
  const logoSize = size === 'sm' ? 20 : 22;
  return (
    <span className="share-group" role="group" aria-label={`Contact ${name}`}>
      <button
        type="button"
        className={`share-btn share-whatsapp${size === 'sm' ? ' share-sm' : ''}`}
        disabled={disabled}
        aria-label={`Message ${name} on WhatsApp`}
        title="Message on WhatsApp"
        data-testid="contact-whatsapp"
        onClick={() => onPick('whatsapp')}
      >
        <WhatsAppLogo size={logoSize} />
      </button>
      <button
        type="button"
        className={`share-btn share-email${size === 'sm' ? ' share-sm' : ''}`}
        disabled={disabled}
        aria-label={`Email ${name}`}
        title="Send an email"
        data-testid="contact-email"
        onClick={() => onPick('email')}
      >
        <EmailLogo size={logoSize} />
      </button>
    </span>
  );
}
