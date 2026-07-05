import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  Copy,
  RefreshCw,
  Star,
  Loader2,
  Save,
  CheckCircle2,
  BookOpen,
  GraduationCap,
  FileText,
  Music,
  Video,
  Palette,
  Church,
  Users,
  Package,
  Code,
  Megaphone,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/ai-studio")({
  component: AiStudioPage,
});

const AI_STUDIO_ACCENT = { color: "#B8860B", tint: "rgba(184,134,11,0.10)" };

type ToolField = {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
};

type Tool = {
  id: string;
  name: string;
  description: string;
  fields: ToolField[];
  buildPrompt: (values: Record<string, string>) => string;
};

type Category = {
  id: string;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tools: Tool[];
};

const CATEGORIES: Category[] = [
  {
    id: "ebooks",
    name: "eBooks",
    icon: BookOpen,
    tools: [
      {
        id: "book-titles",
        name: "Book Title Ideas",
        description: "Generate 10 magnetic book title options.",
        fields: [
          { key: "topic", label: "Topic", placeholder: "e.g. financial freedom for young families" },
        ],
        buildPrompt: (v) =>
          `Generate 10 magnetic, sales-driven book title ideas for a book about: ${v.topic}. Include a short subtitle for each. Format as a numbered markdown list.`,
      },
      {
        id: "book-description",
        name: "Full Book Description",
        description: "Sales-ready description for a book page.",
        fields: [
          { key: "title", label: "Book title", placeholder: "The 30-Day Wealth Reset" },
          { key: "chapters", label: "Chapters (comma-separated)", multiline: true },
        ],
        buildPrompt: (v) =>
          `Write a compelling marketplace description for the ebook titled "${v.title}". Chapters: ${v.chapters}. Include a hook, 3–5 outcome bullets, who it's for, and a strong CTA.`,
      },
      {
        id: "chapter-outline",
        name: "Chapter Outline",
        description: "Detailed outline for a single chapter.",
        fields: [
          { key: "title", label: "Book title" },
          { key: "chapter", label: "Chapter title/topic" },
        ],
        buildPrompt: (v) =>
          `Write a detailed chapter outline for the chapter "${v.chapter}" in the book "${v.title}". Include a hook, 5–7 sub-sections with 1–2 sentence summaries, a case study idea, and a chapter takeaway.`,
      },
      {
        id: "book-cover-brief",
        name: "Book Cover Design Brief",
        description: "Brief you can hand to a designer or AI cover tool.",
        fields: [{ key: "topic", label: "Book title & vibe" }],
        buildPrompt: (v) =>
          `Write a book cover design brief for: ${v.topic}. Include mood, color palette, typography direction, imagery ideas, and 3 alternative concepts.`,
      },
    ],
  },
  {
    id: "courses",
    name: "Courses",
    icon: GraduationCap,
    tools: [
      {
        id: "course-outline",
        name: "Course Outline",
        description: "Full module + lesson outline.",
        fields: [
          { key: "topic", label: "Course topic" },
          { key: "outcome", label: "Student outcome" },
        ],
        buildPrompt: (v) =>
          `Design a full course outline on "${v.topic}" that helps students achieve: ${v.outcome}. Include 5–7 modules, 3–5 lessons per module, and a capstone project.`,
      },
      {
        id: "lesson-script",
        name: "Lesson Script",
        description: "Ready-to-record lesson script.",
        fields: [{ key: "lesson", label: "Lesson title" }],
        buildPrompt: (v) =>
          `Write a lesson script for "${v.lesson}". Include hook, teaching points with examples, on-screen prompts, and a next-lesson tease.`,
      },
      {
        id: "course-sales",
        name: "Course Sales Page Copy",
        description: "High-conversion sales page copy.",
        fields: [{ key: "topic", label: "Course name & promise" }],
        buildPrompt: (v) =>
          `Write high-conversion sales page copy for the course: ${v.topic}. Include headline, subheadline, problem, solution, curriculum highlights, bonuses, FAQ, and CTA.`,
      },
    ],
  },
  {
    id: "templates",
    name: "Templates & Printables",
    icon: FileText,
    tools: [
      {
        id: "template-ideas",
        name: "Template Product Ideas",
        description: "Sellable template concepts in a niche.",
        fields: [{ key: "niche", label: "Niche" }],
        buildPrompt: (v) =>
          `List 15 sellable template/printable product ideas in the niche: ${v.niche}. For each, include a one-line pitch and the best format (Notion, Google Sheet, PDF, Canva).`,
      },
      {
        id: "template-description",
        name: "Template Description",
        description: "Product description for a template listing.",
        fields: [{ key: "template", label: "Template name & what it does" }],
        buildPrompt: (v) =>
          `Write a marketplace description for the template: ${v.template}. Include what's inside, who it's for, benefits, and 5 bullet features.`,
      },
    ],
  },
  {
    id: "audio",
    name: "Music & Audio",
    icon: Music,
    tools: [
      {
        id: "track-description",
        name: "Track / Beat Description",
        description: "Description for a music or beat listing.",
        fields: [{ key: "track", label: "Track name, genre, mood" }],
        buildPrompt: (v) =>
          `Write a marketplace description for the audio track: ${v.track}. Include vibe, BPM/key if applicable, best-use cases, and licensing usage examples.`,
      },
      {
        id: "podcast-episode",
        name: "Podcast Episode Notes",
        description: "Show notes and chapter markers.",
        fields: [
          { key: "episode", label: "Episode title/topic" },
          { key: "guest", label: "Guest (optional)" },
        ],
        buildPrompt: (v) =>
          `Write podcast show notes for episode "${v.episode}"${v.guest ? ` with guest ${v.guest}` : ""}. Include summary, 5 key takeaways, timestamps, quotes, and CTAs.`,
      },
    ],
  },
  {
    id: "video",
    name: "Video",
    icon: Video,
    tools: [
      {
        id: "video-title",
        name: "YouTube Title & Thumbnail Ideas",
        description: "High-CTR title + thumbnail concepts.",
        fields: [{ key: "topic", label: "Video topic" }],
        buildPrompt: (v) =>
          `Generate 10 high-CTR YouTube titles for a video about: ${v.topic}. Then give 5 thumbnail text/visual concepts optimized for click-through.`,
      },
      {
        id: "video-script",
        name: "Video Script",
        description: "Full script with hook and CTA.",
        fields: [{ key: "topic", label: "Video topic & length" }],
        buildPrompt: (v) =>
          `Write a full video script for: ${v.topic}. Include a 15-second hook, structured sections with B-roll cues, and a strong CTA.`,
      },
    ],
  },
  {
    id: "design",
    name: "Design & Art",
    icon: Palette,
    tools: [
      {
        id: "design-listing",
        name: "Design Product Listing",
        description: "Listing copy for design assets.",
        fields: [{ key: "asset", label: "Asset name & format" }],
        buildPrompt: (v) =>
          `Write a marketplace listing for the design asset: ${v.asset}. Include what's included, ideal use cases, file formats, and licensing.`,
      },
      {
        id: "prompt-pack",
        name: "AI Art Prompt Pack",
        description: "10 detailed prompts on a theme.",
        fields: [{ key: "theme", label: "Theme / style" }],
        buildPrompt: (v) =>
          `Generate 10 detailed AI art prompts on the theme: ${v.theme}. Each should specify subject, style, lighting, composition, and mood.`,
      },
    ],
  },
  {
    id: "faith",
    name: "Faith Content",
    icon: Church,
    tools: [
      {
        id: "sermon-outline",
        name: "Sermon Outline",
        description: "Faithful, biblically grounded outline.",
        fields: [
          { key: "topic", label: "Sermon topic / scripture" },
          { key: "audience", label: "Congregation type" },
        ],
        buildPrompt: (v) =>
          `Write a Christ-centered sermon outline on: ${v.topic}, for a ${v.audience} congregation. Include intro, 3 main points with scripture references, illustrations, application, and closing.`,
      },
      {
        id: "devotional",
        name: "Devotional",
        description: "Short devotional with scripture and prayer.",
        fields: [{ key: "topic", label: "Devotional theme / verse" }],
        buildPrompt: (v) =>
          `Write a devotional on: ${v.topic}. Include scripture, a short reflection (200–300 words), practical application, and a closing prayer.`,
      },
    ],
  },
  {
    id: "coaching",
    name: "Coaching",
    icon: Users,
    tools: [
      {
        id: "coaching-offer",
        name: "Coaching Offer Description",
        description: "Package description for a coaching listing.",
        fields: [{ key: "offer", label: "Program name & outcome" }],
        buildPrompt: (v) =>
          `Write a coaching program description for: ${v.offer}. Include ideal client, transformation, session structure, deliverables, and a bold CTA.`,
      },
      {
        id: "intake-questions",
        name: "Client Intake Questions",
        description: "Deep discovery questions.",
        fields: [{ key: "niche", label: "Coaching niche" }],
        buildPrompt: (v) =>
          `Generate 20 deep intake/discovery questions for a ${v.niche} coach's onboarding form.`,
      },
    ],
  },
  {
    id: "physical",
    name: "Physical & POD",
    icon: Package,
    tools: [
      {
        id: "product-listing",
        name: "Product Listing Copy",
        description: "Etsy/Shopify-ready product copy.",
        fields: [{ key: "product", label: "Product name & specs" }],
        buildPrompt: (v) =>
          `Write high-converting product listing copy for: ${v.product}. Include title, 5 bullet features, description, and 10 SEO keywords.`,
      },
      {
        id: "tshirt-slogans",
        name: "T-Shirt Slogans / POD Ideas",
        description: "Slogan ideas for POD merchandise.",
        fields: [{ key: "niche", label: "Niche / audience" }],
        buildPrompt: (v) =>
          `Generate 20 witty, sellable t-shirt / POD slogan ideas for the ${v.niche} niche.`,
      },
    ],
  },
  {
    id: "software",
    name: "Software & SaaS",
    icon: Code,
    tools: [
      {
        id: "saas-description",
        name: "SaaS / Tool Description",
        description: "Marketplace description for a software product.",
        fields: [{ key: "product", label: "Product name & what it does" }],
        buildPrompt: (v) =>
          `Write a marketplace description for the software product: ${v.product}. Include problem, solution, key features, pricing rationale, and setup steps.`,
      },
      {
        id: "changelog",
        name: "Release / Changelog Notes",
        description: "User-friendly release notes.",
        fields: [{ key: "changes", label: "Raw list of changes", multiline: true }],
        buildPrompt: (v) =>
          `Rewrite these raw changes as friendly release notes with sections (New, Improved, Fixed):\n${v.changes}`,
      },
    ],
  },
  {
    id: "marketing",
    name: "Marketing & Launch",
    icon: Megaphone,
    tools: [
      {
        id: "email-sequence",
        name: "Launch Email Sequence",
        description: "5-email launch sequence.",
        fields: [{ key: "product", label: "Product & audience" }],
        buildPrompt: (v) =>
          `Write a 5-email launch sequence for: ${v.product}. Number each email with subject line + body. Include tease, story, value, objection-crushing, and last call.`,
      },
      {
        id: "social-posts",
        name: "Social Media Posts",
        description: "10 platform-agnostic promo posts.",
        fields: [{ key: "product", label: "Product to promote" }],
        buildPrompt: (v) =>
          `Write 10 varied social media posts promoting: ${v.product}. Mix hooks, quotes, questions, and story angles. Include suggested hashtags.`,
      },
      {
        id: "seo-keywords",
        name: "SEO Keyword Pack",
        description: "Long-tail keyword list.",
        fields: [{ key: "topic", label: "Topic / product" }],
        buildPrompt: (v) =>
          `Generate 25 long-tail SEO keywords for: ${v.topic}. Group by search intent (informational, commercial, transactional).`,
      },
    ],
  },
];

