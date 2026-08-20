import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  siteUrl?: string;
  unsubscribeUrl?: string;
}

const Email = ({
  siteUrl = "https://www.aurumvault.store",
  unsubscribeUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Free reads inside AurumVault Academy</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>AurumVault Academy</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Learn first, buy later.</Heading>
          <Text style={styles.text}>
            AurumVault Academy is our free library of practical guides on
            building income, systems, and habits with digital tools — written for
            people who want to act, not just read.
          </Text>
          <Text style={styles.text}>
            If you create your own journals, prompt packs, or planners, you can
            also sell them here and keep 85% of every sale, with payouts each
            Friday.
          </Text>
          <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
            <Button href={`${siteUrl}/academy`} style={styles.button}>
              Read the Academy
            </Button>
          </div>
          {unsubscribeUrl ? (
            <Text style={styles.mute}>
              Don't want these? <a href={unsubscribeUrl}>Unsubscribe</a>.
            </Text>
          ) : null}
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Free guides inside AurumVault Academy",
  displayName: "Subscriber sequence · step 3 (day 6)",
  previewData: { siteUrl: "https://www.aurumvault.store" },
} satisfies TemplateEntry;
