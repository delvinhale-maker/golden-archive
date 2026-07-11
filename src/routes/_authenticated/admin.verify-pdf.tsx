import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ensurePdfJsRuntimeCompat } from "@/lib/pdfjs-compat";
import { ArrowLeft, CheckCircle2, Loader2, XCircle, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/verify-pdf")({
  component: VerifyPdfPage,
  head: () => ({
    meta: [{ title: "Verify PDF upload — Admin" }],
  }),
});

// Tiny valid 1-page PDF generated with ReportLab (~1.3 KB).
const SAMPLE_PDF_BASE64 =
  "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDcgMCBSIC9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0gL1BhcmVudCA2IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgNiAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYwNzExMTUyOTEzKzAwJzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYwNzExMTUyOTEzKzAwJzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKNyAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxMTcKPj4Kc3RyZWFtCkdhcFFoMEU9RiwwVVxIM1RccE5ZVF5RS2s/dGM+SVAsO1cjVTFeMjNpaFBFTV8/Q1o1MScqNE49bTAhMmAhckQwKGBGNT5RaWg+IVkoQixGQy9KU0hWKl1dalJ0QURhVkYhaD42QVFDSlxIM1FJNGFJclp+PmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDgKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAwOTIgMDAwMDAgbiAKMDAwMDAwMDE5OSAwMDAwMCBuIAowMDAwMDAwMzkyIDAwMDAwIG4gCjAwMDAwMDA0NjAgMDAwMDAgbiAKMDAwMDAwMDcyMSAwMDAwMCBuIAowMDAwMDAwNzgwIDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPDdjOTM2MjBmNjBkNzgxZjU3OGIxOTg1MGMwZDUyYzc3Pjw3YzkzNjIwZjYwZDc4MWY1NzhiMTk4NTBjMGQ1MmM3Nz5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChvcGVuc291cmNlKQoKL0luZm8gNSAwIFIKL1Jvb3QgNCAwIFIKL1NpemUgOAo+PgpzdGFydHhyZWYKOTg3CiUlRU9GCg==";

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

type StepState = "pending" | "running" | "ok" | "fail";
type Step = { id: string; label: string; state: StepState; detail?: string };

const INITIAL_STEPS: Step[] = [
  { id: "generate", label: "Generate sample PDF", state: "pending" },
  { id: "upload", label: "Upload to storage", state: "pending" },
  { id: "sign", label: "Create signed URL", state: "pending" },
  { id: "refetch", label: "Refetch bytes (simulates refresh)", state: "pending" },
  { id: "validate", label: "Validate PDF header + %%EOF", state: "pending" },
  { id: "render", label: "Render page 1 with pdf.js", state: "pending" },
  { id: "cleanup", label: "Delete test object", state: "pending" },
];

function VerifyPdfPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
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
        if (!active) return;
        const allowed = data?.role === "admin";
        setIsAdmin(allowed);
        setCheckingAdmin(false);
        if (!allowed) navigate({ to: "/dashboard" });
      });
    return () => {
      active = false;
    };
  }, [loading, user, navigate]);

  function update(id: string, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function runVerify() {
    if (!user) return;
    setRunning(true);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, state: "pending", detail: undefined })));
    const path = `verify/${user.id}/${Date.now()}-verify.pdf`;
    let uploaded = false;

    try {
      // 1. Generate
      update("generate", { state: "running" });
      const bytes = base64ToBytes(SAMPLE_PDF_BASE64);
      const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: "application/pdf" });
      update("generate", { state: "ok", detail: `${bytes.length} bytes` });

      // 2. Upload
      update("upload", { state: "running" });
      const up = await supabase.storage.from("product-files").upload(path, blob, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (up.error) throw new Error(`Upload failed: ${up.error.message}`);
      uploaded = true;
      update("upload", { state: "ok", detail: path });

      // 3. Sign
      update("sign", { state: "running" });
      const signed = await supabase.storage.from("product-files").createSignedUrl(path, 120);
      if (signed.error || !signed.data?.signedUrl) throw new Error(`Sign failed: ${signed.error?.message ?? "no url"}`);
      update("sign", { state: "ok" });

      // 4. Refetch — cache-busted to simulate a fresh page load
      update("refetch", { state: "running" });
      const res = await fetch(signed.data.signedUrl + "&_r=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
      const fetched = new Uint8Array(await res.arrayBuffer());
      update("refetch", { state: "ok", detail: `${fetched.length} bytes` });

      // 5. Validate
      update("validate", { state: "running" });
      const header = new TextDecoder().decode(fetched.slice(0, 5));
      const tailStart = Math.max(0, fetched.length - 32);
      const tail = new TextDecoder().decode(fetched.slice(tailStart));
      if (!header.startsWith("%PDF-")) throw new Error(`Bad header: ${JSON.stringify(header)}`);
      if (!tail.includes("%%EOF")) throw new Error("Missing %%EOF trailer");
      update("validate", { state: "ok", detail: `${header.trim()} / %%EOF present` });

      // 6. Render page 1
      update("render", { state: "running" });
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
      update("render", { state: "ok", detail: `${doc.numPages} page(s), ${Math.round(viewport.width)}×${Math.round(viewport.height)}` });

      // 7. Cleanup
      update("cleanup", { state: "running" });
      const del = await supabase.storage.from("product-files").remove([path]);
      if (del.error) throw new Error(`Cleanup failed: ${del.error.message}`);
      uploaded = false;
      update("cleanup", { state: "ok" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.state === "running");
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], state: "fail", detail: msg };
        return next;
      });
      // Best-effort cleanup on failure
      if (uploaded) {
        try {
          await supabase.storage.from("product-files").remove([path]);
        } catch {
          /* ignore */
        }
      }
    } finally {
      setRunning(false);
    }
  }

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }
  if (!isAdmin) return null;

  const allOk = steps.every((s) => s.state === "ok");
  const anyFail = steps.some((s) => s.state === "fail");

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to admin
        </Link>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6">
          <h1 className="text-xl font-semibold text-gray-900">Verify PDF upload</h1>
          <p className="mt-1 text-sm text-gray-600">
            Uploads a tiny generated PDF to <code className="text-xs">product-files</code>, refetches it via a signed URL to
            simulate a page refresh, validates the bytes, renders page 1, then deletes the test object.
          </p>

          <button
            type="button"
            onClick={runVerify}
            disabled={running}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gray-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {running ? "Running…" : "Run verify"}
          </button>

          {allOk && !running && (
            <div className="mt-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm px-3 py-2">
              All checks passed. PDF upload + preview-after-refresh is working on this domain.
            </div>
          )}
          {anyFail && !running && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">
              One or more checks failed — see the failing step below.
            </div>
          )}

          <ol className="mt-5 space-y-2">
            {steps.map((s) => (
              <li key={s.id} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="mt-0.5">
                  {s.state === "ok" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                  {s.state === "fail" && <XCircle className="h-5 w-5 text-red-600" />}
                  {s.state === "running" && <Loader2 className="h-5 w-5 animate-spin text-gray-500" />}
                  {s.state === "pending" && <div className="h-5 w-5 rounded-full border border-gray-300" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">{s.label}</div>
                  {s.detail && (
                    <div className={`mt-0.5 text-xs break-words ${s.state === "fail" ? "text-red-700" : "text-gray-500"}`}>
                      {s.detail}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-5">
            <div className="text-xs font-medium text-gray-600 mb-1">Rendered page 1 preview</div>
            <div className="rounded-lg border border-gray-200 bg-white p-2 overflow-auto">
              <canvas ref={canvasRef} className="max-w-full h-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
