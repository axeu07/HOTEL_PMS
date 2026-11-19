import { ArrowRight, BedDouble, Check, ChevronLeft, ChevronRight, Clock, Mail, MapPin, Maximize2, Mountain, Phone, Users, X, type LucideIcon } from 'lucide-react';

const ICONS = {
  x: X,
  check: Check,
  arrow: ArrowRight,
  next: ChevronRight,
  prev: ChevronLeft,
  bed: BedDouble,
  size: Maximize2,
  guests: Users,
  view: Mountain,
  pin: MapPin,
  phone: Phone,
  mail: Mail,
  clock: Clock,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const Glyph = ICONS[name];
  return <Glyph size={size} strokeWidth={1.75} aria-hidden="true" />;
}

/** Brand mark: two mountain peaks under a low sun. `size` is its height; it takes the surrounding text colour. */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={(size * 48) / 40} height={size} viewBox="0 0 48 40" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="37" cy="9" r="4.5" opacity=".85" />
      <path d="M1 37 L17 7 L25 21 L30 13 L47 37Z" />
      <path d="M17 7 L12.2 16 L15.4 14.4 L17 17.2 L18.8 14.4 L21.8 16Z" fill="#14302a" opacity=".35" />
    </svg>
  );
}
