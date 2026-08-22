import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  siteUrl?: string;
  brandName?: string;
  foundingNumber?: number;
  foundingLabel?: string;
  storefrontUrl?: string | null;
  dashboardUrl?: string;
  launchKitUrl?: string;
}

const SITE_URL_DEFAULT = "https://www.aurumvault.store";

const Email = ({
  siteUrl = SITE_URL_DEFAULT,
  brandName = "Creator",
  foundingLabel = "#001",
  storefrontUrl,
  dashboardUrl,
  launchKitUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're in — welcome to the AurumVault Founding 100</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>Founding 100 Creators</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Welcome to the Founding 100</Heading>
          <Text style={styles.text}>Hi {brandName},</Text>
          <Text style={styles.text}>
            Your application has been accepted into the AurumVault Founding 100 — the first curated
            cohort of independent creators helping shape the marketplace.
          </Text>
          <Text style={{ ...styles.text, fontSize: "22px", fontWeight: 700, color: "#0F1A33" }}>
            Founding Creator {foundingLabel}
          </Text>
          <Text style={styles.text}>Here's what to do next:</Text>
          <Text style={styles.text}>
            1. Finish your creator profile so buyers see who's behind the work.
            <br />
            2. Prepare your first product — every product still goes through the normal quality and
            rights review.
            <br />
            3. Open your Launch Kit for announcement assets, caption copy, and your storefront QR
            code.
          </Text>
          <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
            <Button href={launchKitUrl ?? `${siteUrl}/dashboard/launch-kit`} style={styles.button}>
              Open Your Launch Kit
            </Button>
          </div>
          {storefrontUrl ? (
            <Text style={{ ...styles.mute, textAlign: "center" }}>
              Your storefront:{" "}
              <Link href={storefrontUrl} style={{ color: "#c9a227" }}>
                {storefrontUrl}
              </Link>
            </Text>
          ) : null}
          <div style={styles.divider} />
          <Text style={styles.mute}>
            Manage everything from your{" "}
            <Link href={dashboardUrl ?? `${siteUrl}/dashboard`} style={{ color: "#c9a227" }}>
              creator dashboard
            </Link>
            . You keep 85% of every sale; AurumVault takes a 15% platform fee. Questions? Just reply
            — a real person reads it.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "You're in — AurumVault Founding 100",
  displayName: "Founding Creator Accepted",
  previewData: {
    siteUrl: SITE_URL_DEFAULT,
    brandName: "Kingdom Press",
    foundingLabel: "#007",
    storefrontUrl: `${SITE_URL_DEFAULT}/store/kingdom-press`,
  },
} satisfies TemplateEntry;
