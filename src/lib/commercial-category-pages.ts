export type CommercialCategoryPageConfig = {
  route: string;
  category: string;
  label: string;
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  intro: string;
  why: string;
  note?: string;
};

export const COMMERCIAL_CATEGORY_PAGES = {
  ebooks: {
    route: "/ebooks",
    category: "ebooks",
    label: "eBooks",
    title: "eBooks & Digital Guides | Business, Money, Technology & More | AurumVault",
    description:
      "Shop downloadable eBooks and digital guides on business, money, technology, personal growth, children's learning, and practical decision-making.",
    h1: "eBooks & Digital Guides",
    eyebrow: "Downloadable reading",
    intro:
      "Explore practical long-form digital books from AurumVault creators, including business, money, technology, personal growth, children's learning and decision-focused guides.",
    why:
      "Every listing is delivered digitally, so you can review the product details, format and creator before purchasing and access eligible purchases through your AurumVault library.",
  },
  journals: {
    route: "/journals",
    category: "printable_journals",
    label: "Journals",
    title: "Digital & Printable Journals | Guided Reflection & Growth | AurumVault",
    description:
      "Explore downloadable guided journals for reflection, faith, wellness, mindset, habits, and personal growth from AurumVault creators.",
    h1: "Digital & Printable Journals",
    eyebrow: "Guided reflection",
    intro:
      "Browse downloadable journals built for reflection, faith, wellness, mindset, habits and intentional personal growth. Product pages explain whether a journal is printable, fillable or designed for a particular workflow.",
    why:
      "Choose the journal structure that fits how you actually work—guided prompts, repeatable daily pages, trackers or focused reflection—rather than buying a generic blank document.",
  },
  planners: {
    route: "/planners",
    category: "financial_planners",
    label: "Planners",
    title: "Digital & Printable Planners | Business, Money, Wellness & Life | AurumVault",
    description:
      "Shop downloadable planners for business, finances, appointments, weddings, wellness, social media, and everyday organization.",
    h1: "Digital & Printable Planners",
    eyebrow: "Plan with structure",
    intro:
      "Find downloadable planners for business, finances, appointments, weddings, wellness, content and everyday organization. Each listing explains the included pages, format and intended use.",
    why:
      "A good planner turns recurring decisions into a repeatable process. Use the catalog to compare purpose, workflow and format before choosing the system that matches your needs.",
  },
  aiPromptPacks: {
    route: "/ai-prompt-packs",
    category: "ai_prompt_packs",
    label: "AI Prompt Packs",
    title: "AI Prompt Packs for ChatGPT, Claude & Gemini | AurumVault",
    description:
      "Explore structured AI prompt packs for business, writing, research, marketing, productivity, and practical workflows.",
    h1: "AI Prompt Packs",
    eyebrow: "Structured AI workflows",
    intro:
      "Explore organized prompt libraries for business, writing, research, marketing and productivity workflows. These resources are designed to give you reusable starting points rather than a pile of disconnected prompt ideas.",
    why:
      "Prompt packs can improve consistency and reduce setup time, but model behavior varies. Review, verify and adapt generated output for your actual context before relying on it.",
    note:
      "AI prompt packs are workflow resources, not guarantees of accuracy, quality, business results or a particular model response.",
  },
} as const satisfies Record<string, CommercialCategoryPageConfig>;

export function commercialCategoryHead(config: CommercialCategoryPageConfig) {
  const site = "https://www.aurumvault.store";
  const canonical = `${site}${config.route}`;
  return {
    meta: [
      { title: config.title },
      { name: "description", content: config.description },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: config.title },
      { property: "og:description", content: config.description },
      { property: "og:url", content: canonical },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: config.title },
      { name: "twitter:description", content: config.description },
    ],
    links: [{ rel: "canonical", href: canonical }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: config.h1,
          description: config.description,
          url: canonical,
          isPartOf: { "@type": "WebSite", name: "AurumVault", url: site },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: site },
            { "@type": "ListItem", position: 2, name: "Products", item: `${site}/products` },
            { "@type": "ListItem", position: 3, name: config.label, item: canonical },
          ],
        }),
      },
    ],
  };
}
