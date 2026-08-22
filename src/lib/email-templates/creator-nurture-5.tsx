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
    <Preview>AurumVault is looking for independent creators</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>An Invitation</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>AurumVault Is Looking for Independent Creators</Heading>
          <Text style={styles.text}>Hi {firstName || "there"},</Text>
          <Text style={styles.text}>
            AurumVault is a curated marketplace for premium digital products — journals, planners,
            prompt packs, templates, ebooks, and creator business tools. It's built for people who
            want to keep ownership of their work and be treated like a partner, not inventory.
          </Text>
          <Text style={styles.text}>
            You keep <strong>85% of every sale</strong>. We handle checkout, delivery, and payouts.
            Applications are reviewed by a person, and we're selective on purpose — that curation is
            what makes the storefront worth being on.
          </Text>
          <div style={{ textAlign: "center", margin: "22px 0 4px" }}>
            <Button href={`${siteUrl}/sell`} style={styles.button}>
              Apply to Become a Creator
            </Button>
          </div>
          <Text style={styles.mute}>
            Not ready yet? That's fine — keep building with your Starter Pack and apply when your
            first product is close. You're receiving creator resources because you opted in at
            AurumVault.{" "}
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
  subject: "AurumVault Is Looking for Independent Creators",
  displayName: "Creator Nurture 5 — Marketplace Invitation",
  previewData: { siteUrl: SITE_URL_DEFAULT, firstName: "Jordan" },
} satisfies TemplateEntry;
