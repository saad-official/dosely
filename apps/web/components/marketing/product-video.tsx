"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * The 28-second product preview (rendered with Remotion from the shared tokens). Muted autoplay
 * loop, except under prefers-reduced-motion: then the poster shows with a play button. The
 * server render assumes reduced motion, so nothing autoplays before the preference is known.
 */
export function ProductVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia(REDUCED_MOTION).matches, () => true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (reduced) video.pause();
    else video.play().catch(() => {});
  }, [reduced]);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  return (
    <figure>
      <div className="relative overflow-hidden rounded-lg bg-elevated shadow-lg ring-1 ring-line">
        <video
          ref={ref}
          className="block aspect-video w-full"
          src="/video/dosely.mp4"
          poster="/video/dosely-poster.jpg"
          autoPlay={!reduced}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="Dosely product preview: a dose comes due, it is marked Taken from the Lock Screen Live Activity, today's progress ring advances and the caregiver circle shows all is well. Then the Home Screen widget, the Android Live Update and three seasonal themes."
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        {playing ? (
          <button
            type="button"
            onClick={toggle}
            className="absolute right-3 bottom-3 grid size-11 place-items-center rounded-full bg-elevated/90 text-ink ring-1 ring-edge"
            aria-label="Pause the product preview"
          >
            <Pause aria-hidden className="size-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggle}
            className="absolute inset-0 m-auto inline-flex h-12 w-fit items-center gap-2 rounded-full bg-accent px-6 text-body font-semibold text-on-accent shadow-md transition-colors duration-150 hover:bg-accent-pressed"
          >
            <Play aria-hidden className="size-5 fill-current" />
            Play preview
          </button>
        )}
      </div>
      <figcaption className="mt-3 text-callout text-ink-2">Product preview: screens recreated from the app&apos;s design system.</figcaption>
    </figure>
  );
}
