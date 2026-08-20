import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  siteUrl?: string;
}

const SITE_URL_DEFAULT = "https://www.aurumvault.store";
/** Must match an active key in PROMOS (src/lib/payments.functions.ts). */
export const WELCOME_PROMO_CODE = "AURUM10";

const Email = ({ siteUrl = SITE_URL_DEFAULT }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A welcome discount for your first order</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>On the house</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>10% off your first order</Heading>
          <Text style={styles.text}>
            You've had a few days to look around — here's a small nudge. Use the code below at
            checkout for 10% off anything in the vault.
          </Text>
          <div
            style={{
              textAlign: "center",
              margin: "20px 0",
              padding: "14px",
              border: "1px dashed #C9A24B",
              borderRadius: "8px",
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "#0F1A33",
            }}
          >
            {WELCOME_PROMO_CODE}
          </div>
          <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
            <Button href={`${siteUrl}/products`} style={styles.button}>
              Shop the Vault
            </Button>
          </div>
          <Text style={styles.mute}>
            Enter the code at checkout. No expiration pressure here — it'll be waiting whenever
            you're ready.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "A welcome gift: 10% off your first order",
  displayName: "Subscriber welcome 3 — Welcome discount",
  previewData: { siteUrl: SITE_URL_DEFAULT },
} satisfies TemplateEntry;
