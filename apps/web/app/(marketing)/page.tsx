import { Bell, CalendarClock, LayoutGrid, Lock, PackageOpen, Smartphone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  CaregiverAlertMock,
  IslandMock,
  LiveActivityStrip,
  NotificationMock,
  PhoneFrame,
  RefillMock,
  TodayScreen,
  WidgetMock,
} from "@/components/marketing/device-mocks";
import { DOSE_TIMELINE, FAQ } from "@/lib/marketing/content";

function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto max-w-6xl scroll-mt-8 px-5 pt-24 sm:px-8">
      <h2 id={`${id}-title`} className="max-w-2xl text-title font-semibold sm:text-[34px] sm:leading-[42px]">
        {title}
      </h2>
      {intro ? <div className="mt-4 max-w-2xl text-body text-ink-2">{intro}</div> : null}
      <div className="mt-10">{children}</div>
    </section>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background:
            "radial-gradient(60% 70% at 78% 30%, color-mix(in oklab, var(--do-color-accent) 18%, transparent), transparent 70%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pt-14 pb-8 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div>
          <h1
            id="hero-title"
            className="max-w-[13ch] text-[44px] leading-[50px] font-semibold tracking-[-0.02em] sm:text-[60px] sm:leading-[64px]"
          >
            Reminders you can act on. Free, forever.
          </h1>
          <p className="mt-6 max-w-xl text-[19px] leading-[30px] text-ink-2">
            Dosely reminds you, or the parent you look after, when each dose is due. Mark it Taken or Snooze it straight
            from the notification or the Lock Screen. If a dose goes unmarked, the people in your caregiver circle hear
            about it.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="#how"
              className="inline-flex h-12 items-center rounded-full bg-accent px-6 text-body font-semibold text-on-accent transition-colors duration-150 hover:bg-accent-pressed"
            >
              See how it works
            </Link>
            <Link
              href="#circle"
              className="inline-flex h-12 items-center rounded-full px-5 text-body font-semibold text-accent-ink ring-1 ring-edge transition-colors duration-150 hover:bg-elevated"
            >
              How caregivers are told
            </Link>
          </div>
          <p className="mt-6 text-callout text-ink-2">
            Coming to iPhone and Android. No subscription, no ads, no limit on medications.
          </p>
        </div>

        <figure className="relative mx-auto flex flex-col items-center lg:block lg:h-[640px] lg:w-full">
          <figcaption className="sr-only">
            The Dosely Today screen for Mum: one of four doses taken, Lisinopril 10 mg due now. Beside it, the Lock
            Screen Live Activity for the same dose shows 59 minutes left in the window, with Taken and Snooze 10 min
            buttons.
          </figcaption>
          <div aria-hidden className="lg:absolute lg:top-0 lg:right-6">
            <PhoneFrame>
              <TodayScreen />
            </PhoneFrame>
          </div>
          <div aria-hidden className="relative -mt-24 w-full max-w-[340px] lg:absolute lg:bottom-10 lg:left-0 lg:mt-0">
            <LiveActivityStrip />
          </div>
        </figure>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <Section
      id="how"
      title="One dose, from reminder to check-in"
      intro="Every medication gets its own reminders and a dose window. Here is what happens to a single 8:30 dose."
    >
      <ol className="relative max-w-3xl border-l-2 border-line pl-8 sm:pl-10">
        {DOSE_TIMELINE.map((step) => (
          <li key={step.title} className="relative pb-10 last:pb-0">
            <span aria-hidden className="absolute top-1.5 -left-[41px] size-4 rounded-full border-4 border-surface bg-accent sm:-left-[49px]" />
            <time dateTime={step.dateTime} className="block text-callout font-semibold text-accent-ink">
              {step.time}
            </time>
            <h3 className="mt-1 text-headline font-semibold">{step.title}</h3>
            <p className="mt-2 text-body text-ink-2">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Feature({ icon, title, children, mock }: { icon: ReactNode; title: string; children: ReactNode; mock: ReactNode }) {
  return (
    <li className="grid gap-6 border-t border-line py-10 md:grid-cols-[1fr_auto] md:items-center md:gap-16">
      <div className="max-w-xl">
        <h3 className="flex items-center gap-3 text-headline font-semibold">
          <span className="text-accent-ink">{icon}</span>
          {title}
        </h3>
        <div className="mt-3 text-body text-ink-2">{children}</div>
      </div>
      <div aria-hidden className="flex justify-start md:w-[340px] md:justify-center">
        {mock}
      </div>
    </li>
  );
}

function NativeFeatures() {
  return (
    <Section
      id="features"
      title="Built into your phone, not just the app"
      intro="Dosely uses the parts of iOS and Android you already look at, so a dose takes one tap wherever you are."
    >
      <ul>
        <Feature icon={<Bell aria-hidden className="size-6" />} title="Notifications you can answer" mock={<NotificationMock />}>
          <p>
            Taken, Snooze 10 min and Skip sit right on the notification. Reminders are scheduled on the phone itself, so
            they arrive without a signal, and they stay correct when the clocks change.
          </p>
        </Feature>
        <Feature icon={<Lock aria-hidden className="size-6" />} title="The dose window on your Lock Screen" mock={<IslandMock />}>
          <p>
            A Live Activity on iPhone, in the Dynamic Island and on the Lock Screen, counts down the time left to take
            what is due. On Android 16 the same window appears as a Live Update.
          </p>
        </Feature>
        <Feature icon={<LayoutGrid aria-hidden className="size-6" />} title="Widgets for the next dose" mock={<WidgetMock />}>
          <p>
            See what is next and how today is going without opening anything: Home Screen and Lock Screen widgets on
            iPhone, a 2 by 2 widget on Android.
          </p>
        </Feature>
        <Feature icon={<PackageOpen aria-hidden className="size-6" />} title="Refills before you run out" mock={<RefillMock />}>
          <p>
            Enter how many tablets you have and Dosely counts down with every dose taken, then reminds you a few days
            before the pack runs out.
          </p>
        </Feature>
      </ul>
      <p className="mt-2 text-body text-ink-2">
        Also included: a calm history with weekly adherence and CSV export, profiles for the people you look after, and{" "}
        <Link href="/themes" className="font-semibold text-accent-ink underline">
          seasonal themes with matching app icons
        </Link>
        .
      </p>
    </Section>
  );
}

function CaregiverCircle() {
  return (
    <Section
      id="circle"
      title="A caregiver circle, for the doses that slip"
      intro="For a parent living alone, or anyone who would like a second pair of eyes. It is optional, and nothing leaves the phone until you set it up."
    >
      <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
        <ol className="space-y-8">
          <li>
            <h3 className="text-headline font-semibold">1. Create a circle</h3>
            <p className="mt-2 text-body text-ink-2">
              The person taking the medication signs in with an email address and creates a circle in the Circle tab.
            </p>
          </li>
          <li>
            <h3 className="text-headline font-semibold">2. Share the invite code</h3>
            <p className="mt-2 text-body text-ink-2">
              Read the 8-character code out over the phone or send it in a message. Codes avoid look-alike letters such as
              O and 0.
            </p>
            <p
              aria-label="Example invite code: K 7 M 4, Q 2 X P"
              className="mt-4 inline-flex gap-3 rounded-md bg-elevated px-5 py-3 text-[28px] leading-9 font-semibold tracking-[0.18em] text-ink ring-1 ring-line tabular"
            >
              <span>K7M4</span>
              <span>Q2XP</span>
            </p>
          </li>
          <li>
            <h3 className="text-headline font-semibold">3. Caregivers join and get one alert per missed dose</h3>
            <p className="mt-2 text-body text-ink-2">
              Up to ten caregivers can join. When a dose is still unmarked 30 minutes after its window, each of them gets
              a notification, and can open a read-only Today view to see what is due, taken or missed. They cannot change
              anything.
            </p>
          </li>
        </ol>
        <figure className="flex flex-col items-start gap-4 lg:items-center lg:pt-6">
          <figcaption className="sr-only">
            A caregiver notification: Mum hasn&apos;t marked a dose. Lisinopril 10 mg was due 90 min ago. You may want to
            check in.
          </figcaption>
          <div aria-hidden>
            <CaregiverAlertMock />
          </div>
          <p className="max-w-[340px] text-callout text-ink-2">
            The circle sees profile names, medication names and strengths, dose times and whether each was taken.
            Nothing else, and the owner can stop sharing at any time.
          </p>
        </figure>
      </div>
    </Section>
  );
}

function WhyFree() {
  return (
    <Section id="free" title="Why it is free">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4 text-body text-ink-2">
          <p>
            On 1 January 2026, Medisafe, one of the best-known reminder apps, moved to a paid subscription, and its free
            version now covers two medications. Plenty of people take more than two, and the World Health Organization
            estimates that about half of people with long-term conditions do not take their medicines as prescribed.
            Reminders should not be the part that costs money.
          </p>
          <p>
            Dosely is cheap to run because your medication list lives on your phone, not on our servers. The server only
            comes into play for people who use a caregiver circle. So there is nothing to upsell: no subscription, no
            ads, no premium tier.
          </p>
        </div>
        <dl className="grid content-start gap-px overflow-hidden rounded-md bg-line ring-1 ring-line">
          {[
            ["Medications", "As many as you take"],
            ["People", "You and everyone you look after"],
            ["Caregiver circle", "Included"],
            ["Ads", "None"],
            ["Price", "Free"],
          ].map(([term, value]) => (
            <div key={term} className="flex items-baseline justify-between gap-4 bg-elevated px-5 py-3.5">
              <dt className="text-callout text-ink-2">{term}</dt>
              <dd className="text-right text-body font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}

function Privacy() {
  const points = [
    {
      icon: <Smartphone aria-hidden className="size-5" />,
      title: "Stored on your phone, encrypted",
      body: "Medications, schedules and history are kept in an encrypted database (SQLCipher) whose key sits in the iOS Keychain or Android Keystore.",
    },
    {
      icon: <Lock aria-hidden className="size-5" />,
      title: "No account unless you want a circle",
      body: "Everything works offline and signed out. Data reaches our server only when you create a caregiver circle, and only what the circle needs.",
    },
    {
      icon: <CalendarClock aria-hidden className="size-5" />,
      title: "Yours to take or delete",
      body: "Export your history as CSV at any time. Delete all data on the phone, stop sharing, or delete your account, and the server copy goes with it.",
    },
  ];
  return (
    <Section
      id="privacy"
      title="Your medication list stays with you"
      intro={
        <>
          No ads, no tracking, no selling of data. The{" "}
          <Link href="/privacy" className="font-semibold text-accent-ink underline">
            privacy policy
          </Link>{" "}
          lists exactly what is stored and where.
        </>
      }
    >
      <ul className="grid gap-8 md:grid-cols-3">
        {points.map((point) => (
          <li key={point.title}>
            <h3 className="flex items-center gap-2 text-body font-semibold">
              <span className="text-accent-ink">{point.icon}</span>
              {point.title}
            </h3>
            <p className="mt-2 text-callout text-ink-2">{point.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Faq() {
  return (
    <Section id="faq" title="Questions people ask">
      <div className="max-w-3xl divide-y divide-line border-y border-line">
        {FAQ.map((item) => (
          <details key={item.q} className="group py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-4 text-body font-semibold [&::-webkit-details-marker]:hidden">
              {item.q}
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full text-accent-ink ring-1 ring-edge transition-transform duration-250 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="pb-5 text-body text-ink-2">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <NativeFeatures />
      <CaregiverCircle />
      <WhyFree />
      <Privacy />
      <Faq />
    </>
  );
}
