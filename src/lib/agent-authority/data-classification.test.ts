import { describe, expect, it } from "vitest";
import { stricterDataClassification } from "./data-classification.server";

 describe("Agent Authority data classification", () => {
  it("never lets a caller downgrade a stored classification", () => {
    expect(stricterDataClassification("PUBLIC", "RESTRICTED")).toBe("RESTRICTED");
    expect(stricterDataClassification("INTERNAL", "CONFIDENTIAL")).toBe("CONFIDENTIAL");
  });

  it("preserves an explicitly stricter classification", () => {
    expect(stricterDataClassification("RESTRICTED", "PUBLIC")).toBe("RESTRICTED");
    expect(stricterDataClassification("CONFIDENTIAL", "INTERNAL")).toBe("CONFIDENTIAL");
  });

  it("handles one-sided and missing classifications", () => {
    expect(stricterDataClassification("INTERNAL", null)).toBe("INTERNAL");
    expect(stricterDataClassification(null, "CONFIDENTIAL")).toBe("CONFIDENTIAL");
    expect(stricterDataClassification(null, null)).toBeNull();
  });
});
