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
    <Preview>Where to start inside the AurumVault library</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>Start here</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Three places worth your time.</Heading>
          <Text style={styles.text}>
            Most people open the vault and don't know where to begin. Start with
            the journals if you want structure, the AI prompt packs if you want
            speed, and the planners if you want a system you'll actually keep.
          </Text>
          <Text style={styles.text}>
            Every purchase is an instant download, and eligible orders are
            covered by our 14-day money-back guarantee.
          </Text>
          <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
            <Button href={`${siteUrl}/products`} style={styles.button}>
              Browse the vault
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
  subject: "Where to start inside AurumVault",
  displayName: "Subscriber sequence · step 2 (day 3)",
  previewData: { siteUrl: "https://www.aurumvault.store" },
} satisfies TemplateEntry;
