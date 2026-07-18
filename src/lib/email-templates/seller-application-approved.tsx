import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  brandName?: string;
  storefrontUrl?: string;
  siteUrl?: string;
}

const Email = ({ brandName = "Creator", storefrontUrl, siteUrl = "https://aurumvault.store" }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're approved to sell on AurumVault</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>You're in.</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Welcome, {brandName}.</Heading>
          <Text style={styles.text}>
            Your creator account has been approved. You keep <strong>85%</strong> of every
            sale, and your storefront is already live.
          </Text>

          {storefrontUrl ? (
            <div style={{ textAlign: "center", margin: "8px 0 20px" }}>
              <Text style={{ ...styles.mute, marginBottom: 6 }}>Your storefront</Text>
              <a href={storefrontUrl} style={{ color: "#0F1A33", fontWeight: 600, fontSize: 15 }}>
                {storefrontUrl}
              </a>
            </div>
          ) : null}

          <Hr style={styles.divider} />

          <Text style={{ ...styles.text, fontWeight: 600, marginBottom: 8 }}>
            Your onboarding checklist
          </Text>
          <ol style={{ paddingLeft: 20, margin: "0 0 16px", color: "#0F1A33", fontSize: 15, lineHeight: "1.7" }}>
            <li>Upload your first product (cover, file, price).</li>
            <li>Add a short brand bio and profile photo.</li>
            <li>Connect your payout details in the dashboard.</li>
            <li>Share your storefront link with your audience.</li>
          </ol>

          <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
            <Button href={`${siteUrl}/dashboard/new`} style={styles.button}>Upload your first product</Button>
          </div>
          <Text style={styles.mute}>
            Questions? Just reply to this email — our team reads every message.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "You're approved to sell on AurumVault",
  displayName: "Seller application approved",
  previewData: { brandName: "Delvin", storefrontUrl: "https://aurumvault.store/store/delvin" },
} satisfies TemplateEntry;
