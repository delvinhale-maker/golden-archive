import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  siteUrl?: string;
  productType?: string;
  email?: string;
}

const SITE_URL_DEFAULT = "https://www.aurumvault.store";
const STARTER_KIT_PATH = "/downloads/AurumVault-Creator-Starter-Kit.pdf";

const Email = ({ siteUrl = SITE_URL_DEFAULT, productType, email }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Thanks for joining AurumVault — your Starter Kit is ready</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>Welcome to the vault</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>You're on the list</Heading>
          <Text style={styles.text}>
            Thanks for signing up{email ? `, ${email}` : ""}. We've received your details and your free
            AurumVault Seller Starter Kit is ready.
          </Text>
          <Text style={styles.text}>
            {productType
              ? `We build for creators selling ${productType.toLowerCase()} and more. `
              : "We build for creators selling journals, planners, prompt packs, and ebooks. "}
            You keep <strong>85% of every sale</strong> — we handle checkout, delivery, and automatic
            Friday payouts.
          </Text>
          <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
            <Button href={`${siteUrl}${STARTER_KIT_PATH}`} style={styles.button}>
              Download your Starter Kit (PDF)
            </Button>
          </div>
          <Text style={{ ...styles.mute, textAlign: "center" }}>
            Ready to sell?{" "}
            <Link href={`${siteUrl}/sell`} style={{ color: "#c9a227" }}>
              Start your creator application
            </Link>{" "}
            whenever you like.
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
  subject: "Welcome to AurumVault — your creator signup is confirmed",
  displayName: "Creator Signup Confirmation",
  previewData: { siteUrl: SITE_URL_DEFAULT, productType: "Journals", email: "you@example.com" },
} satisfies TemplateEntry;
