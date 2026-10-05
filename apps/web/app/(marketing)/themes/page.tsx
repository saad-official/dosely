import { THEME_IDS, THEMES, type ThemeId } from "@dosely/shared/themes";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { MotifGlyph, ThemeAppIcon } from "@/components/marketing/theme-icon";
import { themeStyle } from "@/lib/tokens-css";

export const metadata: Metadata = {
  title: "Seasonal themes",
  description: "Eleven looks for Dosely, each with a matching app icon: pick one, or let the app switch by date.",
};

/** A strip of the Today screen in one scheme, using the theme's colours. */
function Preview({ id, scheme }: { id: ThemeId; scheme: "light" | "dark" }) {
  const motif = THEMES[id].motif;
  return (
    <div data-scheme={scheme} style={themeStyle(id, scheme) as CSSProperties} className="rounded-md bg-surface p-3 ring-1 ring-line">
      <div className="flex items-center justify-between">
        <span className="text-caption font-semibold text-ink">{scheme === "light" ? "Light" : "Dark"}</span>
        <span className="text-accent-ink">
          <MotifGlyph motif={motif} className="size-4" />
        </span>
      </div>
      <div className="mt-2 rounded-sm bg-elevated px-2.5 py-2">
        <span className="block truncate text-caption font-semibold text-ink">Lisinopril</span>
        <span className="mt-1.5 flex items-center justify-between gap-2">
          <time className="text-[11px] text-ink-2">8:30 AM</time>
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-on-accent">Taken</span>
        </span>
      </div>
    </div>
  );
}

export default function ThemesPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-14 sm:px-8">
      <h1 className="text-title font-semibold sm:text-[34px] sm:leading-[42px]">Seasonal themes</h1>
      <p className="mt-4 max-w-2xl text-body text-ink-2">
        Eleven looks, each with a matching app icon. Choose one in Settings, or turn on switching by date and Dosely
        changes with the calendar. A theme you pick yourself always wins over the automatic one. Every theme keeps text
        at accessible contrast in light and dark.
      </p>
      <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {THEME_IDS.map((id) => {
          const theme = THEMES[id];
          return (
            <li key={id} className="flex flex-col gap-4 rounded-lg bg-elevated p-5 ring-1 ring-line">
              <div className="flex items-center gap-4">
                <div data-scheme="light" style={themeStyle(id, "light") as CSSProperties}>
                  <ThemeAppIcon motif={theme.motif} label={`${theme.name} app icon`} />
                </div>
                <div>
                  <h2 className="text-headline font-semibold">{theme.name}</h2>
                  <p className="mt-1 text-callout text-ink-2">{theme.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Preview id={id} scheme="light" />
                <Preview id={id} scheme="dark" />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
