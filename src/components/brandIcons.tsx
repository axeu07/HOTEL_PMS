/*
 * Colour marks for the two sharing actions. They are drawn here rather than pulled from an icon pack,
 * so the app adds no dependency. Both sit on a round tile so they read as the apps they open.
 */

export function WhatsAppLogo({ size = 22 }: { size?: number }) {
  return (
    <svg className="brand-logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path
        d="M16 6.6a9.4 9.4 0 0 0-8.1 14.1L6.6 25.4l4.8-1.25A9.4 9.4 0 1 0 16 6.6z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        fill="#fff"
        d="M12.5 11.4c.25-.55.55-.57.8-.58h.65c.2 0 .45.07.6.45l.8 1.95c.08.2.04.42-.1.6l-.55.7c-.12.15-.14.33-.05.5.62 1.1 1.6 2.05 2.9 2.62.2.09.4.06.53-.1l.78-.95c.15-.18.37-.22.58-.13l1.85.88c.2.1.3.28.28.5-.1 1.05-1.05 1.95-2.15 2-3.55-.05-7.25-3.55-7.7-7-.1-.85.1-1.45.58-2.34z"
      />
    </svg>
  );
}

export function EmailLogo({ size = 22 }: { size?: number }) {
  return (
    <svg className="brand-logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="16" fill="#3478F6" />
      <rect x="7.5" y="10" width="17" height="12" rx="2.2" fill="#fff" />
      <path d="M8.4 11.4 16 17.4l7.6-6" fill="none" stroke="#3478F6" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
