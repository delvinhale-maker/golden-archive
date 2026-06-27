import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  confirmUrl: string;
}

const Email = ({ confirmUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your AurumVault subscription</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>Confirm your email</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>One quick step.</Heading>
          <Text style={styles.text}>
            Please confirm your email to start receiving Kingdom-curated resources,
            free guides, and early drops from AurumVault.
          </Text>
          <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
            <Button href={confirmUrl} style={styles.button}>Confirm subscription</Button>
          </div>
          <Text style={styles.mute}>
            Didn't sign up? You can safely ignore this email — no subscription
            will be created without your confirmation.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Confirm your AurumVault subscription",
  displayName: "Subscriber confirmation",
  previewData: { confirmUrl: "https://www.aurumvault.store/subscribe/confirm?token=example" },
} satisfies TemplateEntry;
