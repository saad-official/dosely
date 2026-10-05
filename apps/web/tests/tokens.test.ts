import { describe, expect, it } from "vitest";
import { colors, motion, radius, shadows, spacing, toCssVars, type, type ColorScheme } from "@dosely/shared/tokens";
import { contrast } from "./contrast";

const SCHEMES: ColorScheme[] = ["light", "dark"];

describe("design tokens", () => {
  it("uses the Dosely ink, teal accents and soft surfaces", () => {
    expect(colors.light.text).toBe("#1C2430");
    expect(colors.light.accent).toBe("#1FA39A");
    expect(colors.dark.accent).toBe("#3BC4BA");
    expect(colors.light.surface).toBe("#F7F9F9");
    expect(colors.dark.surface).toBe("#101417");
  });

  it("gives both schemes the same colour roles", () => {
    expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
  });

  it.each(SCHEMES)("meets WCAG AA text contrast in %s", (scheme) => {
    const c = colors[scheme];
    for (const bg of [c.surface, c.surfaceElevated]) {
      expect(contrast(c.text, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(c.textSecondary, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.accentText, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.danger, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.success, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.warning, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onDanger, c.danger)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.danger, c.dangerSoft)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.success, c.successSoft)).toBeGreaterThanOrEqual(4.5);
  });

  it("uses a 4-pt spacing scale and the agreed radii", () => {
    expect(spacing).toEqual({ xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 });
    for (const value of Object.values(spacing)) expect(value % 4).toBe(0);
    expect(radius).toEqual({ sm: 10, md: 16, lg: 24, pill: 999 });
  });

  it("has a large readable type scale with generous line heights", () => {
    expect([type.display, type.title, type.headline, type.body, type.callout, type.caption].map((t) => t.fontSize)).toEqual([
      40, 28, 22, 17, 15, 13,
    ]);
    for (const style of Object.values(type)) expect(style.lineHeight / style.fontSize).toBeGreaterThanOrEqual(1.2);
    expect(type.body.lineHeight / type.body.fontSize).toBeGreaterThanOrEqual(1.45);
  });

  it("defines calm motion: three durations and the gentle and soft springs", () => {
    expect(motion.duration).toEqual({ fast: 150, base: 250, slow: 400 });
    expect(Object.keys(motion.spring).sort()).toEqual(["gentle", "soft"]);
    expect(motion.spring.soft.stiffness).toBeLessThan(motion.spring.gentle.stiffness);
  });

  it("has three shadow levels per scheme", () => {
    for (const scheme of SCHEMES) expect(Object.keys(shadows[scheme])).toEqual(["sm", "md", "lg"]);
  });
});

describe("toCssVars", () => {
  it("flattens a scheme into --do-* custom properties with CSS units", () => {
    const vars = toCssVars("light");
    expect(vars["--do-color-surface"]).toBe("#F7F9F9");
    expect(vars["--do-color-on-accent"]).toBe(colors.light.onAccent);
    expect(vars["--do-space-md"]).toBe("16px");
    expect(vars["--do-radius-pill"]).toBe("999px");
    expect(vars["--do-font-size-display"]).toBe("40px");
    expect(vars["--do-line-height-body"]).toBe(`${type.body.lineHeight}px`);
    expect(vars["--do-duration-base"]).toBe("250ms");
    expect(vars["--do-shadow-md"]).toMatch(/^0 \d+px \d+px/);
    for (const key of Object.keys(vars)) expect(key).toMatch(/^--do-[a-z0-9-]+$/);
  });

  it("differs between schemes only in colours and shadows", () => {
    const light = toCssVars("light");
    const dark = toCssVars("dark");
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
    const changed = Object.keys(light).filter((k) => light[k as keyof typeof light] !== dark[k as keyof typeof dark]);
    for (const key of changed) expect(key).toMatch(/^--do-(color|shadow)-/);
  });

  it("applies a colour override palette", () => {
    const vars = toCssVars("dark", { accent: "#123456" });
    expect(vars["--do-color-accent"]).toBe("#123456");
    expect(vars["--do-color-surface"]).toBe(colors.dark.surface);
  });
});
