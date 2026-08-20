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
    <Preview>Not sure where to start? Here's the map.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>Where to start</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Three places worth a look</Heading>
          <Text style={styles.text}>
            AurumVault covers a lot of ground, so here's a shortcut to the parts our community
            comes back to most:
          </Text>
          <Text style={styles.text}>
            <strong>Kingdom Picks</strong> — a hand-curated shortlist across every category, if
            you'd rather not scroll the whole catalog.
          </Text>
          <Text style={styles.text}>
            <strong>Creator Business Tools</strong> — media kits, rate cards, and campaign
            systems for anyone building an audience or a brand.
          </Text>
          <Text style={styles.text}>
            <strong>The Academy</strong> — free, in-depth guides on money, AI, publishing, and
            business — no purchase required.
          </Text>
          <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
            <Button href={`${siteUrl}/kingdom-picks`} style={styles.button}>
              See Kingdom Picks
            </Button>
          </div>
          <Text style={{ ...styles.mute, textAlign: "center" }}>
            Prefer to read first?{" "}
            <a href={`${siteUrl}/academy`} style={{ color: "#c9a227" }}>
              Visit the Academy
            </a>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Not sure where to start on AurumVault?",
  displayName: "Subscriber welcome 2 — Where to start",
  previewData: { siteUrl: SITE_URL_DEFAULT },
} satisfies TemplateEntry;
