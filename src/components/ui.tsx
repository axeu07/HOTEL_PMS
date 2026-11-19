import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './icons';

/* ---------- Button ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'md' | 'sm';
  icon?: IconName;
  block?: boolean;
  /** Shows a spinner and blocks further presses while an action is running. */
  loading?: boolean;
};

export function Button({ variant = 'default', size = 'md', icon, block, loading, disabled, className = '', children, type = 'button', ...rest }: ButtonProps) {
  const classes = [
    'btn',
    variant !== 'default' && `btn-${variant}`,
    size === 'sm' && 'btn-sm',
    block && 'btn-block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, ...rest }: Omit<ButtonProps, 'children' | 'icon'> & { icon: IconName; label: string }) {
  return (
    <button type="button" className="btn btn-ghost btn-icon" aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

/* ---------- Form controls ---------- */

export function Field({ label, error, hint, children, className = '' }: { label: string; error?: string; hint?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={id}>{label}</label>
      {children(id)}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

type LabelProps = { label: string; error?: string; hint?: string; wrapClass?: string };

export function TextField({ label, error, hint, wrapClass, ...rest }: LabelProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} error={error} hint={hint} className={wrapClass}>
      {(id) => <input id={id} className="input" aria-invalid={!!error} {...rest} />}
    </Field>
  );
}

export function SelectField({ label, error, hint, wrapClass, children, ...rest }: LabelProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} error={error} hint={hint} className={wrapClass}>
      {(id) => <select id={id} className="input" aria-invalid={!!error} {...rest}>{children}</select>}
    </Field>
  );
}

export function TextAreaField({ label, error, hint, wrapClass, ...rest }: LabelProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} error={error} hint={hint} className={wrapClass}>
      {(id) => <textarea id={id} className="input" aria-invalid={!!error} {...rest} />}
    </Field>
  );
}

/* ---------- Modal ---------- */

/** Open modals, newest last. Only the top one reacts to the keyboard. */
const modalStack: symbol[] = [];

export function Modal({ title, subtitle, onClose, size = 'md', footer, children }: { title: string; subtitle?: ReactNode; onClose: () => void; size?: 'sm' | 'md' | 'lg' | 'xl'; footer?: ReactNode; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea');
    (first ?? panel.current)?.focus();
    const token = Symbol('modal');
    modalStack.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        closeRef.current();
      }
      if (e.key === 'Tab' && panel.current) {
        const items = panel.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)');
        if (!items.length) return;
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstItem) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault();
          firstItem.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      modalStack.splice(modalStack.indexOf(token), 1);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return createPortal(
    <div ref={backdrop} className="modal-root" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal-head no-print">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <div className="panel-sub">{subtitle}</div>}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot no-print">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

