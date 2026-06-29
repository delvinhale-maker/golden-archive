import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { installGlobalErrorHandlers, reportClientError } from "../lib/client-error-reporter";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    reportClientError(error, { source: "boundary", severity: "fatal" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0F1E35" },
      { name: "robots", content: "index, follow" },
      { name: "google-site-verification", content: "TZD7DBctq42sAIhH5gDz3cusg5R4yPL7fAaARnOxEG8" },
      { name: "author", content: "Illustrious Capital™" },
      {
        name: "keywords",
        content:
          "digital products, ebooks, Kingdom resources, faith-based books, purpose-driven, Illustrious Capital",
      },
      { title: "AurumVault — Gold Standard Digital Commerce" },
      {
        name: "description",
        content:
          "Discover premium eBooks, courses, templates, and digital resources from verified purpose-driven creators. Powered by Illustrious Capital™.",
      },
      { property: "og:site_name", content: "AurumVault" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "AurumVault — Gold Standard Digital Commerce" },
      {
        property: "og:description",
        content:
          "Premium digital marketplace for eBooks, courses, templates, audio, and leadership resources.",
      },
      { property: "og:url", content: "https://www.aurumvault.store" },
      { property: "og:image", content: "https://www.aurumvault.store/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "AurumVault — Gold Standard Digital Commerce" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@AurumVault" },
      { name: "twitter:title", content: "AurumVault — Gold Standard Digital Commerce" },
      {
        name: "twitter:description",
        content:
          "Premium digital marketplace for eBooks, courses, templates, audio, and leadership resources.",
      },
      { name: "twitter:image", content: "https://www.aurumvault.store/og-image.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700;800&family=Inter:wght@300;400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://www.aurumvault.store/#organization",
              name: "AurumVault",
              alternateName: "Aurum Vault",
              url: "https://www.aurumvault.store",
              logo: {
                "@type": "ImageObject",
                "@id": "https://www.aurumvault.store/#logo",
                url: "https://www.aurumvault.store/og-image.png",
                contentUrl: "https://www.aurumvault.store/og-image.png",
                width: 1200,
                height: 630,
                caption: "AurumVault — Gold Standard Digital Commerce",
              },
              slogan: "Gold Standard Digital Commerce",
              parentOrganization: {
                "@type": "Organization",
                name: "Illustrious Capital",
              },
              sameAs: [
                "https://twitter.com/AurumVault",
              ],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer support",
                email: "support@aurumvault.store",
                availableLanguage: ["English"],
              },
            },
            {
              "@type": "WebSite",
              "@id": "https://www.aurumvault.store/#website",
              url: "https://www.aurumvault.store",
              name: "AurumVault",
              description:
                "Premium digital marketplace for eBooks, courses, templates, audio, and leadership resources.",
              publisher: { "@id": "https://www.aurumvault.store/#organization" },
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: "https://www.aurumvault.store/search?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            },
            {
              "@type": "OnlineStore",
              "@id": "https://www.aurumvault.store/#store",
              name: "AurumVault",
              url: "https://www.aurumvault.store",
              parentOrganization: { "@id": "https://www.aurumvault.store/#organization" },
            },
          ],
        }),
      },

      // Google Analytics 4 (placeholder)
      // Replace G-XXXXXXXXXX with your GA4 Measurement ID
      {
        src: "https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX",
        async: true,
      },
      {
        children:
          "window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-XXXXXXXXXX');",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Capture ?ref=CODE into localStorage so signups & checkouts can attribute.
    import("@/lib/referral").then((m) => m.captureRefFromUrl()).catch(() => {});
    // Forward uncaught errors and unhandled rejections to the production error log.
    installGlobalErrorHandlers();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
