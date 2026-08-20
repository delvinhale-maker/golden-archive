import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  siteUrl?: string;
}

const SITE_URL_DEFAULT = "https://www.aurumvault.store";

const Email = ({ siteUrl = SITE_URL_DEFAULT }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to the vault — here's what to expect</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>Welcome to the vault</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>You're in.</Heading>
          <Text style={styles.text}>
            Thanks for joining the AurumVault insider list. From here on, you'll get first
            access to new drops, curated picks, and the occasional exclusive deal — no spam,
            just what's actually worth your time.
          </Text>
          <Text style={styles.text}>
            AurumVault is a marketplace of professionally made digital products — planners,
            journals, prompt packs, creator business systems, and more — plus the Academy, our
            library of free guides on finance, AI, publishing, and entrepreneurship.
          </Text>
          <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
            <Button href={`${siteUrl}/products`} style={styles.button}>
              Browse the Vault
            </Button>
          </div>
          <Text style={styles.mute}>
            Questions? Just reply to this email — a real person reads it.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Welcome to AurumVault",
  displayName: "Subscriber welcome 1 — Welcome",
  previewData: { siteUrl: SITE_URL_DEFAULT },
} satisfies TemplateEntry;
