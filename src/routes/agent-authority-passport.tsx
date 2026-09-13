import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  Eye,
  FileCheck2,
  Fingerprint,
  Gauge,
  KeyRound,
  LockKeyhole,
  Network,
  ScanSearch,
  ShieldCheck,
  Siren,
  UserCheck,
} from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";

const CANONICAL = "https://www.aurumvault.store/agent-authority-passport";
const TITLE = "AI Agent Authority Passport | AurumVault";
const DESCRIPTION =
  "Govern AI employees with enforceable authority, human approvals, risk controls, execution receipts, and an audit-ready evidence trail.";

export const Route = createFileRoute("/agent-authority-passport")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "AurumVault AI Agent Authority Passport",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: DESCRIPTION,
          url: CANONICAL,
          publisher: {
            "@type": "Organization",
            name: "AurumVault",
            url: "https://www.aurumvault.store/",
          },
        }),
      },
    ],
  }),
  component: AgentAuthorityPassportPage,
});

const governanceChain = [
  "Identity",
  "Authority",
  "Decision",
  "Approval",
  "Execution",
  "Evidence",
  "Review",
];

const capabilities = [
  {
    icon: Fingerprint,
    title: "Authority Passports",
    copy: "Give every AI worker a durable identity, purpose, owner, policy version, expiry, and explicit operating boundaries.",
  },
  {
    icon: UserCheck,
    title: "Human Approval Center",
    copy: "Route sensitive actions to authorized reviewers and preserve the exact decision that allowed or denied execution.",
  },
  {
    icon: Gauge,
    title: "Explainable Risk",
    copy: "Surface risk from authority, data sensitivity, financial exposure, policy exceptions, and unresolved governance issues.",
  },
  {
    icon: Eye,
    title: "Shadow Mode",
    copy: "Evaluate what an agent would have been allowed to do without granting real execution authority.",
  },
  {
    icon: Siren,
    title: "Incident Response",
    copy: "Suspend authority, contain agent activity, document incidents, and preserve evidence for review and remediation.",
  },
  {
    icon: FileCheck2,
    title: "Execution Receipts",
    copy: "Create a defensible record of the policy, approval, request, execution result, and evidence behind governed actions.",
  },
];

const controlExamples = [
  ["Read an approved invoice", "ALLOW", "Routine work within the agent's active Passport."],
  ["Send a customer-facing financial message", "APPROVAL_REQUIRED", "A human reviewer must authorize the action first."],
  ["Issue a refund above the authorized limit", "BLOCK", "The request exceeds the agent's approved authority."],
] as const;

function AgentAuthorityPassportPage() {
  return (
    <MarketShell>
      <div className="bg-[#070A10] text-white">
        <Hero />
        <GovernanceChain />
        <ProblemSection />
        <DecisionGate />
        <Capabilities />
        <EvidenceSection />
        <IntegrationSection />
        <RoleSection />
        <FinalCta />
      </div>
    </MarketShell>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/10">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 78% 20%, rgba(184,134,11,0.16), transparent 30%), linear-gradient(135deg, #05070C 0%, #0B1424 62%, #171208 100%)",
        }}
      />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-caps text-gold">
            <ShieldCheck size={13} aria-hidden /> AurumVault Live Software
          </div>
          <h1 className="mt-6 max-w-4xl font-display text-4xl font-bold leading-[1.05] text-white sm:text-5xl lg:text-6xl">
            Govern every AI employee with <span className="text-gold">enforceable authority.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            Know what every AI agent is allowed to do, who approved it, and what it actually did — without building an enterprise security team first.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/agent-authority"
              data-testid="agent-authority-open-app"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-[12px] font-bold uppercase tracking-caps text-navy transition hover:brightness-105"
            >
              Open Secure Workspace <ArrowRight size={15} aria-hidden />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 text-[12px] font-bold uppercase tracking-caps text-white transition hover:border-gold/60 hover:text-gold"
            >
              See How It Works
            </a>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-white/55">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} className="text-gold" aria-hidden /> Human authority stays in control</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} className="text-gold" aria-hidden /> Policy-versioned decisions</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} className="text-gold" aria-hidden /> Evidence-first governance</span>
          </div>
        </div>

        <div className="rounded-3xl border border-gold/25 bg-white/[0.035] p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-7">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">Authority Passport</div>
              <div className="mt-1 font-display text-xl font-bold text-white">Finance Operations Agent</div>
            </div>
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">Authorized</span>
          </div>
          <dl className="mt-5 space-y-4 text-sm">
            <PassportRow label="Business purpose" value="Invoice and receivables support" />
            <PassportRow label="Authority band" value="Controlled" />
            <PassportRow label="Sensitive actions" value="Human approval required" />
            <PassportRow label="Financial limits" value="Enforced before execution" />
            <PassportRow label="Policy version" value="Pinned to every decision" />
          </dl>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-caps text-white/55">
              <ScanSearch size={14} className="text-gold" aria-hidden /> Last governed request
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="text-sm text-white/80">Send payment reminder</span>
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold text-amber-200">APPROVAL REQUIRED</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PassportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0">
      <dt className="text-white/45">{label}</dt>
      <dd className="text-right font-medium text-white/85">{value}</dd>
    </div>
  );
}

