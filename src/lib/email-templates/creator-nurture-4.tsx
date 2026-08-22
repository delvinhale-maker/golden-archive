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
    <Preview>What actually makes a digital product feel premium</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>Creator Notes</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>What Makes a Digital Product Feel Premium?</Heading>
          <Text style={styles.text}>Hi {firstName || "there"},</Text>
          <Text style={styles.text}>
            Premium is rarely about length. A 20-page product that is clear, usable, and beautifully
            set will outsell a 200-page file that overwhelms the buyer.
          </Text>
          <Text style={styles.text}>
            Four things do most of the work: <strong>clarity</strong> (the buyer knows what to do
            next), <strong>usability</strong> (it works on a phone as well as a laptop),{" "}
            <strong>presentation</strong> (consistent type, spacing, and cover), and{" "}
            <strong>trust</strong> (an honest description that matches what's inside).
          </Text>
          <Text style={styles.text}>
            Before you publish anything, run it through the quality-control checklist in your Starter
            Pack. It's the fastest way to catch the small issues that make a good product feel cheap.
          </Text>
          <div style={{ textAlign: "center", margin: "22px 0 4px" }}>
            <Button href={`${siteUrl}/creator-starter-pack`} style={styles.button}>
              Open the Quality Checklist
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
  subject: "What Makes a Digital Product Feel Premium?",
  displayName: "Creator Nurture 4 — Premium Quality",
  previewData: { siteUrl: SITE_URL_DEFAULT, firstName: "Jordan" },
} satisfies TemplateEntry;
