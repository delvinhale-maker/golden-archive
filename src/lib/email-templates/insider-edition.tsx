import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  title?: string;
  previewText?: string | null;
  /** Plain text / light markdown-ish body: blank lines separate paragraphs. */
  bodyText?: string;
  slug?: string;
  siteUrl?: string;
  unsubscribeUrl?: string;
}

/** Very small inline renderer: [label](url) links and paragraph breaks only. */
function renderParagraph(text: string, key: number) {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <a key={`l${i++}`} href={m[2]}>
        {m[1]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <Text key={key} style={styles.text}>
      {parts}
    </Text>
  );
}

const Email = ({
  title = "AurumVault Insider",
  previewText,
  bodyText = "",
  slug,
  siteUrl = "https://www.aurumvault.store",
  unsubscribeUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{previewText || title}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault Insider</Text>
          <Text style={styles.brandTitle}>{title}</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>{title}</Heading>
          {bodyText
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p, i) => renderParagraph(p, i))}
          <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
            <Button
              href={slug ? `${siteUrl}/insider/${slug}` : `${siteUrl}/insider`}
              style={styles.button}
            >
              Read on AurumVault
            </Button>
          </div>
          {unsubscribeUrl ? (
            <Text style={styles.mute}>
              You're receiving this because you subscribed to AurumVault Insider.{" "}
              <a href={unsubscribeUrl}>Unsubscribe</a>.
            </Text>
          ) : null}
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => data?.subject || data?.title || "AurumVault Insider",
  displayName: "AurumVault Insider · edition",
  previewData: {
    title: "Insider #1",
    bodyText: "One useful idea.\n\n[Read the Academy](https://www.aurumvault.store/academy)",
  },
} satisfies TemplateEntry;
