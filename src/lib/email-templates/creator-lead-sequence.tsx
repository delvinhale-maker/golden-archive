import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from "@react-email/components";
import { styles } from "./_shared";

interface SequenceProps {
  firstName?: string;
  siteUrl?: string;
}

const siteUrlDefault = "https://www.aurumvault.store";

/**
 * Email 1 — Welcome + kit delivery (sent immediately after opt-in).
 * NOTE: The linked Seller Starter Kit FAQ page should reflect the current
 * AurumVault terms: creators keep 85% of every sale and payouts are sent
 * every Friday automatically.
 */
export function CreatorLeadEmail1({
  firstName = "there",
  siteUrl = siteUrlDefault,
}: SequenceProps) {
  return (
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
            <Heading style={styles.heading}>Hi {firstName},</Heading>
            <Text style={styles.text}>
              Thanks for grabbing the free AurumVault Seller Starter Kit. Inside you'll find
              launch templates, a pricing guide, and a checklist to get your first product live.
            </Text>
            <Text style={styles.text}>
              AurumVault is built for creators who sell journals, planners, prompt packs, and ebooks.
              You keep <strong>85% of every sale</strong>, we handle checkout, delivery, and
              payouts — automatically every Friday.
            </Text>
            <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
              <Button href={`${siteUrl}/sell`} style={styles.button}>
                Start your application
              </Button>
            </div>
            <Text style={styles.mute}>
              Questions? Reply to this email or visit our creator FAQ.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * Email 2 — Social proof / how to launch (sent ~Day 2).
 */
export function CreatorLeadEmail2({
  firstName = "there",
  siteUrl = siteUrlDefault,
}: SequenceProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>3 moves that turn a draft into your first sale</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brandText}>AurumVault</Text>
            <Text style={styles.brandTitle}>From draft to first sale</Text>
          </Section>
          <Section style={styles.card}>
            <Heading style={styles.heading}>Hi {firstName},</Heading>
            <Text style={styles.text}>
              Most creators stall because they try to perfect everything before listing. The ones
              who sell fast focus on three things: a clear cover, a fair price, and a short
              description that speaks to one specific outcome.
            </Text>
            <Text style={styles.text}>
              On AurumVault, your product can be live in minutes. Our checkout handles taxes,
              delivery, and customer access — so you can spend your time creating instead of
              administrating.
            </Text>
            <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
              <Button href={`${siteUrl}/sell`} style={styles.button}>
                Apply to sell
              </Button>
            </div>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * Email 3 — Day 4 urgency offer.
 * Updated framing: baseline is 85% / Friday payouts; the incentive is a 95%
 * take-home rate for the first 90 days when signing up within 5 days.
 * Adjust the 95% figure to whatever incentive you are actually willing to
 * offer — the key is that it is a real discount from the stated baseline.
 */
export function CreatorLeadEmail3({
  firstName = "there",
  siteUrl = siteUrlDefault,
}: SequenceProps) {
  const offerTakeHome = 0.95;
  const platformFee = Math.round((1 - offerTakeHome) * 100);

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your first 90 days — even better terms</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brandText}>AurumVault</Text>
            <Text style={styles.brandTitle}>A limited first-90-days boost</Text>
          </Section>
          <Section style={styles.card}>
            <Heading style={styles.heading}>Hi {firstName},</Heading>
            <Text style={styles.text}>
              Right now you keep 85% of every sale, every Friday. Sign up in the next 5 days and
              we'll bump that to <strong>95%</strong> for your first 90 days — a {platformFee}%
              platform fee, no catches.
            </Text>
            <Text style={styles.text}>
              This only applies to creators who apply this week. After 90 days, your rate returns
              to the standard 85% — still one of the most creator-friendly splits around.
            </Text>
            <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
              <Button href={`${siteUrl}/sell`} style={styles.button}>
                Claim your 95% rate
              </Button>
            </div>
            <Text style={styles.mute}>
              Offer expires 5 days from the send date of this email. Terms apply.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
