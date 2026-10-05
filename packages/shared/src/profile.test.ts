import { initialFor } from "./profile";
import { ProfileSchema } from "./schemas";

describe("initialFor", () => {
  it("is the first letter of the trimmed name, upper-cased", () => {
    expect(initialFor("mom")).toBe("M");
    expect(initialFor("  lena ")).toBe("L");
    expect(initialFor("Élodie")).toBe("É");
  });
  it("keeps a character outside the basic plane whole", () => {
    expect(initialFor("🌷 Grandma")).toBe("🌷");
  });
  it("falls back to ? for a blank name", () => {
    expect(initialFor("")).toBe("?");
    expect(initialFor("   ")).toBe("?");
  });
  it("always fits ProfileSchema.initial", () => {
    for (const name of ["mom", "ßeta", "🌷", "ΐota", "", "ŉ"]) {
      expect(ProfileSchema.shape.initial.safeParse(initialFor(name)).success, name).toBe(true);
    }
  });
});
