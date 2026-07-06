import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { findProgramByBrandSlug, joinCreatorProgram } from "@/lib/creator-affiliate.functions";
import { toast } from "sonner";
import { Copy, Sparkles } from "lucide-react";

export const Route = createFileRoute("/a/$brandSlug")({
  component: JoinPage,
  head: ({ params }) => ({
    meta: [
      { title: `Become an affiliate | AurumVault` },
      {
        name: "description",
        content: `Join ${params.brandSlug}'s affiliate program on AurumVault and earn commission on every sale you refer.`,
      },
    ],
  }),
});

type ProgramInfo = {
  creator: {
    id: string;
    brand_name: string | null;
    brand_slug: string | null;
    cover_url: string | null;
    extended_bio: string | null;
  };
  program: { commission_rate_pct: number; terms: string | null };
};

function JoinPage() {
  const { brandSlug } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<
    { kind: "loading" } | { kind: "err"; msg: string } | { kind: "ok"; data: ProgramInfo }
  >({ kind: "loading" });
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const findFn = useServerFn(findProgramByBrandSlug);
  const joinFn = useServerFn(joinCreatorProgram);

  useEffect(() => {
    findFn({ data: { brandSlug } })
      .then((res: any) => {
        if (res?.error) setState({ kind: "err", msg: res.error });
        else setState({ kind: "ok", data: res });
      })
      .catch((e: any) => setState({ kind: "err", msg: e?.message ?? "Failed to load" }));
  }, [brandSlug, findFn]);

  async function handleJoin() {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: `/a/${brandSlug}` } as any });
      return;
    }
    if (state.kind !== "ok") return;
    setJoining(true);
    try {
      const res = await joinFn({ data: { creatorId: state.data.creator.id } });
      setCode(res.code);
      toast.success(res.already ? "You're already an affiliate" : "You're in! Share your link.");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to join");
    } finally {
      setJoining(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 to-white">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Link to="/" className="text-sm text-navy/70 hover:text-navy">
          ← AurumVault
        </Link>

        {state.kind === "loading" && (
          <div className="mt-16 text-slate-500 text-center">Loading…</div>
        )}

        {state.kind === "err" && (
          <div className="mt-16 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-8 text-center">
            <h1 className="font-serif text-2xl text-navy">Program not available</h1>
            <p className="text-slate-600 mt-2 text-sm">{state.msg}</p>
            <Link to="/" className="inline-block mt-6 text-emerald-700 hover:underline">
              Return home
            </Link>
          </div>
        )}

        {state.kind === "ok" && (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
              {state.data.creator.cover_url && (
                <img
                  src={state.data.creator.cover_url}
                  alt=""
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-6 md:p-8 space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 text-sm uppercase tracking-wide">
                  <Sparkles className="w-4 h-4" />
                  Affiliate program
                </div>
                <h1 className="font-serif text-3xl text-navy">
                  Promote {state.data.creator.brand_name}
                </h1>
                <p className="text-3xl font-semibold text-emerald-700">
                  Earn {state.data.program.commission_rate_pct}% per sale
                </p>
                {state.data.creator.extended_bio && (
                  <p className="text-sm text-slate-600 whitespace-pre-line">
                    {state.data.creator.extended_bio.slice(0, 400)}
                  </p>
                )}
                {state.data.program.terms && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Terms</div>
                    <p className="text-sm text-slate-700 whitespace-pre-line">
                      {state.data.program.terms}
                    </p>
                  </div>
                )}

                {!code && (
                  <button
                    onClick={handleJoin}
                    disabled={joining || authLoading}
                    className="w-full rounded-md bg-emerald-700 text-white py-3 font-medium hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {authLoading
                      ? "…"
                      : !user
                        ? "Sign in to become an affiliate"
                        : joining
                          ? "Joining…"
                          : "Become an affiliate"}
                  </button>
                )}

                {code && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 space-y-3">
                    <div className="text-sm text-emerald-800 font-medium">
                      You're an affiliate! Share this link:
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={`${typeof window !== "undefined" ? window.location.origin : ""}/creator/${state.data.creator.brand_slug ?? state.data.creator.id}?ref=${code}`}
                        className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-mono bg-white"
                      />
                      <button
                        onClick={() =>
                          copy(
                            `${window.location.origin}/creator/${state.data.creator.brand_slug ?? state.data.creator.id}?ref=${code}`,
                          )
                        }
                        className="p-2 rounded-md bg-navy text-white"
                        aria-label="Copy"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <Link
                      to="/dashboard/affiliate"
                      className="inline-block text-sm text-emerald-700 hover:underline"
                    >
                      Go to your affiliate dashboard →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
