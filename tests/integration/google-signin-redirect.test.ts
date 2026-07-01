import { describe, it, expect } from "bun:test";
import { resolvePostAuthRedirect } from "@/lib/post-auth-redirect";

describe("resolvePostAuthRedirect (Google sign-in routing)", () => {
  it("routes sellers to /dashboard", () => {
    expect(resolvePostAuthRedirect({ roles: ["seller"] })).toBe("/dashboard");
  });

  it("routes admins to /dashboard", () => {
    expect(resolvePostAuthRedirect({ roles: ["admin"] })).toBe("/dashboard");
  });

  it("routes buyers (no role or role='buyer') to /", () => {
    expect(resolvePostAuthRedirect({ roles: [] })).toBe("/");
    expect(resolvePostAuthRedirect({ roles: null })).toBe("/");
    expect(resolvePostAuthRedirect({ roles: ["buyer"] })).toBe("/");
  });

  it("is case-insensitive on role names", () => {
    expect(resolvePostAuthRedirect({ roles: ["SELLER"] })).toBe("/dashboard");
    expect(resolvePostAuthRedirect({ roles: ["Admin"] })).toBe("/dashboard");
  });

  it("honors a safe same-origin savedRedirect for both roles", () => {
    expect(
      resolvePostAuthRedirect({ roles: ["seller"], savedRedirect: "/orders/123" }),
    ).toBe("/orders/123");
    expect(
      resolvePostAuthRedirect({ roles: ["buyer"], savedRedirect: "/wishlist" }),
    ).toBe("/wishlist");
  });

  it("ignores unsafe savedRedirect values (absolute URLs, protocol-relative)", () => {
    expect(
      resolvePostAuthRedirect({
        roles: ["seller"],
        savedRedirect: "https://evil.example.com/steal",
      }),
    ).toBe("/dashboard");
    expect(
      resolvePostAuthRedirect({ roles: [], savedRedirect: "//evil.example.com" }),
    ).toBe("/");
    expect(resolvePostAuthRedirect({ roles: [], savedRedirect: "" })).toBe("/");
    expect(resolvePostAuthRedirect({ roles: [], savedRedirect: null })).toBe("/");
  });

  it("prefers seller/admin role when both are present", () => {
    expect(resolvePostAuthRedirect({ roles: ["buyer", "seller"] })).toBe(
      "/dashboard",
    );
  });
});
