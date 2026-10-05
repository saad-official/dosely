import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/marketing/content";
import { Wordmark } from "./logo";

const LINKS = [
  { href: "/themes", label: "Seasonal themes" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of use" },
  { href: "/support", label: "Support" },
] as const;

export function MedicalDisclaimer() {
  return (
    <p className="text-callout text-ink-2">
      <strong className="font-semibold text-ink">Dosely is a reminder tool, not medical advice.</strong> It does not check
      doses or drug interactions. Talk to your pharmacist or doctor before changing how you take any medication. In an
      emergency, call your local emergency number.
    </p>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-elevated">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1fr_auto]">
        <div className="max-w-xl space-y-4">
          <Wordmark />
          <MedicalDisclaimer />
          <p className="text-callout text-ink-2">
            Questions or problems:{" "}
            <a className="text-accent-ink underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="space-y-2 text-callout">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-ink-2 hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-5 pb-10 text-caption text-ink-2 sm:px-8">
        © 2026 Dosely. Free, with no subscription and no ads.
      </p>
    </footer>
  );
}
