import { describe, expect, it } from "vitest";
import {
  RIGHTS_QUESTIONS,
  rightsReadinessBand,
  scoreRightsReadiness,
} from "@/lib/ai-likeness-rights-risk-checker";

describe("AI likeness rights readiness scoring", () => {
  it("uses the specified band boundaries", () => {
    expect(rightsReadinessBand(5)).toBe("stronger_foundation");
    expect(rightsReadinessBand(6)).toBe("needs_clarification");
    expect(rightsReadinessBand(12)).toBe("needs_clarification");
    expect(rightsReadinessBand(13)).toBe("high_documentation_gap");
  });

  it("scores yes=0, not sure=1 and no=2", () => {
    const answers = Object.fromEntries(
      RIGHTS_QUESTIONS.map((q, i) => [
        q.id,
        i < 2 ? "no" : i < 5 ? "not_sure" : "yes",
      ]),
    ) as Record<string, "yes" | "not_sure" | "no">;

    const result = scoreRightsReadiness(answers);
    expect(result.score).toBe(7);
    expect(result.band).toBe("needs_clarification");
    expect(result.gaps).toHaveLength(5);
    expect(result.gaps[0].points).toBe(2);
  });
});
