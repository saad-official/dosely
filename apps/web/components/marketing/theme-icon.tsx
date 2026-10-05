import type { Motif } from "@dosely/shared/themes";
import type { ReactNode } from "react";

/** Simple 24-unit glyphs for each seasonal motif (currentColor). */
const MOTIF_GLYPHS: Record<Exclude<Motif, "none">, ReactNode> = {
  snow: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  hearts: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="currentColor" />,
  clover: (
    <g fill="currentColor">
      <circle cx="12" cy="7.5" r="3.8" />
      <circle cx="7.6" cy="12.4" r="3.8" />
      <circle cx="16.4" cy="12.4" r="3.8" />
      <path d="M12 12v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  eggs: <ellipse cx="12" cy="13" rx="6" ry="8" fill="currentColor" />,
  maple: (
    <path
      d="M12 2l2 5.5 4.5-1.5-1.5 4.5 4 2-5 2.5.8 4-4.8-2-4.8 2 .8-4-5-2.5 4-2L5.5 6l4.5 1.5zM12 15v7"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  ),
  stars: <path d="M12 2.5l2.8 6 6.6.7-5 4.4 1.5 6.5L12 16.8l-5.9 3.3 1.5-6.5-5-4.4 6.6-.7z" fill="currentColor" />,
  leaves: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19C5 10.5 11 4.5 20 4.5c0 8.5-6 14.5-15 14.5z" fill="currentColor" />
      <path d="M5 19l8-8" />
    </g>
  ),
  pumpkins: (
    <g fill="currentColor">
      <path d="M12 7.5c-5 0-8 2.9-8 6.6 0 3.6 3 5.9 8 5.9s8-2.3 8-5.9c0-3.7-3-6.6-8-6.6z" />
      <path d="M12 8V4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  lights: (
    <g fill="currentColor">
      <path d="M2 6c5 4.5 15 4.5 20 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="6" cy="12" rx="2" ry="3" />
      <ellipse cx="12" cy="13.5" rx="2" ry="3" />
      <ellipse cx="18" cy="12" rx="2" ry="3" />
    </g>
  ),
};

export function MotifGlyph({ motif, className = "size-5" }: { motif: Motif; className?: string }) {
  if (motif === "none") return null;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      {MOTIF_GLYPHS[motif]}
    </svg>
  );
}

/**
 * The alternate app icon for a theme, drawn in CSS: the capsule on the
 * theme's accent, with the motif tucked in the corner. Must sit inside an
 * element carrying the theme's colour variables (themeStyle()).
 */
export function ThemeAppIcon({ motif, label }: { motif: Motif; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-[22px] bg-accent text-on-accent shadow-md"
    >
      <svg viewBox="0 0 32 32" className="size-12" aria-hidden focusable="false">
        <g transform="rotate(-40 16 16)">
          <rect x="3" y="10.5" width="26" height="11" rx="5.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <path d="M16 11.5H8.5a4.5 4.5 0 0 0 0 9H16z" fill="currentColor" />
        </g>
      </svg>
      {motif !== "none" ? (
        <span className="absolute right-2 bottom-2 opacity-90">
          <MotifGlyph motif={motif} className="size-5" />
        </span>
      ) : null}
    </span>
  );
}
