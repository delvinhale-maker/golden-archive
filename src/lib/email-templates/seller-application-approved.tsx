import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  brandName?: string;
  siteUrl?: string;
}

const Email = ({ brandName = "Creator", siteUrl = "https://aurumvault.store" }: Props) => (
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
            Your creator account has been approved. You can now upload products, manage your
            catalog, and start earning on AurumVault.
          </Text>
          <Text style={styles.text}>
            You keep <strong>70%</strong> of every sale. Payouts and analytics are available
            from your seller dashboard.
          </Text>
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
  previewData: { brandName: "Delvin" },
} satisfies TemplateEntry;
