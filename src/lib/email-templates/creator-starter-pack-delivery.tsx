import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  siteUrl?: string;
  firstName?: string;
  downloadUrl?: string;
}

const SITE_URL_DEFAULT = "https://www.aurumvault.store";
const PACK_PATH = "/downloads/AurumVault-Digital-Creator-Starter-Pack.pdf";

const Email = ({ siteUrl = SITE_URL_DEFAULT, firstName, downloadUrl }: Props) => {
  const href = downloadUrl ?? `${siteUrl}${PACK_PATH}`;
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your AurumVault Digital Creator Starter Pack is ready to download</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brandText}>AurumVault</Text>
            <Text style={styles.brandTitle}>Build Something Worth Selling</Text>
          </Section>
          <Section style={styles.card}>
            <Heading style={styles.heading}>Your Starter Pack is ready</Heading>
            <Text style={styles.text}>Hi {firstName || "there"},</Text>
            <Text style={styles.text}>
              Thanks for requesting the AurumVault Digital Creator Starter Pack. Inside you'll find
              practical tools to help you move from an idea to a more polished digital product —
              including product ideas, pricing guidance, a launch checklist, content ideas, quality
              checks, and a 7-Day Creator Sprint.
            </Text>
            <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
              <Button href={href} style={styles.button}>
                Download Your Starter Pack
              </Button>
            </div>
            <Text style={{ ...styles.mute, textAlign: "center" }}>
              Button not working? Paste this link into your browser:{" "}
              <Link href={href} style={{ color: "#c9a227" }}>
                {href}
              </Link>
            </Text>

            <div style={styles.divider} />

            <Heading style={{ ...styles.heading, fontSize: "19px" }}>
              Thinking about selling your work?
            </Heading>
            <Text style={styles.text}>
              If you already create premium digital resources — or you're working toward your first
              one — AurumVault is building a curated marketplace designed to treat independent
              creators like partners rather than inventory. You keep 85% of every sale.
            </Text>
            <div style={{ textAlign: "center", margin: "20px 0 4px" }}>
              <Button href={`${siteUrl}/sell`} style={styles.button}>
                Learn About Selling on AurumVault
              </Button>
            </div>

            <Text style={styles.mute}>
              You're receiving this one-time email because you requested the Creator Starter Pack at{" "}
              <Link href={`${siteUrl}/creator-starter-pack`} style={{ color: "#c9a227" }}>
                aurumvault.store
              </Link>
              . Questions? Just reply — a real person reads it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: "Your AurumVault Creator Starter Pack Is Ready",
  displayName: "Creator Starter Pack Delivery",
  previewData: { siteUrl: SITE_URL_DEFAULT, firstName: "Jordan" },
} satisfies TemplateEntry;
