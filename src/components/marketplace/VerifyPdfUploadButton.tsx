import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ensurePdfJsRuntimeCompat } from "@/lib/pdfjs-compat";
import { CheckCircle2, Loader2, PlayCircle, XCircle, Clock } from "lucide-react";

// Tiny valid 1-page PDF (~1.3 KB, ReportLab-generated).
const SAMPLE_PDF_BASE64 =
  "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDcgMCBSIC9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0gL1BhcmVudCA2IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgNiAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYwNzExMTUyOTEzKzAwJzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYwNzExMTUyOTEzKzAwJzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKNyAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxMTcKPj4Kc3RyZWFtCkdhcFFoMEU9RiwwVVxIM1RccE5ZVF5RS2s/dGM+SVAsO1cjVTFeMjNpaFBFTV8/Q1o1MScqNE49bTAhMmAhckQwKGBGNT5RaWg+IVkoQixGQy9KU0hWKl1dalJ0QURhVkYhaD42QVFDSlxIM1FJNGFJclp+PmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDgKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAwOTIgMDAwMDAgbiAKMDAwMDAwMDE5OSAwMDAwMCBuIAowMDAwMDAwMzkyIDAwMDAwIG4gCjAwMDAwMDA0NjAgMDAwMDAgbiAKMDAwMDAwMDcyMSAwMDAwMCBuIAowMDAwMDAwNzgwIDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPDdjOTM2MjBmNjBkNzgxZjU3OGIxOTg1MGMwZDUyYzc3Pjw3YzkzNjIwZjYwZDc4MWY1NzhiMTk4NTBjMGQ1MmM3Nz5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChvcGVuc291cmNlKQoKL0luZm8gNSAwIFIKL1Jvb3QgNCAwIFIKL1NpemUgOAo+PgpzdGFydHhyZWYKOTg3CiUlRU9GCg==";

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

type StepState = "pending" | "running" | "ok" | "fail";
type Step = {
  id: string;
  label: string;
  state: StepState;
  detail?: string;
  startedAt?: number;
  endedAt?: number;
};

const INITIAL_STEPS: Step[] = [
  { id: "generate", label: "Generate sample PDF", state: "pending" },
  { id: "upload", label: "Upload to storage", state: "pending" },
  { id: "sign", label: "Create signed URL", state: "pending" },
  { id: "refetch", label: "Refetch bytes (simulates refresh)", state: "pending" },
  { id: "validate", label: "Validate PDF header + %%EOF", state: "pending" },
  { id: "render", label: "Render page 1 with pdf.js", state: "pending" },
  { id: "cleanup", label: "Delete test object", state: "pending" },
];

