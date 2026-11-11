import { describe, expect, it } from "vitest";
import { familyOf } from "@/domain/modelFamily";

describe("familyOf", () => {
  it("drops the provider before the first slash", () => {
    expect(familyOf("openai/clip-vit-base")).toBe("clip-vit-base");
  });

  it("keeps later slashes as part of the family", () => {
    expect(familyOf("hub/org/model")).toBe("org/model");
  });

  it("returns the whole name when there is no slash", () => {
    expect(familyOf("yolo")).toBe("yolo");
  });

  it("returns an empty string for an empty name", () => {
    expect(familyOf("")).toBe("");
  });

  it("returns an empty family when the name ends with the slash", () => {
    expect(familyOf("provider/")).toBe("");
  });
});
