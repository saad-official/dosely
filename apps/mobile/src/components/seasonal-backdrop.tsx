import type { Motif } from '@dosely/shared';
import { useEffect, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { motifTint, useTheme, type ThemeColors } from '@/theme';

/**
 * Seasonal motif layer for the Today header: one subtle, low-contrast particle field per theme motif
 * (snow, hearts, clover, eggs, maple, stars, leaves, pumpkins, string lights). Pure Views (rounded
 * rects, rotations), at most 16 particles, each driven by one looping shared value on the UI thread.
 * Particles only spawn inside `lanes` (horizontal bands the caller keeps free of text), never
 * receive touches and are hidden from screen readers. With Reduce Motion the layer is not drawn.
 */

export type Lane = { start: number; end: number };

type Behaviour = 'fall' | 'rise' | 'twinkle' | 'bob';

type MotifSpec = { count: number; behaviour: Behaviour; size: [number, number]; period: [number, number]; spin: boolean };

const SPECS: Record<Exclude<Motif, 'none'>, MotifSpec> = {
  snow: { count: 16, behaviour: 'fall', size: [4, 9], period: [9000, 15000], spin: false },
  hearts: { count: 9, behaviour: 'rise', size: [12, 20], period: [10000, 16000], spin: false },
  clover: { count: 8, behaviour: 'bob', size: [16, 24], period: [5000, 8000], spin: true },
  eggs: { count: 8, behaviour: 'bob', size: [16, 24], period: [5000, 8000], spin: true },
  maple: { count: 8, behaviour: 'fall', size: [16, 24], period: [11000, 17000], spin: true },
  stars: { count: 14, behaviour: 'twinkle', size: [7, 15], period: [2600, 4600], spin: false },
  leaves: { count: 10, behaviour: 'fall', size: [14, 22], period: [10000, 16000], spin: true },
  pumpkins: { count: 6, behaviour: 'bob', size: [20, 28], period: [5500, 8500], spin: false },
  lights: { count: 12, behaviour: 'twinkle', size: [7, 9], period: [2200, 4200], spin: false },
};

/** Deterministic PRNG so particles keep their places across renders (React Compiler-safe). */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Particle = {
  x: number;
  y: number;
  size: number;
  period: number;
  phase: number;
  sway: number;
  spinDir: number;
  tilt: number;
  variant: number;
};

function layout(motif: Exclude<Motif, 'none'>, lanes: Lane[], height: number): Particle[] {
  const spec = SPECS[motif];
  const rand = mulberry32(motif.length * 7919 + Math.round(height));
  const usable = lanes.filter((l) => l.end - l.start > spec.size[1] + 8);
  const total = usable.reduce((s, l) => s + (l.end - l.start), 0);
  if (!usable.length || total <= 0) return [];
  const out: Particle[] = [];
  for (let i = 0; i < Math.min(spec.count, 16); i++) {
    // Spread evenly over the lanes (stratified), with jitter.
    let at = ((i + 0.15 + rand() * 0.7) / spec.count) * total;
    let lane = usable[0]!;
    for (const l of usable) {
      const w = l.end - l.start;
      if (at <= w) {
        lane = l;
        break;
      }
      at -= w;
    }
    const size = spec.size[0] + rand() * (spec.size[1] - spec.size[0]);
    const x = Math.min(lane.end - size, Math.max(lane.start, lane.start + at - size / 2));
    out.push({
      x,
      y: 6 + rand() * Math.max(0, height - size - 12),
      size,
      period: spec.period[0] + rand() * (spec.period[1] - spec.period[0]),
      phase: rand(),
      sway: 4 + rand() * 8,
      spinDir: rand() > 0.5 ? 1 : -1,
      tilt: -25 + rand() * 50,
      variant: i,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shapes (plain Views)

function abs(style: ViewStyle): ViewStyle {
  return { position: 'absolute', ...style };
}

export function MotifShape({ motif, size: s, c, variant }: { motif: Exclude<Motif, 'none'>; size: number; c: ThemeColors; variant: number }) {
  const main = c.motifPrimary;
  const soft = c.motifSecondary;
  switch (motif) {
    case 'snow':
      return <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: variant % 3 === 0 ? soft : main }} />;
    case 'hearts': {
      const a = s * 0.5;
      return (
        <View style={{ width: s, height: s }}>
          <View style={abs({ left: s * 0.25, top: s * 0.33, width: a, height: a, backgroundColor: main, transform: [{ rotate: '45deg' }] })} />
          <View style={abs({ left: s * 0.073, top: s * 0.153, width: a, height: a, borderRadius: a / 2, backgroundColor: main })} />
          <View style={abs({ left: s * 0.427, top: s * 0.153, width: a, height: a, borderRadius: a / 2, backgroundColor: main })} />
        </View>
      );
    }
    case 'clover': {
      const d = s * 0.44;
      const cx = s / 2;
      const cy = s * 0.42;
      const lobes = [-90, 30, 150].map((deg) => {
        const r = (deg * Math.PI) / 180;
        return { left: cx + Math.cos(r) * s * 0.2 - d / 2, top: cy + Math.sin(r) * s * 0.2 - d / 2 };
      });
      return (
        <View style={{ width: s, height: s }}>
          <View
            style={abs({ left: cx - s * 0.04, top: cy, width: s * 0.08, height: s * 0.5, borderRadius: s * 0.04, backgroundColor: soft, transform: [{ rotate: '18deg' }] })}
          />
          {lobes.map((p, i) => (
            <View key={i} style={abs({ ...p, width: d, height: d, borderRadius: d / 2, backgroundColor: main })} />
          ))}
        </View>
      );
    }
    case 'eggs': {
      const w = s * 0.74;
      return (
        <View style={{ width: w, height: s, borderRadius: w / 2, backgroundColor: variant % 2 ? soft : main, overflow: 'hidden' }}>
          <View style={abs({ left: 0, right: 0, top: s * 0.42, height: s * 0.14, backgroundColor: variant % 2 ? main : soft })} />
        </View>
      );
    }
    case 'maple': {
      const big = s * 0.46;
      const side = s * 0.38;
      return (
        <View style={{ width: s, height: s }}>
          <View style={abs({ left: s * 0.48, top: s * 0.6, width: s * 0.06, height: s * 0.38, backgroundColor: main })} />
          <View style={abs({ left: (s - big) / 2, top: s * 0.08, width: big, height: big, backgroundColor: main, transform: [{ rotate: '45deg' }] })} />
          <View style={abs({ left: s * 0.06, top: s * 0.3, width: side, height: side, backgroundColor: main, transform: [{ rotate: '20deg' }] })} />
          <View style={abs({ left: s * 0.56, top: s * 0.3, width: side, height: side, backgroundColor: main, transform: [{ rotate: '70deg' }] })} />
        </View>
      );
    }
    case 'leaves': {
      const w = s * 0.62;
      return (
        <View
          style={{
            width: w,
            height: s,
            backgroundColor: variant % 3 === 1 ? motifTint(c.warning, c.surface) : main,
            borderTopLeftRadius: w,
            borderBottomRightRadius: w,
            borderTopRightRadius: 2,
            borderBottomLeftRadius: 2,
          }}
        />
      );
    }
    case 'stars': {
      const t = Math.max(2, s * 0.2);
      return (
        <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
          <View style={abs({ width: s, height: t, borderRadius: t / 2, backgroundColor: main })} />
          <View style={abs({ width: t, height: s, borderRadius: t / 2, backgroundColor: main })} />
          <View style={abs({ width: t * 1.6, height: t * 1.6, borderRadius: t, backgroundColor: soft })} />
        </View>
      );
    }
    case 'pumpkins': {
      const h = s * 0.8;
      return (
        <View style={{ width: s, height: s }}>
          <View style={abs({ left: s * 0.46, top: 0, width: s * 0.1, height: s * 0.24, borderRadius: s * 0.04, backgroundColor: motifTint(c.success, c.surface) })} />
          <View style={abs({ left: 0, top: s * 0.18, width: s, height: h, borderRadius: h / 2, backgroundColor: main })} />
          <View
            style={abs({ left: s * 0.28, top: s * 0.18, width: s * 0.44, height: h, borderRadius: s * 0.22, borderWidth: 1.5, borderColor: soft })}
          />
        </View>
      );
    }
    case 'lights': {
      const bulbs = [c.accent, c.warning, c.success, c.danger];
      const color = motifTint(bulbs[variant % bulbs.length]!, c.surface, 'bulb');
      return (
        <View style={{ width: s, height: s * 1.5, alignItems: 'center' }}>
          <View style={{ width: s * 0.5, height: s * 0.32, borderRadius: 1.5, backgroundColor: soft }} />
          <View style={{ width: s, height: s * 1.2, borderRadius: s / 2, backgroundColor: color }} />
        </View>
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Animated particle

function ParticleView({
  p,
  motif,
  height,
  behaviour,
  spin,
  colors,
}: {
  p: Particle;
  motif: Exclude<Motif, 'none'>;
  height: number;
  behaviour: Behaviour;
  spin: boolean;
  colors: ThemeColors;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: p.period, easing: Easing.linear }), -1, false));
  }, [p.period, t]);

  const style = useAnimatedStyle(() => {
    const k = (t.get() + p.phase) % 1;
    const wave = Math.sin(k * Math.PI * 2);
    if (behaviour === 'twinkle') {
      return {
        opacity: 0.35 + 0.65 * (0.5 + 0.5 * wave),
        transform: [{ translateX: p.x }, { translateY: p.y }, { scale: 0.85 + 0.15 * wave }],
      };
    }
    if (behaviour === 'bob') {
      return {
        opacity: 1,
        transform: [
          { translateX: p.x + wave * 2 },
          { translateY: p.y + wave * 5 },
          { rotate: `${p.tilt * 0.4 + (spin ? wave * 8 : 0)}deg` },
        ],
      };
    }
    const travel = height + p.size * 2;
    const y = behaviour === 'fall' ? -p.size + k * travel : height + p.size - k * travel;
    return {
      opacity: interpolate(k, [0, 0.12, 0.88, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: p.x + wave * p.sway },
        { translateY: y },
        { rotate: `${spin ? p.tilt + k * 300 * p.spinDir : 0}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, style]}>
      <MotifShape motif={motif} size={p.size} c={colors} variant={p.variant} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// String lights draw a sagging wire across each lane; the bulbs hang from it.

function Wire({ lanes, colors }: { lanes: Lane[]; colors: ThemeColors }): ReactNode {
  return lanes.map((lane, li) => {
    const segments = 8;
    const w = lane.end - lane.start;
    const pts = Array.from({ length: segments + 1 }, (_, i) => {
      const f = i / segments;
      return { x: lane.start + f * w, y: 6 + Math.sin(f * Math.PI) * 14 };
    });
    return pts.slice(1).map((b, i) => {
      const a = pts[i]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      return (
        <View
          key={`${li}-${i}`}
          style={{
            position: 'absolute',
            left: (a.x + b.x) / 2 - len / 2,
            top: (a.y + b.y) / 2,
            width: len + 1,
            height: 1.5,
            backgroundColor: colors.motifSecondary,
            transform: [{ rotate: `${angle}rad` }],
          }}
        />
      );
    });
  });
}

function lightsLayout(lanes: Lane[], count: number): Particle[] {
  const usable = lanes.filter((l) => l.end - l.start > 40);
  if (!usable.length) return [];
  const per = Math.max(2, Math.floor(count / usable.length));
  return usable.flatMap((lane, li) => {
    const w = lane.end - lane.start;
    return Array.from({ length: per }, (_, i) => {
      const f = (i + 0.5) / per;
      const size = 8;
      return {
        x: lane.start + f * w - size / 2,
        y: 6 + Math.sin(f * Math.PI) * 14 - 1,
        size,
        period: 2400 + ((i * 7 + li * 3) % 5) * 450,
        phase: ((i * 37 + li * 11) % 100) / 100,
        sway: 0,
        spinDir: 1,
        tilt: 0,
        variant: i + li,
      };
    });
  });
}

export type SeasonalBackdropProps = {
  motif: Motif;
  /** Band height in points. */
  height: number;
  /** Horizontal bands (points from the start of the band) that contain no text. */
  lanes: Lane[];
};

export function SeasonalBackdrop({ motif, height, lanes }: SeasonalBackdropProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  // Reduce Motion: the layer is purely decorative motion, so it is left out entirely.
  if (motif === 'none' || reduced || height <= 0 || lanes.length === 0) return null;
  const spec = SPECS[motif];
  const particles = motif === 'lights' ? lightsLayout(lanes, spec.count) : layout(motif, lanes, height);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ position: 'absolute', left: 0, top: 0, right: 0, height, overflow: 'hidden', direction: 'ltr' }}
    >
      {motif === 'lights' ? <Wire lanes={lanes} colors={colors} /> : null}
      {particles.map((p) => (
        <ParticleView
          key={`${motif}-${p.variant}`}
          p={p}
          motif={motif}
          height={height}
          behaviour={spec.behaviour}
          spin={spec.spin}
          colors={colors}
        />
      ))}
    </View>
  );
}
