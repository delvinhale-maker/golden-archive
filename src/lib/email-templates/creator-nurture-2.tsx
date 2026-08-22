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
    <Preview>The best digital products usually start with a problem</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>Creator Notes</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>The Best Digital Products Usually Start With a Problem</Heading>
          <Text style={styles.text}>Hi {firstName || "there"},</Text>
          <Text style={styles.text}>
            Most first products fail for the same reason: they describe a topic instead of solving a
            problem. "A journal about focus" is a topic. "A 90-day system for people who start
            strong and quit in week two" is a problem — and problems are what people pay to fix.
          </Text>
          <Text style={styles.text}>
            Try this: write down the last three questions people asked you because they trust your
            experience. The overlap between them is usually your product.
          </Text>
          <Text style={styles.text}>
            Your Starter Pack has a 25-idea list built exactly for this exercise — open it and mark
            the three ideas that map to a real problem you've personally solved.
          </Text>
          <div style={{ textAlign: "center", margin: "22px 0 4px" }}>
            <Button href={`${siteUrl}/creator-starter-pack`} style={styles.button}>
              Open the Starter Pack Exercise
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
  subject: "The Best Digital Products Usually Start With a Problem",
  displayName: "Creator Nurture 2 — Start With a Problem",
  previewData: { siteUrl: SITE_URL_DEFAULT, firstName: "Jordan" },
} satisfies TemplateEntry;
