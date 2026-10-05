import type { Metadata } from "next";
import { POLICY_UPDATED, SUPPORT_EMAIL } from "@/lib/marketing/content";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Dosely stores, where, and how to export or delete it. Medication data stays on your phone unless you use a caregiver circle.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-6xl px-5 pt-14 sm:px-8">
      <div className="prose-doc">
        <h1 className="text-title font-semibold sm:text-[34px] sm:leading-[42px]">Privacy policy</h1>
        <p className="mt-2 text-callout">Last updated {POLICY_UPDATED}</p>

        <h2>The short version</h2>
        <ul>
          <li>Your medications, schedules and dose history are stored on your phone, in an encrypted database.</li>
          <li>You can use every reminder feature without an account. Nothing about your medication leaves the phone.</li>
          <li>
            If you create or join a caregiver circle, you sign in with an email address, and the data the circle needs is
            copied to our server so caregivers can see it and be alerted.
          </li>
          <li>There are no ads, no tracking or analytics tools in the app or on this website, and we never sell data.</li>
          <li>You can export your history, stop sharing, and delete everything at any time.</li>
        </ul>

        <h2>Data on your phone</h2>
        <p>
          Profiles (a name, colour and initial), medications (name, strength, form, instructions, schedule, dose window,
          tablet count and refill threshold), each dose and whether it was taken, snoozed or skipped, and your settings
          are kept in a SQLite database encrypted with SQLCipher. The encryption key is held in the iOS Keychain or the
          Android Keystore. Reminders are scheduled locally by the phone. We cannot see any of this.
        </p>

        <h2>The optional account and caregiver circle</h2>
        <p>
          An account is only needed to create or join a caregiver circle. When you create one we store your{" "}
          <strong>name, email address and a hashed password</strong> (we never store the password itself), plus the
          session tokens that keep you signed in.
        </p>
        <p>
          If you <strong>create a circle</strong> (you are the person whose doses are shared), your phone copies to our
          server: profile names, colours and initials; medication names, strengths, forms, instructions, schedules,
          windows and tablet counts; and for each dose its due time and when it was taken, skipped or snoozed. The
          people you invite see a read-only view of this for the current day, and get an alert when a dose is still
          unmarked 30 minutes after its window. To keep alerts from repeating, we record which doses have already been
          alerted.
        </p>
        <p>
          If you <strong>join a circle as a caregiver</strong>, we store your name in that circle and your membership.
          Your own medications are not copied unless you create a circle yourself.
        </p>

        <h2>Push notifications</h2>
        <p>
          To deliver caregiver alerts we store your device&apos;s <strong>Expo push token</strong> and whether it is an
          iPhone or Android device, linked to your account. Alerts are sent through Expo&apos;s push service, which passes
          them to Apple Push Notification service or Firebase Cloud Messaging. An alert contains the name the circle uses
          for the person, the medication names and how long ago the dose was due. Your own dose reminders are local
          notifications and never pass through any server.
        </p>

        <h2>Where it is stored and who processes it</h2>
        <ul>
          <li>
            <strong>Vercel</strong> hosts this website and the Dosely server. Like any web host it keeps standard request
            logs (such as IP address and time) for a short period, for security and troubleshooting.
          </li>
          <li>
            <strong>Neon</strong> hosts the Postgres database that holds accounts and circle data.
          </li>
          <li>
            <strong>Expo</strong>, <strong>Apple</strong> and <strong>Google</strong> deliver push notifications, as
            described above.
          </li>
        </ul>
        <p>We do not share data with anyone else, we do not use it for advertising, and we do not sell it.</p>

        <h2>Cookies</h2>
        <p>
          This website sets no cookies for visitors. Signing in to the app uses a session cookie on our server, only to
          keep you signed in.
        </p>

        <h2>How long we keep it</h2>
        <p>
          Circle data stays on the server while the circle exists. When the owner stops sharing (deletes the circle), the
          circle, its members and every copied profile, medication and dose are deleted. Deleting your account deletes
          your account, your circle and memberships, everything copied from your phone, and your push tokens. Push tokens
          that Apple or Google report as no longer valid are deleted automatically.
        </p>

        <h2>Export and delete</h2>
        <ul>
          <li>
            <strong>Export:</strong> in Settings, save your dose history as a CSV file you can share with your pharmacist
            or doctor.
          </li>
          <li>
            <strong>Delete on the phone:</strong> in Settings, delete all data to erase the database and its key.
          </li>
          <li>
            <strong>Stop sharing or leave:</strong> in the Circle tab, the owner can delete the circle and a caregiver can
            leave it.
          </li>
          <li>
            <strong>Delete your account:</strong> in Settings. If you cannot reach the app, email us and we will delete it
            for you.
          </li>
        </ul>

        <h2>Children</h2>
        <p>
          Dosely accounts are for adults. A parent or carer can track a child&apos;s medication as a profile on their own
          phone; that profile has no account of its own.
        </p>

        <h2>Not medical advice</h2>
        <p>
          Dosely is a reminder tool. It does not give medical advice, check doses or look for drug interactions. Talk to
          your pharmacist or doctor about your medication.
        </p>

        <h2>Changes and contact</h2>
        <p>
          If this policy changes we will update the date above, and tell you in the app if the change is significant.
          Questions or requests:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </div>
    </article>
  );
}
