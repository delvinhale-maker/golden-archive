import { useState } from "react";
import { Copy, Check, Twitter, Facebook, Linkedin, Flag } from "lucide-react";
import { toast } from "sonner";

export function ShareButtons({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const text = encodeURIComponent(`${title} on AurumVault`);
  const u = encodeURIComponent(url);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-caps text-mute">
        Share
      </span>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-gold"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <a
        href={`https://twitter.com/intent/tweet?text=${text}&url=${u}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-gold"
      >
        <Twitter size={12} /> X / Twitter
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${u}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-gold"
      >
        <Facebook size={12} /> Facebook
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${u}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-gold"
      >
        <Linkedin size={12} /> LinkedIn
      </a>
    </div>
  );
}

export function ReportIssueLink({ title }: { title: string }) {
  const subject = encodeURIComponent(`Issue with "${title}" on AurumVault`);
  return (
    <a
      href={`mailto:support@aurumvault.store?subject=${subject}`}
      className="mt-8 inline-flex items-center gap-1.5 text-xs font-semibold text-mute hover:text-ink"
    >
      <Flag size={11} /> Report an issue with this product
    </a>
  );
}
