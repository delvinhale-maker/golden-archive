import { describe, expect, it } from "vitest";
import { decideCreatorStudioReservation } from "./creator-studio-entitlements";

describe("decideCreatorStudioReservation", () => {
  it("allows one free preview only", () => {
    expect(
      decideCreatorStudioReservation({
        plan: "FREE",
        includedSettled: 0,
        includedReserved: 0,
        extraCreditsAvailable: 0,
        freePreviewConsumed: false,
      }),
    ).toEqual({ allowed: true, source: "FREE_PREVIEW" });

    expect(
      decideCreatorStudioReservation({
        plan: "FREE",
        includedSettled: 0,
        includedReserved: 0,
        extraCreditsAvailable: 0,
        freePreviewConsumed: true,
      }),
    ).toEqual({ allowed: false, reason: "FREE_PREVIEW_USED" });
  });

  it("reserves included Pro allowance before extra credits", () => {
    expect(
      decideCreatorStudioReservation({
        plan: "CREATOR_PRO",
        includedSettled: 8,
        includedReserved: 1,
        extraCreditsAvailable: 2,
        freePreviewConsumed: false,
      }),
    ).toEqual({ allowed: true, source: "INCLUDED" });
  });

  it("uses an extra credit after the monthly allowance is committed", () => {
    expect(
      decideCreatorStudioReservation({
        plan: "CREATOR_BUSINESS",
        includedSettled: 49,
        includedReserved: 1,
        extraCreditsAvailable: 1,
        freePreviewConsumed: false,
      }),
    ).toEqual({ allowed: true, source: "EXTRA_CREDIT" });
  });
});
