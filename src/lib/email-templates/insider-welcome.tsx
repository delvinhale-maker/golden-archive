import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  firstName?: string | null;
  audienceType?: "GENERAL" | "CREATOR" | "BUSINESS_TOOL";
  siteUrl?: string;
  unsubscribeUrl?: string;
}

const LINKS = {
  GENERAL: [
    { label: "Explore the Academy", href: "/academy" },
    { label: "Browse Digital Systems", href: "/business-systems" },
    { label: "Discover Creator Tools", href: "/creator-business-tools" },
    { label: "Explore QR Business Tools", href: "/dashboard/qr" },
  ],
  CREATOR: [
    { label: "Start selling on AurumVault", href: "/become-a-creator" },
    { label: "Creator business tools", href: "/creator-business-tools" },
    { label: "Academy: build your catalogue", href: "/academy" },
    { label: "QR marketing tools", href: "/dashboard/qr" },
  ],
  BUSINESS_TOOL: [
    { label: "QR business tools", href: "/dashboard/qr" },
    { label: "Business systems", href: "/business-systems" },
    { label: "Practical guides in the Academy", href: "/academy" },
    { label: "Browse the marketplace", href: "/products" },
  ],
} as const;

const INTRO: Record<string, string> = {
  GENERAL:
    "You'll receive practical digital tools, creator opportunities, useful Academy content, marketplace releases, and ideas to help you build, create, and grow.",
  CREATOR:
    "You'll receive creator opportunities, new seller features, marketplace releases, QR marketing ideas, and Academy guides for growing a digital catalogue.",
  BUSINESS_TOOL:
    "You'll receive practical business-tool ideas — QR campaigns, review and appointment flows, digital systems, and relevant Academy guides.",
};

const Email = ({
  firstName,
  audienceType = "GENERAL",
  siteUrl = "https://www.aurumvault.store",
  unsubscribeUrl,
}: Props) => {
  const links = LINKS[audienceType] ?? LINKS.GENERAL;
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Welcome to AurumVault Insider</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brandText}>AurumVault Insider</Text>
            <Text style={styles.brandTitle}>Welcome aboard</Text>
          </Section>
          <Section style={styles.card}>
            <Heading style={styles.heading}>
              {firstName ? `Hi ${firstName},` : "Welcome to AurumVault Insider."}
            </Heading>
            <Text style={styles.text}>{INTRO[audienceType] ?? INTRO.GENERAL}</Text>
            <Text style={styles.text}>
              <strong>Start here:</strong>
            </Text>
            <div style={styles.reasonBox}>
              {links.map((l) => (
                <div key={l.href} style={{ margin: "6px 0" }}>
                  <a href={`${siteUrl}${l.href}`}>{l.label}</a>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
              <Button href={`${siteUrl}/insider`} style={styles.button}>
                Visit AurumVault Insider
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
};

export const template = {
  component: Email,
  subject: "Welcome to AurumVault Insider",
  displayName: "AurumVault Insider · welcome",
  previewData: { siteUrl: "https://www.aurumvault.store", audienceType: "GENERAL" },
} satisfies TemplateEntry;