function GovernanceChain() {
  return (
    <section id="how-it-works" className="border-b border-white/10 bg-[#0B0F18]">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="text-center text-[10px] font-bold uppercase tracking-[0.24em] text-gold">The governance chain</div>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {governanceChain.map((item, index) => (
            <div key={item} className="relative rounded-xl border border-white/10 bg-white/[0.025] px-3 py-4 text-center">
              <div className="text-[10px] text-white/35">0{index + 1}</div>
              <div className="mt-1 text-[12px] font-bold uppercase tracking-wider text-white/80">{item}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="border-b border-white/10 bg-[#070A10]">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-6 md:py-20 lg:grid-cols-2 lg:px-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">The control gap</div>
          <h2 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">AI can act faster than most businesses can govern it.</h2>
        </div>
        <div className="space-y-4 text-[15px] leading-relaxed text-white/70">
          <p>AI agents can draft communications, access files, update systems, trigger workflows, and make decisions across the business. Traditional access controls rarely explain whether a specific AI action was actually authorized at that moment.</p>
          <p>AurumVault AI Agent Authority Passport adds the missing governance layer: explicit authority, human approval boundaries, policy-versioned decisions, execution evidence, and review.</p>
        </div>
      </div>
    </section>
  );
}

function DecisionGate() {
  return (
    <section className="border-b border-white/10 bg-[#0A0D17]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="max-w-3xl">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">Deterministic Action Gate</div>
          <h2 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">Every governed request resolves to one of three outcomes.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">The decision layer is designed to fail closed. Agents do not get to invent their own authority or bypass required approval.</p>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {controlExamples.map(([title, outcome, copy]) => (
            <div key={outcome} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-white/85">{title}</span>
                {outcome === "ALLOW" ? <BadgeCheck size={19} className="shrink-0 text-emerald-300" aria-hidden /> : outcome === "BLOCK" ? <Ban size={19} className="shrink-0 text-red-300" aria-hidden /> : <UserCheck size={19} className="shrink-0 text-amber-200" aria-hidden />}
              </div>
              <div className="mt-5 text-[11px] font-bold tracking-[0.14em] text-gold">{outcome}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-white/55">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Capabilities() {
  return (
    <section className="border-b border-white/10 bg-[#070A10]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="max-w-3xl">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">Governance workspace</div>
          <h2 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">Built for operational control, not policy theater.</h2>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map(({ icon: Icon, title, copy }) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:border-gold/35">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold"><Icon size={19} aria-hidden /></div>
              <h3 className="mt-4 font-display text-lg font-bold text-white">{title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-white/60">{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function EvidenceSection() {
  return (
    <section className="border-b border-white/10 bg-[#0B0F18]">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-6 md:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
        <div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 text-gold"><FileCheck2 size={23} aria-hidden /></div>
          <h2 className="mt-5 font-display text-3xl font-bold text-white md:text-4xl">Prove what happened after the AI acted.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">Execution Receipts connect the request, applicable Passport and policy version, approval context, execution result, and evidence references into a reviewable record.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {["Agent identity", "Passport version", "Action request", "Decision outcome", "Human approval", "Execution status", "Evidence references", "Timestamped audit trail"].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3 text-[13px] text-white/70">
                <CheckCircle2 size={14} className="shrink-0 text-gold" aria-hidden /> {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function IntegrationSection() {
  const integrations = ["Gmail", "Google Drive", "Slack", "HubSpot", "QuickBooks", "Stripe", "n8n", "Make", "Zapier"];
  return (
    <section className="border-b border-white/10 bg-[#070A10]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">Integration architecture</div>
            <h2 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">Govern the tools your AI workers use.</h2>
          </div>
          <p className="text-[14px] leading-relaxed text-white/60">The platform is being hardened for governed integration with common business systems. Provider execution remains controlled by staging certification and explicit enablement rather than being silently switched on.</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          {integrations.map((name) => (
            <span key={name} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[12px] font-medium text-white/65">{name}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function RoleSection() {
  return (
    <section className="border-b border-white/10 bg-[#0A0D17]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">Business-ready governance</div>
            <h2 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">Clear responsibilities for the people supervising AI.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/65">Workspace roles separate administration, approvals, audit review, and ordinary membership so governance does not depend on everyone having the same authority.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {["OWNER", "ADMIN", "APPROVER", "AUDITOR", "MEMBER"].map((role) => (
              <div key={role} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-4">
                <LockKeyhole size={16} className="text-gold" aria-hidden />
                <span className="text-[12px] font-bold tracking-wider text-white/75">{role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[#070A10]">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(184,134,11,0.15),transparent_45%)]" />
      <div className="relative mx-auto max-w-4xl px-5 py-20 text-center sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 text-gold"><Network size={23} aria-hidden /></div>
        <h2 className="mt-5 font-display text-3xl font-bold text-white md:text-4xl">Put human authority around AI execution.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/65">AurumVault AI Agent Authority Passport is the dedicated governance software layer for registering AI workers, enforcing authority, reviewing sensitive actions, and preserving defensible evidence.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/agent-authority"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-[12px] font-bold uppercase tracking-caps text-navy transition hover:brightness-105"
          >
            Enter Agent Authority <ArrowRight size={15} aria-hidden />
          </Link>
          <Link
            to="/business-systems"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 text-[12px] font-bold uppercase tracking-caps text-white transition hover:border-gold/60 hover:text-gold"
          >
            <Building2 size={14} aria-hidden /> AurumVault Business Systems
          </Link>
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-white/40">
          <KeyRound size={12} aria-hidden /> Secure workspace access requires an authenticated AurumVault account.
        </div>
      </div>
    </section>
  );
}
