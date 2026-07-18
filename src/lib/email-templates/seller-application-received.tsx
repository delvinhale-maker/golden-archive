import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  brandName?: string;
  siteUrl?: string;
}

const Email = ({ brandName = "there", siteUrl = "https://aurumvault.store" }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>We received your AurumVault creator application</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>Application received</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Thank you, {brandName}.</Heading>
          <Text style={styles.text}>
            We've received your creator application for AurumVault. Our team reviews each
            submission carefully — you'll hear back within <strong>48 hours</strong>.
          </Text>
          <Text style={styles.text}>
            Once approved, you'll be able to upload products, set pricing, and start selling.
            You keep <strong>85%</strong> of every sale; AurumVault retains a 15% platform fee.
          </Text>
          <div style={{ textAlign: "center", margin: "20px 0 8px" }}>
            <Button href={`${siteUrl}/dashboard`} style={styles.button}>Open your dashboard</Button>
          </div>
          <Text style={styles.mute}>
            If you didn't submit this application, you can safely ignore this email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "We received your AurumVault application",
  displayName: "Seller application received",
  previewData: { brandName: "Delvin" },
} satisfies TemplateEntry;
