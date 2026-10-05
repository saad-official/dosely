import type { Metadata } from "next";
import Link from "next/link";
import { POLICY_UPDATED, SUPPORT_EMAIL } from "@/lib/marketing/content";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms for using the Dosely app and website.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-6xl px-5 pt-14 sm:px-8">
      <div className="prose-doc">
        <h1 className="text-title font-semibold sm:text-[34px] sm:leading-[42px]">Terms of use</h1>
        <p className="mt-2 text-callout">Last updated {POLICY_UPDATED}</p>

        <h2>Using Dosely</h2>
        <p>
          Dosely is a free app for reminding you, and people you care for, to take medication on the schedule you enter.
          By using the app or this website you agree to these terms. There is no charge, no subscription and no in-app
          purchase.
        </p>

        <h2>Dosely is not a medical device or medical advice</h2>
        <ul>
          <li>
            Dosely reminds you of the schedule you enter. It does not decide doses, check prescriptions or look for drug
            interactions. Always follow the directions from your pharmacist or doctor.
          </li>
          <li>
            Reminders depend on your phone: notification permissions, battery settings, Focus modes, the phone being on,
            and for caregiver alerts, a network connection. Dosely cannot guarantee that every reminder or alert arrives.
            Do not rely on it as the only safeguard for medication where a missed dose could cause serious harm.
          </li>
          <li>Dosely is not an emergency service. In an emergency, call your local emergency number.</li>
        </ul>

        <h2>Your account and caregiver circles</h2>
        <ul>
          <li>Keep your password to yourself, and tell us if you think someone else has used your account.</li>
          <li>
            Only invite people to your circle whom you are happy to see your medication schedule. Only join a circle if
            the person who owns it invited you.
          </li>
          <li>Do not use Dosely to send spam, to harass anyone, or to try to get into other people&apos;s data.</li>
        </ul>
        <p>We may suspend accounts that break these rules.</p>

        <h2>Your data</h2>
        <p>
          Your data is yours. How it is stored and how to export or delete it is set out in the{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>

        <h2>Changes to the service</h2>
        <p>
          We may change or improve Dosely, and we may update these terms; the date above shows the latest version. If we
          ever stop running the caregiver circle server, the reminders on your phone keep working.
        </p>

        <h2>No warranty</h2>
        <p>
          Dosely is provided as it is, without warranties of any kind. To the extent the law allows, we are not liable for
          any loss arising from a reminder or alert that was late, missing or wrong. Nothing in these terms limits rights
          you have under consumer law that cannot be limited.
        </p>

        <h2>Contact</h2>
        <p>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </div>
    </article>
  );
}
