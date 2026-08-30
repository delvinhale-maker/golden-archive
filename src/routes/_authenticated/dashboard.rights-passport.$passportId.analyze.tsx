import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { supabase } from "@/integrations/supabase/client";
import { getPassport } from "@/lib/rights-passport.functions";
import {
  beginDocumentUpload,
  registerDocument,
  listDocuments,
} from "@/lib/rights-passport-documents.functions";
import {
  parseDocument,
  createAnalysisRun,
  runAnalysisPass,
  listAnalysisRuns,
  listFindings,
  reviewFinding,
} from "@/lib/rights-passport-analysis.functions";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  ALLOWED_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  type DocumentStatus,
  type DocumentType,
} from "@/lib/rights-passport-documents.schema";
import {
  ANALYSIS_PASS_TYPES,
  PASS_LABELS,
  AI_ANALYSIS_DISCLAIMER,
  HIGH_IMPACT_REVIEW_NOTE,
  type AnalysisPassType,
} from "@/lib/rights-passport-analysis-schema";
import { RIGHTS_PASSPORT_DISCLAIMER } from "@/lib/rights-passport.schema";

export const Route = createFileRoute(
  "/_authenticated/dashboard/rights-passport/$passportId/analyze",
)({
  component: AnalyzePage,
});

const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  UPLOADED: "Uploaded",
  PARSING: "Parsing…",
  PARSED: "Parsed",
  ANALYZING: "Analyzing…",
  REVIEW_REQUIRED: "Review required",
  READY_FOR_REVIEW: "Ready for review",
  ACCEPTED: "Accepted",
  PARTIALLY_ACCEPTED: "Partially accepted",
  REJECTED: "Rejected",
  FAILED: "Failed",
};

const DOCUMENT_STATUS_TONE: Record<DocumentStatus, string> = {
  UPLOADED: "bg-ink/5 text-mute border-ink/10",
  PARSING: "bg-sky-50 text-sky-700 border-sky-200",
  PARSED: "bg-sky-50 text-sky-700 border-sky-200",
  ANALYZING: "bg-sky-50 text-sky-700 border-sky-200",
  REVIEW_REQUIRED: "bg-amber-50 text-amber-700 border-amber-200",
  READY_FOR_REVIEW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PARTIALLY_ACCEPTED: "bg-amber-50 text-amber-700 border-amber-200",
  REJECTED: "bg-ink/5 text-mute border-ink/10",
  FAILED: "bg-red-50 text-red-700 border-red-200",
};

const PASS_STATUS_ICON: Record<string, typeof Clock> = {
  PENDING: Clock,
  RUNNING: RotateCw,
  COMPLETE: CheckCircle2,
  FAILED: XCircle,
};

function confidenceBand(c: number): "HIGH" | "MODERATE" | "LOW" {
  if (c >= 0.9) return "HIGH";
  if (c >= 0.7) return "MODERATE";
  return "LOW";
}

const CONFIDENCE_TONE: Record<string, string> = {
  HIGH: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MODERATE: "bg-amber-50 text-amber-700 border-amber-200",
  LOW: "bg-ink/5 text-mute border-ink/10",
};

