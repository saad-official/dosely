import { describe, expect, it } from "vitest";
import { colors } from "@dosely/shared/tokens";
import { THEMES } from "@dosely/shared/themes";
import { buildTokensCss, themeStyle } from "@/lib/tokens-css";

describe("buildTokensCss", () => {
  const css = buildTokensCss();

  it("puts every light token on :root", () => {
    expect(css).toMatch(/:root \{[^}]*--do-color-surface: #F7F9F9;/);
    expect(css).toMatch(/:root \{[^}]*--do-space-md: 16px;/);
  });

  it("switches colours for the .dark class and for a system dark preference without .light", () => {
    expect(css).toMatch(new RegExp(`\\.dark \\{[^}]*--do-color-surface: ${colors.dark.surface};`));
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\.light\) \{[^}]*--do-color-accent: #3BC4BA;/);
  });

  it("only repeats tokens that change in dark", () => {
    const dark = css.slice(css.indexOf(".dark {"));
    expect(dark).not.toContain("--do-space-md");
    expect(dark).toContain("--do-shadow-md");
  });
});

describe("themeStyle", () => {
  it("returns the theme's resolved colours as custom properties for inline style", () => {
    const style = themeStyle("halloween", "dark");
    expect(style["--do-color-accent"]).toBe(THEMES.halloween.dark.accent);
    expect(style["--do-color-text"]).toBe(colors.dark.text);
    expect(Object.keys(style).every((k) => k.startsWith("--do-color-"))).toBe(true);
  });
});

describe("scoped schemes", () => {
  const css = buildTokensCss();

  it("lets any element force a scheme with data-scheme", () => {
    const block = (scheme: "light" | "dark") => {
      const start = css.indexOf(`[data-scheme="${scheme}"] {`);
      expect(start, scheme).toBeGreaterThanOrEqual(0);
      return css.slice(start, css.indexOf("}", start));
    };
    expect(block("dark")).toContain(`--do-color-surface: ${colors.dark.surface};`);
    expect(block("light")).toContain(`--do-color-surface: ${colors.light.surface};`);
    expect(block("light")).toContain("color-scheme: light;");
  });
});
