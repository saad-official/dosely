/** Copy and facts used across the marketing pages. Keep every claim checkable. */

export const SUPPORT_EMAIL = "saad.khan+dosely@zortik.com";
export const POLICY_UPDATED = "5 October 2026";

export const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#circle", label: "Caregivers" },
  { href: "/themes", label: "Themes" },
  { href: "/privacy", label: "Privacy" },
  { href: "/support", label: "Support" },
] as const;

/** The life of one dose. Times are a real sequence, so they are the markers. */
export const DOSE_TIMELINE = [
  {
    time: "8:30 AM",
    dateTime: "08:30",
    title: "The reminder arrives",
    body: "A notification with Taken, Snooze 10 min and Skip, so most doses never need the app opened. On iPhone it is marked time-sensitive, so a Focus you allow it in will not hold it back.",
  },
  {
    time: "8:30 to 9:30 AM",
    dateTime: "08:30/09:30",
    title: "The window stays on your Lock Screen",
    body: "A Live Activity on iPhone, or a Live Update on Android 16, shows what is due and how long is left, with Taken and Snooze buttons. It ends by itself once everything is marked.",
  },
  {
    time: "9:30 AM",
    dateTime: "09:30",
    title: "Late is still fine",
    body: "Mark it whenever you take it and Dosely records the real time. Each medication has its own window, one hour unless you change it.",
  },
  {
    time: "10:00 AM",
    dateTime: "10:00",
    title: "Your circle hears about it",
    body: "If the dose is still unmarked 30 minutes after the window closes, the people in your caregiver circle get one calm notification: who, which medication, and how long ago. Never more than one per dose.",
  },
] as const;

export const FAQ = [
  {
    q: "Is Dosely really free?",
    a: "Yes. There is no subscription, no in-app purchase, no ads and no limit on how many medications or people you track. Every feature on this page is included.",
  },
  {
    q: "Do I need an account?",
    a: "No. Reminders, the Lock Screen window, widgets, refills and history all work without one. You only sign in (email and password) to create or join a caregiver circle.",
  },
  {
    q: "Can I manage my mum's or dad's medication on my own phone?",
    a: "Yes. Add them as a profile next to your own. Each profile has its own medications, reminders and history.",
  },
  {
    q: "What does a caregiver see?",
    a: "A read-only Today view for the person they look after: medication names and strengths, when each dose is due, and whether it was taken, skipped or missed. Caregivers cannot change medications or mark doses.",
  },
  {
    q: "What if my phone is off when a dose is missed?",
    a: "Alerts normally come from your phone, as soon as it notices the dose was missed. If it cannot (no battery, no signal), the Dosely server checks once a day for doses that were never marked and alerts your circle then.",
  },
  {
    q: "Which phones does it work on?",
    a: "iPhone and Android. Live Updates on the Android Lock Screen need Android 16; on earlier versions you still get notifications with Taken and Snooze buttons, and widgets.",
  },
  {
    q: "Does Dosely give medical advice?",
    a: "No. Dosely reminds you of the schedule you enter. It does not check doses or drug interactions. Ask your pharmacist or doctor about how and when to take your medication.",
  },
  {
    q: "When can I get it?",
    a: "Dosely is in testing now and is coming to the App Store and Google Play. This page will link to both stores on release.",
  },
] as const;
