import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  siteUrl?: string;
  firstName?: string;
  unsubscribeUrl?: string;
}

const SITE_URL_DEFAULT = "https://www.aurumvault.store";

const Email = ({ siteUrl = SITE_URL_DEFAULT, firstName, unsubscribeUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You don't need 100,000 followers to sell a digital product</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>Creator Notes</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>You Don't Need 100,000 Followers</Heading>
          <Text style={styles.text}>Hi {firstName || "there"},</Text>
          <Text style={styles.text}>
            A large audience is a distribution advantage, not a requirement. What actually converts
            is specificity: a small group of people who believe you understand their exact situation
            better than anyone else they follow.
          </Text>
          <Text style={styles.text}>
            Two hundred people who trust you can support a real product. Fifty thousand passive
            viewers often can't. Focused expertise beats reach because it removes doubt at the moment
            someone decides whether to buy.
          </Text>
          <Text style={styles.text}>
            So don't wait for a milestone. Build the thing your smallest, clearest audience keeps
            asking for — then let the marketplace handle discovery.
          </Text>
          <div style={{ textAlign: "center", margin: "22px 0 4px" }}>
            <Button href={`${siteUrl}/sell`} style={styles.button}>
              See How AurumVault Works
            </Button>
          </div>
          <Text style={styles.mute}>
            You're receiving creator resources because you opted in at AurumVault.{" "}
            {unsubscribeUrl ? (
              <Link href={unsubscribeUrl} style={{ color: "#5A6478" }}>
                Unsubscribe
              </Link>
            ) : null}
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "You Don't Need 100,000 Followers",
  displayName: "Creator Nurture 3 — Audience Size",
  previewData: { siteUrl: SITE_URL_DEFAULT, firstName: "Jordan" },
} satisfies TemplateEntry;
