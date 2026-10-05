/** The capsule mark: one half filled, like a dose taken. Colours follow the surrounding tokens. */
export function CapsuleMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <g transform="rotate(-40 16 16)">
        <rect x="3" y="10.5" width="26" height="11" rx="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M16 11.5H8.5a4.5 4.5 0 0 0 0 9H16z" fill="currentColor" />
      </g>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-accent-ink">
      <CapsuleMark />
      <span className="text-headline font-semibold tracking-tight text-ink">Dosely</span>
    </span>
  );
}
