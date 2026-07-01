import { test, expect, mock } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";

mock.module("@tanstack/react-router", () => ({
  Link: (props: any) => React.createElement("a", { href: props.to, "data-testid": props["data-testid"] }, props.children),
}));

test("probe", async () => {
  const { PublishSuccessScreen } = await import("/dev-server/src/components/marketplace/PublishSuccessScreen");
  const html = renderToString(React.createElement(PublishSuccessScreen, {
    productId: "p1", title: "T", accent: { color: "#000", tint: "#111" }, cover: null, price: 0,
  }));
  require("fs").writeFileSync("/tmp/rendered.html", html);
  console.log("LEN", html.length);
  console.log("HAS_A", /publish-success-view-in-store/.test(html));
});
