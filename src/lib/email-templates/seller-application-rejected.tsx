import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  brandName?: string;
  reason?: string;
  reapplyAfter?: string;
  siteUrl?: string;
}

const Email = ({ brandName = "there", reason, reapplyAfter, siteUrl = "https://aurumvault.store" }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Update on your AurumVault application</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>Application update</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Hi {brandName},</Heading>
          <Text style={styles.text}>
            Thank you for your interest in selling on AurumVault. After careful review, we're
            not able to approve your application at this time.
          </Text>
          {reason ? (
            <>
              <Text style={{ ...styles.text, marginBottom: 6, fontWeight: 600 }}>Reviewer note:</Text>
              <div style={styles.reasonBox}>{reason}</div>
            </>
          ) : null}
          {reapplyAfter ? (
            <Text style={styles.text}>
              You're welcome to reapply on or after <strong>{reapplyAfter}</strong>. We review
              every reapplication with fresh eyes.
            </Text>
          ) : (
            <Text style={styles.text}>
              You're welcome to refine your submission and reapply. We review every reapplication
              with fresh eyes.
            </Text>
          )}
          <div style={{ textAlign: "center", margin: "20px 0 8px" }}>
            <Button href={`${siteUrl}/sell`} style={styles.button}>Reapply</Button>
          </div>
          <Text style={styles.mute}>
            Questions? Reply to this email and we'll get back to you.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Update on your AurumVault application",
  displayName: "Seller application rejected",
  previewData: { brandName: "Delvin", reason: "We need more detail about the products you plan to sell.", reapplyAfter: "August 5, 2026" },
} satisfies TemplateEntry;
