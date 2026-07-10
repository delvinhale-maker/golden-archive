// Client-side diagnostics for Google Sign-In failures.
// Runs a series of quick, non-destructive checks so users (and support) can
// tell whether a failure was caused by cookies, popup blockers, storage
// restrictions, or a redirect/config mismatch.

export type DiagnosticStatus = "ok" | "warn" | "fail" | "unknown";

export type DiagnosticCheck = {
  id:
    | "cookies"
    | "thirdPartyCookies"
    | "localStorage"
    | "sessionStorage"
    | "popup"
    | "iframe"
    | "online";
  label: string;
  status: DiagnosticStatus;
  detail?: string;
};

export type DiagnosticsResult = {
  checks: DiagnosticCheck[];
  summary: string;
  primaryIssue?: DiagnosticCheck["id"];
};

function checkCookies(): DiagnosticCheck {
  try {
    if (typeof navigator !== "undefined" && navigator.cookieEnabled === false) {
      return {
        id: "cookies",
        label: "Cookies enabled",
        status: "fail",
        detail: "Your browser has cookies disabled. Enable cookies for aurumvault.store.",
      };
    }
    // Round-trip test
    const key = `__av_cookie_test_${Date.now()}`;
    document.cookie = `${key}=1; path=/; SameSite=Lax`;
    const ok = document.cookie.includes(`${key}=1`);
    // clean up
    document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    return ok
      ? { id: "cookies", label: "Cookies enabled", status: "ok" }
      : {
          id: "cookies",
          label: "Cookies enabled",
          status: "fail",
          detail: "Cookies could not be written. Check browser privacy settings.",
        };
  } catch (e) {
    return {
      id: "cookies",
      label: "Cookies enabled",
      status: "fail",
      detail: e instanceof Error ? e.message : "Cookie access blocked.",
    };
  }
}

function checkThirdPartyCookies(): DiagnosticCheck {
  // We can't definitively test 3rd-party cookies without a cross-origin frame,
  // but we can infer likely blocks on iOS Safari / Brave / Firefox strict mode.
  try {
    const ua = navigator.userAgent || "";
    const isIOSSafari = /iP(hone|ad|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
    const isBrave =
      typeof (navigator as unknown as { brave?: { isBrave?: () => Promise<boolean> } }).brave !==
      "undefined";
    if (isIOSSafari) {
      return {
        id: "thirdPartyCookies",
        label: "Third-party cookies",
        status: "warn",
        detail:
          "iOS Safari blocks cross-site cookies by default (Prevent Cross-Site Tracking). Disable it under Settings → Safari if Google sign-in fails.",
      };
    }
    if (isBrave) {
      return {
        id: "thirdPartyCookies",
        label: "Third-party cookies",
        status: "warn",
        detail: "Brave shields may block Google's OAuth cookies. Try lowering shields for this site.",
      };
    }
    return { id: "thirdPartyCookies", label: "Third-party cookies", status: "unknown" };
  } catch {
    return { id: "thirdPartyCookies", label: "Third-party cookies", status: "unknown" };
  }
}

function checkStorage(kind: "local" | "session"): DiagnosticCheck {
  const storage = kind === "local" ? "localStorage" : "sessionStorage";
  try {
    const s = window[storage];
    const key = `__av_${storage}_test`;
    s.setItem(key, "1");
    s.removeItem(key);
    return { id: storage, label: `${storage} writable`, status: "ok" };
  } catch (e) {
    return {
      id: storage,
      label: `${storage} writable`,
      status: "fail",
      detail:
        (e instanceof Error ? e.message : "") ||
        `Private/Incognito mode may block ${storage}. Try a normal window.`,
    };
  }
}

function checkPopup(): DiagnosticCheck {
  try {
    // Open a same-origin blank popup synchronously; if blocked, w is null.
    const w = window.open("about:blank", "_av_popup_test", "width=200,height=200");
    if (!w) {
      return {
        id: "popup",
        label: "Popups allowed",
        status: "fail",
        detail: "Popups are blocked. Allow popups for aurumvault.store and retry.",
      };
    }
    try {
      w.close();
    } catch {
      /* ignore */
    }
    return { id: "popup", label: "Popups allowed", status: "ok" };
  } catch (e) {
    return {
      id: "popup",
      label: "Popups allowed",
      status: "fail",
      detail: e instanceof Error ? e.message : "Popup could not be opened.",
    };
  }
}

function checkIframe(): DiagnosticCheck {
  try {
    const inIframe = window.self !== window.top;
    if (inIframe) {
      return {
        id: "iframe",
        label: "Top-level context",
        status: "warn",
        detail:
          "Page is running inside an iframe. Google OAuth uses the web_message flow, but some browsers still restrict cross-origin storage here.",
      };
    }
    return { id: "iframe", label: "Top-level context", status: "ok" };
  } catch {
    // Cross-origin frame access threw → we are in an iframe.
    return {
      id: "iframe",
      label: "Top-level context",
      status: "warn",
      detail: "Page appears to be embedded (cross-origin frame).",
    };
  }
}

function checkOnline(): DiagnosticCheck {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      id: "online",
      label: "Network reachable",
      status: "fail",
      detail: "Your device reports it is offline.",
    };
  }
  return { id: "online", label: "Network reachable", status: "ok" };
}

/** Run all diagnostics. Safe to call on demand — no network requests. */
export function runGoogleSignInDiagnostics(): DiagnosticsResult {
  const checks: DiagnosticCheck[] = [
    checkOnline(),
    checkCookies(),
    checkThirdPartyCookies(),
    checkStorage("local"),
    checkStorage("session"),
    checkPopup(),
    checkIframe(),
  ];

  const failed = checks.find((c) => c.status === "fail");
  const warned = checks.find((c) => c.status === "warn");
  const primary = failed ?? warned;

  const summary = failed
    ? `Likely cause: ${failed.label.toLowerCase()} — ${failed.detail ?? "blocked"}`
    : warned
      ? `Possible cause: ${warned.label.toLowerCase()} — ${warned.detail ?? "restricted"}`
      : "No local issues detected. If sign-in still fails, it is likely a Google-side redirect/config problem.";

  return { checks, summary, primaryIssue: primary?.id };
}

/** Compact one-line human summary, safe to include in a toast. */
export function diagnosticsShortLine(r: DiagnosticsResult): string {
  const fails = r.checks.filter((c) => c.status === "fail").map((c) => c.label);
  const warns = r.checks.filter((c) => c.status === "warn").map((c) => c.label);
  if (fails.length) return `Blocked: ${fails.join(", ")}`;
  if (warns.length) return `Warning: ${warns.join(", ")}`;
  return "All local checks passed";
}
