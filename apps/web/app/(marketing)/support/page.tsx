import type { Metadata } from "next";
import { MedicalDisclaimer } from "@/components/marketing/site-footer";
import { SUPPORT_EMAIL } from "@/lib/marketing/content";

export const metadata: Metadata = {
  title: "Support",
  description: "Help with Dosely reminders, the Lock Screen window, caregiver alerts and your data.",
};

export default function SupportPage() {
  return (
    <article className="mx-auto max-w-6xl px-5 pt-14 sm:px-8">
      <div className="prose-doc">
        <h1 className="text-title font-semibold sm:text-[34px] sm:leading-[42px]">Support</h1>
        <p className="mt-4 text-body">
          Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with what you expected and what happened. Please
          do not send details of your medication unless they are needed to explain the problem.
        </p>

        <h2>Reminders are not arriving</h2>
        <h3>iPhone</h3>
        <ul>
          <li>Settings, Notifications, Dosely: allow notifications, and turn on Time Sensitive Notifications.</li>
          <li>If you use a Focus (Sleep, Work), add Dosely to the apps allowed to notify you.</li>
          <li>Open Dosely now and then: it schedules reminders a week ahead and tops them up when it opens and once a day in the background.</li>
        </ul>
        <h3>Android</h3>
        <ul>
          <li>Settings, Apps, Dosely, Notifications: allow notifications, and keep the reminder categories switched on.</li>
          <li>Allow Alarms and reminders for Dosely, so reminders fire at the exact time.</li>
          <li>Set battery use for Dosely to Unrestricted. Some phones stop apps in the background otherwise.</li>
        </ul>

        <h2>The Lock Screen window does not appear</h2>
        <ul>
          <li>
            iPhone: Settings, Dosely, Live Activities must be on. The window appears when a dose is due and ends when
            everything due is marked or the window closes.
          </li>
          <li>Android: Live Updates need Android 16. On earlier versions you still get the notification with its buttons.</li>
        </ul>

        <h2>My caregiver did not get an alert</h2>
        <ul>
          <li>Both of you need to be signed in, and the caregiver needs notifications allowed for Dosely.</li>
          <li>
            Alerts go out 30 minutes after a dose window closes, if the dose is still unmarked. They normally come from
            the phone of the person taking the medication, so it needs a connection. If it is off, the server checks once
            a day and sends any alerts that were missed.
          </li>
          <li>Each dose alerts the circle once. A dose that was marked Taken or Skipped never alerts.</li>
        </ul>

        <h2>Changing a time zone or the clocks changing</h2>
        <p>
          Dose times follow your local clock, so an 8:00 AM dose stays at 8:00 AM after daylight saving time changes or a
          trip. Doses every few hours count real elapsed time instead.
        </p>

        <h2>Exporting or deleting your data</h2>
        <ul>
          <li>In Settings: export your history as a CSV file, or delete all data on this phone.</li>
          
          <li>In the Circle tab: stop sharing (owner) or leave (caregiver). Your account can be deleted from Settings.</li>
        </ul>

        <h2>About medical questions</h2>
        <MedicalDisclaimer />
      </div>
    </article>
  );
}
