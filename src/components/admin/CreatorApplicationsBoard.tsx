import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendTransactionalEmail } from "@/lib/email/send";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  MessageSquare,
  ExternalLink,
  Globe,
  DollarSign,
  Package,
  X,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

type AppStatus = "pending" | "under_review" | "info_requested" | "approved" | "rejected";

type App = {
  id: string;
  user_id: string;
  brand_name: string;
  brand_slug: string | null;
  pitch: string;
  product_types: string | null;
  categories: string[] | null;
  price_range: string | null;
  website: string | null;
  country: string | null;
  social_links: Record<string, string> | null;
  status: AppStatus;
  admin_notes: string | null;
  admin_feedback: string | null;
  reapply_after: string | null;
  created_at: string;
  reviewed_at: string | null;
  applicant_email: string | null;
};

type Profile = { id: string; display_name: string | null; avatar_url: string | null };

type CreatorRow = {
  app: App;
  profile: Profile | null;
  productCount: number;
  pendingCents: number;
  paidCents: number;
};

const COLUMNS: { key: AppStatus; label: string; tone: string }[] = [
  { key: "pending", label: "Pending", tone: "bg-slate-100 text-slate-700" },
  { key: "under_review", label: "Under review", tone: "bg-blue-100 text-blue-700" },
  { key: "info_requested", label: "Info requested", tone: "bg-amber-100 text-amber-700" },
  { key: "approved", label: "Approved", tone: "bg-emerald-100 text-emerald-700" },
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function CreatorApplicationsBoard() {
  const [apps, setApps] = useState<App[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [creators, setCreators] = useState<CreatorRow[]>([]);
  const [openApp, setOpenApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const { data: appData } = await supabase
      .from("seller_applications")
      .select("*")
      .order("created_at", { ascending: false });
    const all = (appData ?? []) as unknown as App[];
    setApps(all);

    const userIds = Array.from(new Set(all.map((a) => a.user_id)));
    if (userIds.length) {
      const { data: profData } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);
      const map: Record<string, Profile> = {};
      (profData ?? []).forEach((p) => (map[p.id] = p as Profile));
      setProfiles(map);
    }

    // Build creator management rows for approved applications
    const approved = all.filter((a) => a.status === "approved");
    if (approved.length) {
      const sellerIds = approved.map((a) => a.user_id);
      const [{ data: prodRows }, { data: balRows }] = await Promise.all([
        supabase
          .from("marketplace_products")
          .select("seller_id, status")
          .in("seller_id", sellerIds),
        supabase
          .from("seller_balances")
          .select("seller_id, pending_cents, paid_cents")
          .in("seller_id", sellerIds),
      ]);
      const prodCounts: Record<string, number> = {};
      (prodRows ?? []).forEach((r: { seller_id: string; status: string }) => {
        if (r.status === "approved") prodCounts[r.seller_id] = (prodCounts[r.seller_id] ?? 0) + 1;
      });
      const balances: Record<string, { pending_cents: number; paid_cents: number }> = {};
      (balRows ?? []).forEach((r: { seller_id: string; pending_cents: number; paid_cents: number }) => {
        balances[r.seller_id] = { pending_cents: r.pending_cents, paid_cents: r.paid_cents };
      });
      setCreators(
        approved.map((a) => ({
          app: a,
          profile: null,
          productCount: prodCounts[a.user_id] ?? 0,
          pendingCents: balances[a.user_id]?.pending_cents ?? 0,
          paidCents: balances[a.user_id]?.paid_cents ?? 0,
        })),
      );
    } else {
      setCreators([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function ensureBrandSlug(a: App): Promise<string> {
    if (a.brand_slug) return a.brand_slug;
    const base = slugify(a.brand_name) || `creator-${a.id.slice(0, 6)}`;
    // Try base, then base-2, base-3...
    for (let i = 0; i < 12; i++) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      const { data } = await supabase
        .from("seller_applications")
        .select("id")
        .eq("brand_slug", candidate)
        .maybeSingle();
      if (!data) return candidate;
    }
    return `${base}-${a.id.slice(0, 6)}`;
  }

  async function setStatus(a: App, next: AppStatus, extra?: Partial<App>) {
    const patch = {
      status: next,
      reviewed_at: new Date().toISOString(),
      ...extra,
    } as never;
    const { error } = await supabase.from("seller_applications").update(patch).eq("id", a.id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    return true;
  }

  async function moveToUnderReview(a: App) {
    if (await setStatus(a, "under_review")) {
      toast.success(`${a.brand_name} moved to Under review`);
      refresh();
    }
  }

  async function requestInfo(a: App) {
    const message = window.prompt(
      "What information do you need from the applicant?",
      "Could you share 2–3 sample products or a link to your existing store?",
    );
    if (!message) return;
    if (await setStatus(a, "info_requested", { admin_feedback: message })) {
      toast.success("Info request sent");
      if (a.applicant_email) {
        sendTransactionalEmail({
          templateName: "seller-application-info-requested",
          recipientEmail: a.applicant_email,
          idempotencyKey: `seller-app-info-${a.id}-${Date.now()}`,
          templateData: { brandName: a.brand_name, message },
        }).catch((err) => console.error(err));
      }
      setOpenApp(null);
      refresh();
    }
  }

  async function approve(a: App) {
    const brandSlug = await ensureBrandSlug(a);
    const ok = await setStatus(a, "approved", { brand_slug: brandSlug });
    if (!ok) return;
    const { error: e2 } = await supabase
      .from("user_roles")
      .insert({ user_id: a.user_id, role: "seller" });
    if (e2 && !e2.message.includes("duplicate")) {
      toast.error(e2.message);
      return;
    }
    await supabase.from("profiles").update({ is_seller: true }).eq("id", a.user_id);

    toast.success(`${a.brand_name} approved · storefront /store/${brandSlug}`);
    if (a.applicant_email) {
      sendTransactionalEmail({
        templateName: "seller-application-approved",
        recipientEmail: a.applicant_email,
        idempotencyKey: `seller-app-approved-${a.id}`,
        templateData: {
          brandName: a.brand_name,
          storefrontUrl: `https://aurumvault.store/store/${brandSlug}`,
        },
      }).catch((err) => console.error(err));
    }
    setOpenApp(null);
    refresh();
  }

  async function reject(a: App) {
    const reason = window.prompt(
      "Reason for rejection (visible to applicant):",
      "Thanks for applying — we'd like to see more detail about the products you plan to sell.",
    );
    if (reason === null) return;
    const invite = window.confirm("Invite applicant to reapply in 30 days?");
    const reapplyAfter = invite
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : null;
    if (
      await setStatus(a, "rejected", {
        admin_feedback: reason,
        reapply_after: reapplyAfter,
      })
    ) {
      toast.success("Application rejected");
      if (a.applicant_email) {
        sendTransactionalEmail({
          templateName: "seller-application-rejected",
          recipientEmail: a.applicant_email,
          idempotencyKey: `seller-app-rejected-${a.id}`,
          templateData: {
            brandName: a.brand_name,
            reason: reason || undefined,
            reapplyAfter: reapplyAfter
              ? new Date(reapplyAfter).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : undefined,
          },
        }).catch((err) => console.error(err));
      }
      setOpenApp(null);
      refresh();
    }
  }

  const byStatus = useMemo(() => {
    const m: Record<AppStatus, App[]> = {
      pending: [],
      under_review: [],
      info_requested: [],
      approved: [],
      rejected: [],
    };
    apps.forEach((a) => m[a.status]?.push(a));
    return m;
  }, [apps]);

  if (loading) return <p className="text-sm text-mute">Loading applications…</p>;

  return (
    <div className="space-y-8">
      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.key} className="bg-paper/60 border border-ink/10 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-3">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${col.tone}`}>
                {col.label}
              </span>
              <span className="text-xs text-mute">{byStatus[col.key].length}</span>
            </div>
            <div className="space-y-2 min-h-[80px]">
              {byStatus[col.key].length === 0 ? (
                <p className="text-xs text-mute px-2 py-4 text-center">None</p>
              ) : (
                byStatus[col.key].map((a) => {
                  const p = profiles[a.user_id];
                  return (
                    <button
                      key={a.id}
                      onClick={() => setOpenApp(a)}
                      className="w-full text-left bg-white border border-ink/10 rounded-xl p-3 hover:shadow-md hover:border-gold/40 transition"
                    >
                      <div className="flex items-start gap-2">
                        {p?.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy to-[#22335A] shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-navy text-sm truncate">{a.brand_name}</p>
                          <p className="text-[11px] text-mute truncate">{p?.display_name ?? a.applicant_email ?? "—"}</p>
                        </div>
                      </div>
                      {a.categories?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {a.categories.slice(0, 3).map((c) => (
                            <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-navy/5 text-navy">
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between text-[11px] text-mute">
                        <span>{new Date(a.created_at).toLocaleDateString()}</span>
                        <span className="inline-flex items-center gap-1 text-navy">
                          <Eye size={11} /> View
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Rejected collapsible */}
      {byStatus.rejected.length > 0 && (
        <details className="bg-white border border-ink/10 rounded-2xl p-4">
          <summary className="cursor-pointer text-sm text-navy font-medium">
            Rejected ({byStatus.rejected.length})
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {byStatus.rejected.map((a) => (
              <button
                key={a.id}
                onClick={() => setOpenApp(a)}
                className="text-left bg-paper/60 border border-ink/10 rounded-lg p-2.5 hover:border-red-300"
              >
                <p className="font-medium text-navy text-sm">{a.brand_name}</p>
                <p className="text-[11px] text-mute">
                  Rejected {a.reviewed_at ? new Date(a.reviewed_at).toLocaleDateString() : ""}
                  {a.reapply_after ? ` · reapply ${a.reapply_after}` : ""}
                </p>
              </button>
            ))}
          </div>
        </details>
      )}

      {/* Creator management table */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl text-navy">Approved creators</h2>
          <span className="text-xs text-mute">{creators.length} total</span>
        </div>
        {creators.length === 0 ? (
          <p className="text-sm text-mute">No approved creators yet.</p>
        ) : (
          <div className="bg-white border border-ink/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-paper/60 text-mute text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Creator</th>
                  <th className="text-left px-4 py-2 font-medium">Storefront</th>
                  <th className="text-right px-4 py-2 font-medium">Products</th>
                  <th className="text-right px-4 py-2 font-medium">Pending</th>
                  <th className="text-right px-4 py-2 font-medium">Paid out</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {creators.map((c) => (
                  <tr key={c.app.id} className="hover:bg-paper/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-navy">{c.app.brand_name}</div>
                      <div className="text-[11px] text-mute">{c.app.applicant_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {c.app.brand_slug ? (
                        <Link
                          to="/store/$slug"
                          params={{ slug: c.app.brand_slug }}
                          className="inline-flex items-center gap-1 text-navy hover:text-gold-ink text-xs"
                        >
                          /store/{c.app.brand_slug} <ExternalLink size={11} />
                        </Link>
                      ) : (
                        <span className="text-xs text-mute">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="inline-flex items-center gap-1 text-navy">
                        <Package size={12} /> {c.productCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-navy">
                      ${(c.pendingCents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-navy">
                      ${(c.paidCents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setOpenApp(c.app)}
                        className="text-xs text-navy hover:text-gold-ink underline underline-offset-2"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal */}
      {openApp && (
        <ApplicationModal
          app={openApp}
          profile={profiles[openApp.user_id] ?? null}
          onClose={() => setOpenApp(null)}
          onMoveToReview={() => moveToUnderReview(openApp)}
          onRequestInfo={() => requestInfo(openApp)}
          onApprove={() => approve(openApp)}
          onReject={() => reject(openApp)}
        />
      )}
    </div>
  );
}

function ApplicationModal({
  app,
  profile,
  onClose,
  onMoveToReview,
  onRequestInfo,
  onApprove,
  onReject,
}: {
  app: App;
  profile: Profile | null;
  onClose: () => void;
  onMoveToReview: () => void;
  onRequestInfo: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const canApprove = app.status !== "approved";
  const canReject = app.status !== "rejected";
  const canReview = app.status === "pending";
  const canInfo = app.status !== "info_requested" && app.status !== "approved" && app.status !== "rejected";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-ink/10 px-6 py-4 flex items-center gap-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy to-[#22335A]" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg text-navy truncate">{app.brand_name}</p>
            <p className="text-xs text-mute truncate">
              {profile?.display_name ?? app.applicant_email ?? "—"}
              {app.country ? ` · ${app.country}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-paper" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <Field label="Status">
            <span className="inline-flex items-center gap-1 text-xs rounded-full bg-navy/5 text-navy px-2.5 py-1 capitalize">
              {app.status.replace("_", " ")}
            </span>
            <span className="ml-2 text-xs text-mute">
              Submitted {new Date(app.created_at).toLocaleDateString()}
            </span>
          </Field>

          {app.categories?.length ? (
            <Field label="Categories">
              <div className="flex flex-wrap gap-1.5">
                {app.categories.map((c) => (
                  <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-navy/5 text-navy">
                    {c}
                  </span>
                ))}
              </div>
            </Field>
          ) : null}

          {app.product_types && <Field label="Product types">{app.product_types}</Field>}
          {app.price_range && <Field label="Price range">{app.price_range}</Field>}

          <Field label="Pitch">
            <p className="text-sm text-ink/85 whitespace-pre-wrap">{app.pitch}</p>
          </Field>

          {app.website && (
            <Field label="Website">
              <a
                href={app.website}
                target="_blank"
                rel="noreferrer"
                className="text-navy hover:text-gold-ink inline-flex items-center gap-1 text-sm"
              >
                <Globe size={13} /> {app.website}
              </a>
            </Field>
          )}

          {app.social_links && Object.keys(app.social_links).length > 0 && (
            <Field label="Social links">
              <ul className="space-y-1 text-sm">
                {Object.entries(app.social_links).map(([k, v]) =>
                  v ? (
                    <li key={k}>
                      <span className="text-mute capitalize mr-2">{k}:</span>
                      <a href={v} target="_blank" rel="noreferrer" className="text-navy hover:text-gold-ink">
                        {v}
                      </a>
                    </li>
                  ) : null,
                )}
              </ul>
            </Field>
          )}

          {app.admin_feedback && (
            <Field label="Previous feedback sent">
              <div className="text-sm bg-paper/60 border border-ink/10 rounded-lg p-3 text-ink/85 whitespace-pre-wrap">
                {app.admin_feedback}
              </div>
            </Field>
          )}

          {app.status === "approved" && app.brand_slug && (
            <Field label="Storefront">
              <Link
                to="/store/$slug"
                params={{ slug: app.brand_slug }}
                className="text-navy hover:text-gold-ink inline-flex items-center gap-1 text-sm"
              >
                <ExternalLink size={13} /> /store/{app.brand_slug}
              </Link>
            </Field>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-ink/10 px-6 py-3 flex flex-wrap items-center gap-2 justify-end">
          {canReview && (
            <button
              onClick={onMoveToReview}
              className="inline-flex items-center gap-1 text-sm rounded-full border border-navy/20 text-navy px-3 py-1.5 hover:bg-navy/5"
            >
              <Clock size={14} /> Under review
            </button>
          )}
          {canInfo && (
            <button
              onClick={onRequestInfo}
              className="inline-flex items-center gap-1 text-sm rounded-full bg-amber-500 text-white px-3 py-1.5 hover:bg-amber-600"
            >
              <MessageSquare size={14} /> Request info
            </button>
          )}
          {canReject && (
            <button
              onClick={onReject}
              className="inline-flex items-center gap-1 text-sm rounded-full bg-red-600 text-white px-3 py-1.5 hover:bg-red-700"
            >
              <XCircle size={14} /> Reject
            </button>
          )}
          {canApprove && (
            <button
              onClick={onApprove}
              className="inline-flex items-center gap-1 text-sm rounded-full bg-emerald-600 text-white px-3 py-1.5 hover:bg-emerald-700"
            >
              <CheckCircle2 size={14} /> Approve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-mute uppercase tracking-wider mb-1.5">{label}</p>
      <div>{children}</div>
    </div>
  );
}