function fmtClock(ts?: number) {
  if (!ts) return "";
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function fmtDur(a?: number, b?: number) {
  if (!a || !b) return "";
  const ms = b - a;
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function VerifyPdfUploadButton() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [runStartedAt, setRunStartedAt] = useState<number | undefined>();
  const [runEndedAt, setRunEndedAt] = useState<number | undefined>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (active) setIsAdmin(data?.role === "admin");
      });
    return () => {
      active = false;
    };
  }, [loading, user]);

  function update(id: string, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function begin(id: string) {
    update(id, { state: "running", startedAt: Date.now() });
  }
  function pass(id: string, detail?: string) {
    update(id, { state: "ok", endedAt: Date.now(), detail });
  }

  async function runVerify() {
    if (!user) return;
    setExpanded(true);
    setRunning(true);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, state: "pending", detail: undefined, startedAt: undefined, endedAt: undefined })));
    const started = Date.now();
    setRunStartedAt(started);
    setRunEndedAt(undefined);
    const path = `verify/${user.id}/${Date.now()}-verify.pdf`;
    let uploaded = false;

    try {
      begin("generate");
      const bytes = base64ToBytes(SAMPLE_PDF_BASE64);
      const blob = new Blob(
        [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer],
        { type: "application/pdf" },
      );
      pass("generate", `${bytes.length} bytes`);

      begin("upload");
      const up = await supabase.storage.from("product-files").upload(path, blob, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (up.error) throw new Error(`Upload failed: ${up.error.message}`);
      uploaded = true;
      pass("upload", path);

      begin("sign");
      const signed = await supabase.storage.from("product-files").createSignedUrl(path, 120);
      if (signed.error || !signed.data?.signedUrl)
        throw new Error(`Sign failed: ${signed.error?.message ?? "no url"}`);
      pass("sign");

      begin("refetch");
      const res = await fetch(signed.data.signedUrl + "&_r=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
      const fetched = new Uint8Array(await res.arrayBuffer());
      pass("refetch", `${fetched.length} bytes`);

      begin("validate");
      const header = new TextDecoder().decode(fetched.slice(0, 5));
      const tail = new TextDecoder().decode(fetched.slice(Math.max(0, fetched.length - 32)));
      if (!header.startsWith("%PDF-")) throw new Error(`Bad header: ${JSON.stringify(header)}`);
      if (!tail.includes("%%EOF")) throw new Error("Missing %%EOF trailer");
      pass("validate", `${header.trim()} / %%EOF present`);

      begin("render");
      ensurePdfJsRuntimeCompat();
      const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
      try {
        const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      } catch {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
      }
      const doc = await pdfjs.getDocument({ data: fetched }).promise;
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const canvas = canvasRef.current!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      pass("render", `${doc.numPages} page(s), ${Math.round(viewport.width)}×${Math.round(viewport.height)}`);

      begin("cleanup");
      const del = await supabase.storage.from("product-files").remove([path]);
      if (del.error) throw new Error(`Cleanup failed: ${del.error.message}`);
      uploaded = false;
      pass("cleanup");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.state === "running");
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], state: "fail", endedAt: Date.now(), detail: msg };
        return next;
      });
      if (uploaded) {
        try {
          await supabase.storage.from("product-files").remove([path]);
        } catch {
          /* ignore */
        }
      }
    } finally {
      setRunning(false);
      setRunEndedAt(Date.now());
    }
  }

  const summary = useMemo(() => {
    const total = steps.length;
    const okCount = steps.filter((s) => s.state === "ok").length;
    const failCount = steps.filter((s) => s.state === "fail").length;
    const anyFail = failCount > 0;
    const allOk = okCount === total;
    return { total, okCount, failCount, anyFail, allOk };
  }, [steps]);

  if (!isAdmin) return null;

  const hasRun = runStartedAt !== undefined;
  const status: "idle" | "running" | "pass" | "fail" = running
    ? "running"
    : summary.anyFail
      ? "fail"
      : summary.allOk && hasRun
        ? "pass"
        : "idle";

  const statusChip =
    status === "pass"
      ? { cls: "bg-green-100 text-green-800 border-green-200", label: "PASS" }
      : status === "fail"
        ? { cls: "bg-red-100 text-red-800 border-red-200", label: "FAIL" }
        : status === "running"
          ? { cls: "bg-amber-100 text-amber-800 border-amber-200", label: "RUNNING" }
          : { cls: "bg-ink/5 text-mute border-ink/10", label: "IDLE" };

  return (
    <div className="mt-4 rounded-xl border border-dashed border-ink/20 bg-paper/60 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-navy">Verify PDF upload (admin)</div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusChip.cls}`}>
              {statusChip.label}
            </span>
          </div>
          <div className="text-xs text-mute">
            Uploads a sample PDF, refetches via signed URL, renders page 1, then deletes it.
          </div>
        </div>
        <button
          type="button"
          onClick={runVerify}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg bg-navy text-white px-3 py-1.5 text-xs font-medium disabled:opacity-60 whitespace-nowrap"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          {running ? "Running…" : hasRun ? "Run again" : "Run verify"}
        </button>
      </div>

      {expanded && (
        <>
          {hasRun && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-mute">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Started {fmtClock(runStartedAt)}
              </span>
              {runEndedAt && <span>Ended {fmtClock(runEndedAt)}</span>}
              {runEndedAt && <span>Duration {fmtDur(runStartedAt, runEndedAt)}</span>}
              <span>
                {summary.okCount}/{summary.total} passed
                {summary.failCount ? ` · ${summary.failCount} failed` : ""}
              </span>
            </div>
          )}

          {status === "pass" && (
            <div className="mt-3 rounded-md bg-green-50 border border-green-200 text-green-800 text-xs px-2 py-1.5">
              ✅ All {summary.total} checks passed. PDF upload + preview-after-refresh is working on this domain.
            </div>
          )}
          {status === "fail" && (
            <div className="mt-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs px-2 py-1.5">
              ❌ {summary.failCount} check{summary.failCount === 1 ? "" : "s"} failed — see the failing step below.
            </div>
          )}

          <ol className="mt-3 space-y-1.5">
            {steps.map((s, i) => (
              <li key={s.id} className="flex items-start gap-2 rounded-md border border-ink/10 bg-white px-2 py-1.5">
                <div className="mt-0.5">
                  {s.state === "ok" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  {s.state === "fail" && <XCircle className="h-4 w-4 text-red-600" />}
                  {s.state === "running" && <Loader2 className="h-4 w-4 animate-spin text-amber-600" />}
                  {s.state === "pending" && <div className="h-4 w-4 rounded-full border border-ink/20" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-navy">
                      <span className="text-mute mr-1">{i + 1}.</span>
                      {s.label}
                    </div>
                    <div className="text-[10px] text-mute whitespace-nowrap tabular-nums">
                      {s.startedAt && fmtClock(s.startedAt)}
                      {s.endedAt && s.startedAt && (
                        <span className="ml-1">· {fmtDur(s.startedAt, s.endedAt)}</span>
                      )}
                    </div>
                  </div>
                  {s.detail && (
                    <div className={`mt-0.5 text-[11px] break-words ${s.state === "fail" ? "text-red-700" : "text-mute"}`}>
                      {s.detail}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-3">
            <div className="text-[11px] font-medium text-mute mb-1">Rendered page 1 preview</div>
            <div className="rounded-md border border-ink/10 bg-white p-1.5 overflow-auto">
              <canvas ref={canvasRef} className="max-w-full h-auto" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
