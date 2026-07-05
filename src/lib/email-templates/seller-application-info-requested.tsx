import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  brandName?: string;
  message?: string;
  siteUrl?: string;
}

const Email = ({ brandName = "there", message, siteUrl = "https://aurumvault.store" }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>We need a bit more info on your AurumVault application</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>A quick follow-up</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Hi {brandName},</Heading>
          <Text style={styles.text}>
            Thanks for applying to AurumVault. Before we can move forward, our review team
            needs a little more information.
          </Text>
          {message ? (
            <>
              <Text style={{ ...styles.text, marginBottom: 6, fontWeight: 600 }}>What we need:</Text>
              <div style={styles.reasonBox}>{message}</div>
            </>
          ) : null}
          <Text style={styles.text}>
            Just reply directly to this email with the requested details and we'll pick your
            application back up right away.
          </Text>
          <div style={{ textAlign: "center", margin: "20px 0 8px" }}>
            <Button href={`${siteUrl}/sell`} style={styles.button}>Update my application</Button>
          </div>
          <Text style={styles.mute}>We usually reply within one business day.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "A quick follow-up on your AurumVault application",
  displayName: "Seller application — info requested",
  previewData: { brandName: "Delvin", message: "Can you share 2–3 sample products or a link to your existing store?" },
} satisfies TemplateEntry;