function humanizeField(field: string): string {
  return field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function AnalyzePage() {
  const { passportId } = Route.useParams();
  const queryClient = useQueryClient();
  const getPassportFn = useServerFn(getPassport);
  const beginUploadFn = useServerFn(beginDocumentUpload);
  const registerDocFn = useServerFn(registerDocument);
  const parseDocFn = useServerFn(parseDocument);
  const listDocsFn = useServerFn(listDocuments);
  const createRunFn = useServerFn(createAnalysisRun);
  const runPassFn = useServerFn(runAnalysisPass);
  const listRunsFn = useServerFn(listAnalysisRuns);
  const listFindingsFn = useServerFn(listFindings);
  const reviewFn = useServerFn(reviewFinding);

  const [passportKey, setPassportKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingType, setPendingType] = useState<DocumentType>("OTHER");
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [analyzingDoc, setAnalyzingDoc] = useState<string | null>(null);
  const [passProgress, setPassProgress] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPassportFn({ data: { id: passportId } })
      .then((p) => setPassportKey(p.passport_key))
      .catch(() => setPassportKey(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportId]);

  const docsQueryKey = ["rights-passport", "documents", passportKey];
  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: docsQueryKey,
    queryFn: () => listDocsFn({ data: { passportKey: passportKey! } }),
    enabled: !!passportKey,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((d) => d.status === "PARSING" || d.status === "ANALYZING")
        ? 2500
        : false,
  });

  const runsQueryKey = ["rights-passport", "analysis-runs", expandedDoc];
  const { data: runs } = useQuery({
    queryKey: runsQueryKey,
    queryFn: () => listRunsFn({ data: { documentId: expandedDoc! } }),
    enabled: !!expandedDoc,
  });
  const latestRun = runs?.[0] ?? null;

  const findingsQueryKey = ["rights-passport", "findings", expandedDoc];
  const { data: findings } = useQuery({
    queryKey: findingsQueryKey,
    queryFn: () => listFindingsFn({ data: { documentId: expandedDoc! } }),
    enabled: !!expandedDoc,
  });

  async function handleFileChosen(file: File) {
    if (!passportKey) return;
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Unsupported file type. Upload a PDF, DOCX, or TXT file.");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error(`File must be under ${Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)} MB.`);
      return;
    }

    setUploading(true);
    try {
      const begin = await beginUploadFn({
        data: {
          passportKey,
          originalFileName: file.name,
          mimeType: file.type as any,
          fileSizeBytes: file.size,
        },
      });

      const up = await supabase.storage
        .from(begin.bucket)
        .upload(begin.storagePath, file, { upsert: false });
      if (up.error) throw up.error;

      await registerDocFn({
        data: {
          passportKey,
          documentId: begin.documentId,
          fileName: begin.storagePath.split("/").pop() ?? file.name,
          originalFileName: file.name,
          mimeType: file.type as any,
          fileSizeBytes: file.size,
          storagePath: begin.storagePath,
          documentType: pendingType,
        },
      });

      toast.success("Document uploaded. Parsing…");
      queryClient.invalidateQueries({ queryKey: docsQueryKey });

      await parseDocFn({ data: { documentId: begin.documentId } });
      queryClient.invalidateQueries({ queryKey: docsQueryKey });
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAnalyze(documentId: string) {
    setAnalyzingDoc(documentId);
    setPassProgress({});
    try {
      const run = await createRunFn({ data: { documentId } });
      for (const passType of ANALYSIS_PASS_TYPES) {
        setPassProgress((prev) => ({ ...prev, [passType]: "RUNNING" }));
        try {
          const result = await runPassFn({ data: { runId: run.id, passType } });
          setPassProgress((prev) => ({ ...prev, [passType]: result.ok ? "COMPLETE" : "FAILED" }));
        } catch {
          setPassProgress((prev) => ({ ...prev, [passType]: "FAILED" }));
        }
      }
      setExpandedDoc(documentId);
      queryClient.invalidateQueries({ queryKey: docsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["rights-passport", "analysis-runs", documentId] });
      queryClient.invalidateQueries({ queryKey: ["rights-passport", "findings", documentId] });
      toast.success("Analysis complete. Review the findings below.");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't start analysis");
    } finally {
      setAnalyzingDoc(null);
    }
  }

  async function handleRetryPass(documentId: string, runId: string, passType: AnalysisPassType) {
    setPassProgress((prev) => ({ ...prev, [passType]: "RUNNING" }));
    try {
      const result = await runPassFn({ data: { runId, passType } });
      setPassProgress((prev) => ({ ...prev, [passType]: result.ok ? "COMPLETE" : "FAILED" }));
      queryClient.invalidateQueries({ queryKey: ["rights-passport", "analysis-runs", documentId] });
      queryClient.invalidateQueries({ queryKey: ["rights-passport", "findings", documentId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Retry failed");
    }
  }

  async function handleReview(
    findingId: string,
    action: "ACCEPT" | "REJECT" | "DEFER",
    documentId: string,
  ) {
    try {
      await reviewFn({ data: { findingId, action } });
      queryClient.invalidateQueries({ queryKey: ["rights-passport", "findings", documentId] });
      toast.success(action === "ACCEPT" ? "Applied to your passport" : "Updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't update this finding");
    }
  }

  async function handleEdit(findingId: string, editedValue: string, documentId: string) {
    try {
      await reviewFn({ data: { findingId, action: "EDIT", editedValue } });
      queryClient.invalidateQueries({ queryKey: ["rights-passport", "findings", documentId] });
      toast.success("Correction applied");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save your correction");
    }
  }

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link
        to="/dashboard/rights-passport"
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to Passport Home
      </Link>
      <h1 className="mt-3 font-display text-3xl text-navy">Upload &amp; Analyze</h1>
      <p className="text-sm text-mute mt-1 max-w-2xl">{AI_ANALYSIS_DISCLAIMER}</p>

      <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-5">
        <p className="text-sm font-semibold text-navy">Upload a document</p>
        <p className="text-xs text-mute mt-1">
          PDF, DOCX, or TXT — licensing agreements, releases, endorsements, platform terms, and
          other rights-related documents.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={pendingType}
            onChange={(e) => setPendingType(e.target.value as DocumentType)}
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-navy"
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            disabled={uploading || !passportKey}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileChosen(f);
            }}
            className="hidden"
            id="analyze-file-input"
          />
          <label
            htmlFor="analyze-file-input"
            className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-navy ${
              uploading || !passportKey
                ? "bg-ink/10 cursor-not-allowed"
                : "bg-gold hover:brightness-105 cursor-pointer"
            }`}
          >
            <Upload size={15} /> {uploading ? "Uploading…" : "Choose file"}
          </label>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {docsLoading && <p className="text-sm text-mute">Loading documents…</p>}
        {!docsLoading && (documents ?? []).length === 0 && (
          <div className="rounded-2xl border border-ink/10 bg-white p-8 text-center">
            <FileText className="mx-auto text-mute" size={28} />
            <p className="text-sm text-mute mt-3">No documents uploaded yet.</p>
          </div>
        )}

        {(documents ?? []).map((doc) => {
          const isExpanded = expandedDoc === doc.id;
          const isAnalyzing = analyzingDoc === doc.id;
          return (
            <div key={doc.id} className="rounded-xl border border-ink/10 bg-white overflow-hidden">
              <div className="p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-navy truncate">{doc.original_file_name}</p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${DOCUMENT_STATUS_TONE[doc.status]}`}
                    >
                      {DOCUMENT_STATUS_LABELS[doc.status]}
                    </span>
                  </div>
                  <p className="text-xs text-mute mt-1">
                    {DOCUMENT_TYPE_LABELS[doc.document_type]} ·{" "}
                    {(doc.file_size_bytes / 1024).toFixed(0)} KB
                    {doc.page_count ? ` · ${doc.page_count} pages` : ""}
                  </p>
                  {doc.error_message_safe && (
                    <p className="text-xs text-red-700 mt-1 inline-flex items-center gap-1">
                      <AlertTriangle size={12} /> {doc.error_message_safe}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {doc.parse_status === "PARSED" && (
                    <button
                      type="button"
                      disabled={isAnalyzing}
                      onClick={() => handleAnalyze(doc.id)}
                      className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-navy hover:brightness-105 disabled:opacity-50"
                    >
                      {isAnalyzing ? "Analyzing…" : "Analyze"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                    className="text-mute hover:text-navy"
                  >
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {isAnalyzing && (
                <div className="px-4 pb-3 flex flex-wrap gap-2">
                  {ANALYSIS_PASS_TYPES.map((p) => {
                    const state = passProgress[p] ?? "PENDING";
                    const Icon = PASS_STATUS_ICON[state] ?? Clock;
                    return (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-1 text-[10px] font-semibold text-navy"
                      >
                        <Icon size={11} className={state === "RUNNING" ? "animate-spin" : ""} />{" "}
                        {PASS_LABELS[p]}
                      </span>
                    );
                  })}
                </div>
              )}

              {isExpanded && (
                <div className="border-t border-ink/10 bg-ivory/40 p-4">
                  {latestRun && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {ANALYSIS_PASS_TYPES.map((p) => {
                        const state = (latestRun.pass_status as any)?.[p] ?? "PENDING";
                        const Icon = PASS_STATUS_ICON[state] ?? Clock;
                        return (
                          <span
                            key={p}
                            className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white px-2 py-1 text-[10px] font-semibold text-navy"
                          >
                            <Icon size={11} /> {PASS_LABELS[p]}
                            {state === "FAILED" && (
                              <button
                                type="button"
                                onClick={() => handleRetryPass(doc.id, latestRun.id, p)}
                                className="ml-1 underline"
                              >
                                Retry
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {(findings ?? []).length === 0 && (
                    <p className="text-sm text-mute">
                      No findings yet. Run Analyze to generate a review queue.
                    </p>
                  )}

                  <div className="space-y-3">
                    {(findings ?? []).map((f) => (
                      <FindingCard
                        key={f.id}
                        finding={f}
                        onAccept={() => handleReview(f.id, "ACCEPT", doc.id)}
                        onReject={() => handleReview(f.id, "REJECT", doc.id)}
                        onDefer={() => handleReview(f.id, "DEFER", doc.id)}
                        onEdit={(v) => handleEdit(f.id, v, doc.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-8 max-w-xl text-xs text-mute italic">{RIGHTS_PASSPORT_DISCLAIMER}</p>
    </PublisherShell>
  );
}

function FindingCard({
  finding,
  onAccept,
  onReject,
  onDefer,
  onEdit,
}: {
  finding: any;
  onAccept: () => void;
  onReject: () => void;
  onDefer: () => void;
  onEdit: (value: string) => void;
}) {
  const [showSource, setShowSource] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(
    typeof finding.normalized_value === "string"
      ? finding.normalized_value
      : JSON.stringify(finding.normalized_value ?? ""),
  );
  const band = confidenceBand(finding.confidence);
  const decided = finding.review_status !== "PENDING";

  return (
    <div
      className={`rounded-xl border bg-white p-4 ${finding.review_required ? "border-amber-300" : "border-ink/10"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-navy">{humanizeField(finding.field)}</p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${CONFIDENCE_TONE[band]}`}
            >
              {band}
            </span>
            {finding.review_required && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                <AlertTriangle size={10} /> REVIEW REQUIRED
              </span>
            )}
            {decided && (
              <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-bold text-mute">
                {finding.review_status}
              </span>
            )}
          </div>
          <p className="text-sm text-navy mt-1">
            The document states: <span className="italic">{finding.raw_value ?? "Not stated"}</span>
          </p>
          {finding.review_reason && (
            <p className="text-xs text-mute mt-1">Why review is needed: {finding.review_reason}</p>
          )}
          {finding.review_required && (
            <p className="text-xs text-mute mt-1">{HIGH_IMPACT_REVIEW_NOTE}</p>
          )}

          {finding.source && (
            <button
              type="button"
              onClick={() => setShowSource((s) => !s)}
              className="text-xs text-navy underline mt-2"
            >
              {showSource ? "Hide source" : "Where it appears"}
            </button>
          )}
          {showSource && finding.source && (
            <div className="mt-2 rounded-lg bg-ink/5 p-3 text-xs text-navy">
              <p className="text-mute">
                {finding.source.page ? `Page ${finding.source.page}` : "Location not paginated"}
                {finding.source.section ? ` — ${finding.source.section}` : ""}
              </p>
              <p className="mt-1 italic">&ldquo;{finding.source.quote}&rdquo;</p>
            </div>
          )}

          {finding.suggested_target && (
            <p className="text-xs text-mute mt-2">
              Accepting will update: <strong>{finding.suggested_target.entity}</strong> /{" "}
              {finding.suggested_target.field}
            </p>
          )}
        </div>

        {!decided && (
          <div className="flex shrink-0 flex-col gap-1.5 items-end">
            {editing ? (
              <div className="flex items-center gap-1.5">
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="rounded-lg border border-ink/15 px-2 py-1 text-xs w-32"
                />
                <button
                  type="button"
                  onClick={() => {
                    onEdit(editValue);
                    setEditing(false);
                  }}
                  className="rounded-full bg-gold px-2 py-1 text-[10px] font-bold text-navy"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-1.5">
                <button
                  type="button"
                  onClick={onAccept}
                  className="rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-navy hover:brightness-105"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-navy"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-navy"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={onDefer}
                  className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-mute"
                >
                  Later
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
