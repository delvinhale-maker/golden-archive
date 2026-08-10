import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import {
  CONSENT_EVENT,
  CONSENT_OPEN_EVENT,
  getConsent,
  setConsent,
  type ConsentValue,
} from "@/lib/consent";

const GA_MEASUREMENT_ID = "G-XXXXXXXXXX";

/** Injects advertising/analytics tags only once, and only after consent. */
function loadNonEssentialScripts() {
  if (typeof document === "undefined") return;
  if (document.getElementById("av-consent-analytics")) return;

  const gtag = document.createElement("script");
  gtag.id = "av-consent-analytics";
  gtag.async = true;
  gtag.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(gtag);

  const inline = document.createElement("script");
  inline.text = `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${GA_MEASUREMENT_ID}');`;
  document.head.appendChild(inline);

  const ads = document.createElement("script");
  ads.async = true;
  ads.crossOrigin = "anonymous";
  ads.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
  document.head.appendChild(ads);
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getConsent();
    if (existing === "accepted") loadNonEssentialScripts();
    if (existing === null) setVisible(true);

    const onOpen = () => setVisible(true);
    const onChange = (e: Event) => {
      const value = (e as CustomEvent<ConsentValue>).detail;
      if (value === "accepted") loadNonEssentialScripts();
    };
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen);
    window.addEventListener(CONSENT_EVENT, onChange as EventListener);
    return () => {
      window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
      window.removeEventListener(CONSENT_EVENT, onChange as EventListener);
    };
  }, []);

  const choose = useCallback((value: ConsentValue) => {
    setConsent(value);
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      data-testid="cookie-consent"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-border bg-card/95 px-4 py-4 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-card/80"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-muted-foreground">
          We use essential cookies to keep your session and cart working. With your
          consent we also use advertising and analytics cookies — including Google
          AdSense — to measure traffic and show relevant ads. See our{" "}
          <Link to="/privacy" className="font-medium text-foreground underline">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("rejected")}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Reject non-essential
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;