const TONES = ["Professional", "Conversational", "Faith-Based", "Bold", "Educational"];
const AUDIENCES = ["Entrepreneurs", "Parents", "Students", "Church Leaders", "General"];

type FavoriteItem = {
  id: string;
  category: string;
  tool: string;
  text: string;
  savedAt: number;
};

const FAV_KEY = "av_ai_studio_favorites_v1";
const USAGE_KEY = "av_ai_studio_usage_v1";
const DRAFT_KEY = "av_ai_studio_draft_v1";

type OutputStatus = "idle" | "streaming" | "draft" | "interrupted" | "final";

type Draft = {
  category: string;
  tool: string;
  text: string;
  status: OutputStatus;
  updatedAt: number;
};

function AiStudioPage() {
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [toolId, setToolId] = useState(CATEGORIES[0].tools[0].id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [tone, setTone] = useState<string>(TONES[0]);
  const [audience, setAudience] = useState<string>(AUDIENCES[4]);
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [output, setOutput] = useState<string>("");
  const [outputStatus, setOutputStatus] = useState<OutputStatus>("idle");
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [usageCount, setUsageCount] = useState(0);
  const [showFavorites, setShowFavorites] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const category = useMemo(
    () => CATEGORIES.find((c) => c.id === categoryId)!,
    [categoryId],
  );
  const tool = useMemo(
    () => category.tools.find((t) => t.id === toolId) ?? category.tools[0],
    [category, toolId],
  );


  useEffect(() => {
    try {
      const rawF = localStorage.getItem(FAV_KEY);
      if (rawF) setFavorites(JSON.parse(rawF));
      const rawU = localStorage.getItem(USAGE_KEY);
      if (rawU) {
        const parsed = JSON.parse(rawU) as { month: string; count: number };
        const current = new Date().toISOString().slice(0, 7);
        if (parsed.month === current) setUsageCount(parsed.count);
      }
      const rawD = localStorage.getItem(DRAFT_KEY);
      if (rawD) {
        const draft = JSON.parse(rawD) as Draft;
        if (draft?.text) {
          setOutput(draft.text);
          if (draft.status !== "complete") {
            toast.info(
              `Recovered ${draft.status === "interrupted" ? "interrupted" : "in-progress"} draft from ${draft.tool}.`,
            );
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  function persistUsage(next: number) {
    const current = new Date().toISOString().slice(0, 7);
    localStorage.setItem(USAGE_KEY, JSON.stringify({ month: current, count: next }));
  }

  function persistDraft(draft: Draft) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* ignore quota */
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }

  function persistFavorites(next: FavoriteItem[]) {
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
    setFavorites(next);
  }

  function updateValue(k: string, v: string) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function selectCategory(id: string) {
    setCategoryId(id);
    const first = CATEGORIES.find((c) => c.id === id)!.tools[0];
    setToolId(first.id);
    setValues({});
    setOutput("");
  }

  function selectTool(id: string) {
    setToolId(id);
    setValues({});
    setOutput("");
  }

  async function handleGenerate() {
    const missing = tool.fields.filter((f) => !values[f.key]?.trim());
    if (missing.length > 0) {
      toast.error(`Fill in: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    // Cancel any prior in-flight stream.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setOutput("");
    clearDraft();
    let accumulated = "";
    let sawAnyChunk = false;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("You must be signed in.");

      const prompt = tool.buildPrompt(values);
      const res = await fetch("/api/ai-studio-stream", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: category.name,
          tool: tool.name,
          prompt,
          tone,
          audience,
          length,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let lastPersist = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          accumulated += chunk;
          sawAnyChunk = true;
          setOutput(accumulated);
          // Throttle draft writes so we don't hammer localStorage.
          const now = Date.now();
          if (now - lastPersist > 400) {
            lastPersist = now;
            persistDraft({
              category: category.name,
              tool: tool.name,
              text: accumulated,
              status: "streaming",
              updatedAt: now,
            });
          }
        }
      }

      persistDraft({
        category: category.name,
        tool: tool.name,
        text: accumulated,
        status: "complete",
        updatedAt: Date.now(),
      });

      const next = usageCount + 1;
      setUsageCount(next);
      persistUsage(next);
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") {
        if (sawAnyChunk) {
          persistDraft({
            category: category.name,
            tool: tool.name,
            text: accumulated,
            status: "interrupted",
            updatedAt: Date.now(),
          });
        }
        return;
      }
      if (sawAnyChunk) {
        persistDraft({
          category: category.name,
          tool: tool.name,
          text: accumulated,
          status: "interrupted",
          updatedAt: Date.now(),
        });
        toast.error(
          `${e instanceof Error ? e.message : "Generation failed."} Partial draft kept.`,
        );
      } else {
        const msg = e instanceof Error ? e.message : "Generation failed.";
        toast.error(msg);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  }

  function saveFavorite() {
    if (!output) return;
    const item: FavoriteItem = {
      id: crypto.randomUUID(),
      category: category.name,
      tool: tool.name,
      text: output,
      savedAt: Date.now(),
    };
    persistFavorites([item, ...favorites].slice(0, 100));
    toast.success("Saved to swipe file");
  }

  function removeFavorite(id: string) {
    persistFavorites(favorites.filter((f) => f.id !== id));
  }

  return (
    <PublisherShell accent={AI_STUDIO_ACCENT}>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[var(--page-accent)]">
            <Sparkles size={18} />
            <span className="text-xs uppercase tracking-widest font-semibold">
              AurumVault AI Studio
            </span>
          </div>
          <h1 className="mt-1 text-3xl md:text-4xl font-serif text-navy">
            Your premium creative assistant
          </h1>
          <p className="mt-2 text-slate-600 max-w-2xl">
            Category-specific tools for eBooks, courses, templates, audio, video, design,
            faith content, coaching, physical goods, software, and marketing.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              aria-label="Anthropic"
            >
              <path
                d="M12 2L14.5 9.5H22L16 14L18.5 22L12 17L5.5 22L8 14L2 9.5H9.5L12 2Z"
                fill="currentColor"
              />
            </svg>
            <span>Powered by Claude</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">This month</div>
          <div className="text-lg font-semibold text-navy">
            {usageCount} generation{usageCount === 1 ? "" : "s"}
          </div>
          <div className="text-[11px] text-slate-500">Unlimited for creators</div>
          <button
            onClick={() => setShowFavorites((s) => !s)}
            className="mt-2 text-sm rounded-full border border-[var(--page-accent)] text-[var(--page-accent)] px-3 py-1 hover:bg-[var(--page-accent-tint)]"
          >
            <Star size={14} className="inline mr-1" />
            My Swipe File ({favorites.length})
          </button>
        </div>
      </div>

      {showFavorites && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-serif text-lg text-navy mb-3">My AI Swipe File</h2>
          {favorites.length === 0 ? (
            <p className="text-sm text-slate-500">No favorites saved yet.</p>
          ) : (
            <ul className="space-y-3">
              {favorites.map((f) => (
                <li key={f.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      {f.category} · {f.tool} ·{" "}
                      {new Date(f.savedAt).toLocaleDateString()}
                    </div>
                    <button
                      onClick={() => removeFavorite(f.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="prose prose-sm max-w-none mt-2">
                    <ReactMarkdown>{f.text}</ReactMarkdown>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Category tabs */}
      <div className="mb-6 overflow-x-auto -mx-4 px-4">
        <div className="flex gap-2 min-w-max">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                onClick={() => selectCategory(c.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-navy text-white"
                    : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
                }`}
              >
                <Icon size={14} />
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Tool list */}
        <aside className="rounded-xl border border-slate-200 bg-white p-3 h-fit">
          <div className="text-xs uppercase tracking-wider text-slate-500 px-2 pb-2">
            {category.name} tools
          </div>
          <ul className="space-y-1">
            {category.tools.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => selectTool(t.id)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                    t.id === toolId
                      ? "bg-[var(--page-accent-tint)] text-navy font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Form + output */}
        <section className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-serif text-xl text-navy">{tool.name}</h2>
            <p className="text-sm text-slate-600 mt-1">{tool.description}</p>

            <div className="mt-4 space-y-3">
              {tool.fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {f.label}
                  </label>
                  {f.multiline ? (
                    <textarea
                      value={values[f.key] ?? ""}
                      onChange={(e) => updateValue(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--page-accent)]"
                    />
                  ) : (
                    <input
                      type="text"
                      value={values[f.key] ?? ""}
                      onChange={(e) => updateValue(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--page-accent)]"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tone
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {TONES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Audience
                </label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {AUDIENCES.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Length
                </label>
                <select
                  value={length}
                  onChange={(e) =>
                    setLength(e.target.value as "short" | "medium" | "long")
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-navy text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {loading ? "Generating…" : "Generate"}
            </button>
          </div>

          {output && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                <h3 className="font-serif text-lg text-navy">Output</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="text-sm inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
                  >
                    <Copy size={14} /> Copy
                  </button>
                  <button
                    onClick={saveFavorite}
                    className="text-sm inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
                  >
                    <Star size={14} /> Save
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="text-sm inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <RefreshCw size={14} /> Regenerate
                  </button>
                </div>
              </div>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{output}</ReactMarkdown>
              </div>
            </div>
          )}
        </section>
      </div>
    </PublisherShell>
  );
}
