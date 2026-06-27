import { createFileRoute } from "@tanstack/react-router";

const ROBOTS = `User-agent: *
Allow: /

Disallow: /auth
Disallow: /dashboard
Disallow: /admin
Disallow: /account
Disallow: /download

Sitemap: https://www.aurumvault.store/sitemap.xml
`;

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(ROBOTS, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        }),
    },
  },
});
