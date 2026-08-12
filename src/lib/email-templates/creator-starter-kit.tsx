import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  siteUrl?: string;
  productType?: string;
}

const SITE_URL_DEFAULT = "https://www.aurumvault.store";
/** Static PDF served from the site's public directory. */
export const STARTER_KIT_PATH = "/seller-starter-kit.pdf";


const Email = ({ siteUrl = SITE_URL_DEFAULT, productType }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your free AurumVault Seller Starter Kit is inside</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>Welcome to the vault</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Your Starter Kit is here</Heading>
          <Text style={styles.text}>
            Thanks for requesting the free AurumVault Seller Starter Kit. Inside you'll find launch
            templates, a pricing guide, and a checklist to get your first product live.
          </Text>
          <Text style={styles.text}>
            {productType
              ? `We build for creators selling ${productType.toLowerCase()} and more. `
              : "We build for creators selling journals, planners, prompt packs, and ebooks. "}
            You keep <strong>85% of every sale</strong> — we handle checkout, delivery, and payouts,
            automatically every Friday.
          </Text>
          <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
            <Button href={`${siteUrl}${STARTER_KIT_PATH}`} style={styles.button}>
              Download your Starter Kit (PDF)
            </Button>
          </div>
          <Text style={{ ...styles.mute, textAlign: "center" }}>
            Link not working? Copy and paste this into your browser:{" "}
            <Link href={`${siteUrl}${STARTER_KIT_PATH}`} style={{ color: "#c9a227" }}>
              {`${siteUrl}${STARTER_KIT_PATH}`}
            </Link>
          </Text>
          <Text style={{ ...styles.text, textAlign: "center" }}>
            When you're ready,{" "}
            <Link href={`${siteUrl}/sell`} style={{ color: "#c9a227" }}>
              start your application
            </Link>{" "}
            to sell on AurumVault.
          </Text>
          <Text style={styles.mute}>
            Questions? Just reply to this email — a real person reads it.
          </Text>

        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Your free AurumVault Seller Starter Kit",
  displayName: "Creator Seller Starter Kit",
  previewData: { siteUrl: SITE_URL_DEFAULT, productType: "Journals" },
} satisfies TemplateEntry;
