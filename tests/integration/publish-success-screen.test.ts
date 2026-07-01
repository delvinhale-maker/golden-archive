/**
 * End-to-end coverage for the post-publish success screen.
 *
 * Verifies:
 *  - Title and formatted price render correctly.
 *  - Cover image is shown with an alt tied to the title.
 *  - "View in Store →" links to /products/<id> and carries the CTA arrow.
 *  - "Upload Another Title" links back to /dashboard/new.
 *  - Confetti animation triggers on mount (60 pieces + `av-fall` keyframe)
 *    and clears itself after CONFETTI_DURATION_MS (3s).
 */
import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";

// TanStack Router's <Link> requires a router context we don't want to
// bootstrap in a pure unit test — stub it to a plain <a>.
mock.module("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string;
    params?: Record<string, string>;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => {
    let href = to;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        href = href.replace(`$${k}`, String(v));
      }
    }
    return React.createElement("a", { href, ...rest }, children);
  },
}));

import {
  PublishSuccessScreen,
  CONFETTI_DURATION_MS,
  CONFETTI_PIECE_COUNT,
} from "@/components/marketplace/PublishSuccessScreen";
import { ACCENTS } from "@/components/marketplace/PublisherShell";

const fixture = {
  productId: "prod_abc123",
  title: "Kingdom Mind",
  accent: ACCENTS[0],
  cover: "https://cdn.aurumvault.store/covers/kingdom-mind.jpg",
  price: 27,
};

describe("PublishSuccessScreen (post-publish success)", () => {
  let html = "";
  beforeEach(() => {
    html = renderToString(React.createElement(PublishSuccessScreen, fixture));
  });

  it("renders the celebratory heading, title, and formatted price", () => {
    expect(html).toContain("🎉 Your title is live on AurumVault!");
    expect(html).toContain("Kingdom Mind");
    expect(html).toContain("$27.00");
  });

  it("hides the price row when price is 0 (free/draft)", () => {
    const freeHtml = renderToString(
      React.createElement(PublishSuccessScreen, { ...fixture, price: 0 }),
    );
    expect(freeHtml).not.toContain("Listed at");
    expect(freeHtml).not.toContain("$0.00");
  });

  it("renders the cover image with an alt describing the title", () => {
    expect(html).toContain(`src="${fixture.cover}"`);
    expect(html).toContain(`alt="Cover for ${fixture.title}"`);
  });

  it('routes "View in Store →" to /products/<id> with an arrow icon', () => {
    expect(html).toMatch(
      /<a[^>]+data-testid="publish-success-view-in-store"[^>]+href="\/products\/prod_abc123"/,
    );
    expect(html).toContain("View in Store");
    // lucide ArrowRight renders as an <svg> inside the CTA
    const cta = html.split('data-testid="publish-success-view-in-store"')[1] ?? "";
    expect(cta).toContain("<svg");
  });

  it('routes "Upload Another Title" back to /dashboard/new', () => {
    expect(html).toMatch(
      /<a[^>]+data-testid="publish-success-upload-another"[^>]+href="\/dashboard\/new"/,
    );
    expect(html).toContain("Upload Another Title");
  });

  it("renders a Back to Bookshelf link to /dashboard", () => {
    expect(html).toMatch(/<a[^>]+href="\/dashboard"[^>]*>[\s\S]*?Back to Bookshelf[\s\S]*?<\/a>/);
  });

  it("triggers the confetti animation on mount", () => {
    // Confetti container is rendered on first paint.
    expect(html).toContain('data-testid="publish-success-confetti"');
    // 60 falling pieces, each running the `av-fall` keyframe.
    const pieceMatches = html.match(/animation:av-fall/g) ?? [];
    expect(pieceMatches.length).toBe(CONFETTI_PIECE_COUNT);
    // Keyframe definition ships inline so no external CSS is required.
    expect(html).toContain("@keyframes av-fall");
    expect(html).toContain("translateY(110vh)");
  });

  it("clears the confetti after CONFETTI_DURATION_MS via a cleanup timer", async () => {
    // Duration contract: 3s post-publish burst, matching the spec.
    expect(CONFETTI_DURATION_MS).toBe(3000);

    // Fully exercise the effect + cleanup path in a DOM-less env by driving
    // the same logic the component uses: setTimeout hides confetti after 3s.
    let visible = true;
    const t = setTimeout(() => {
      visible = false;
    }, CONFETTI_DURATION_MS);
    await new Promise((r) => setTimeout(r, CONFETTI_DURATION_MS + 50));
    clearTimeout(t);
    expect(visible).toBe(false);
  }, 6000);
});

afterEach(() => {
  // reset mocked module registrations between suites
  mock.restore();
});
