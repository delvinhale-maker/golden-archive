import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  leadEmail?: string;
  productType?: string;
  followerCount?: number;
  ctaSource?: string;
  signedUpAt?: string;
}

const Email = ({ leadEmail, productType, followerCount, ctaSource, signedUpAt }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New creator signup: ${leadEmail ?? "unknown"}`}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>New creator signup</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>A creator just requested the Starter Kit</Heading>
          <div style={styles.reasonBox}>
            <Text style={{ ...styles.text, margin: 0 }}>
              <strong>Email:</strong> {leadEmail ?? "—"}
            </Text>
            <Text style={{ ...styles.text, margin: 0 }}>
              <strong>Product type:</strong> {productType ?? "—"}
            </Text>
            <Text style={{ ...styles.text, margin: 0 }}>
              <strong>Followers:</strong>{" "}
              {typeof followerCount === "number" ? followerCount.toLocaleString() : "—"}
            </Text>
            <Text style={{ ...styles.text, margin: 0 }}>
              <strong>Source:</strong> {ctaSource ?? "—"}
            </Text>
            <Text style={{ ...styles.text, margin: 0 }}>
              <strong>When:</strong> {signedUpAt ?? new Date().toISOString()}
            </Text>
          </div>
          <Text style={styles.mute}>
            The Starter Kit email was sent to the creator automatically.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "New creator signup on AurumVault",
  displayName: "Creator signup alert (admin)",
  previewData: {
    leadEmail: "creator@example.com",
    productType: "Journals",
    followerCount: 12500,
    ctaSource: "hero",
    signedUpAt: new Date().toISOString(),
  },
} satisfies TemplateEntry;
