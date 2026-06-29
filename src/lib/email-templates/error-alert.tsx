import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  message?: string;
  source?: string;
  severity?: string;
  route?: string;
  url?: string;
  occurredAt?: string;
  stack?: string;
  reportUrl?: string;
  recentCount?: number;
}

const Email = ({
  message = "An error occurred",
  source = "client",
  severity = "error",
  route = "(unknown)",
  url = "",
  occurredAt = new Date().toISOString(),
  stack = "",
  reportUrl = "https://www.aurumvault.store/admin/errors",
  recentCount = 1,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`AurumVault error alert · ${severity.toUpperCase()} · ${message.slice(0, 80)}`}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault · Monitoring</Text>
          <Text style={styles.brandTitle}>Production error detected</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>{severity.toUpperCase()}: {message.slice(0, 140)}</Heading>
          <Text style={styles.text}>
            <strong>Source:</strong> {source}<br />
            <strong>Route:</strong> {route}<br />
            {url ? <><strong>URL:</strong> {url}<br /></> : null}
            <strong>Occurred:</strong> {new Date(occurredAt).toUTCString()}<br />
            <strong>Recent similar (last hour):</strong> {recentCount}
          </Text>
          {stack ? (
            <div style={{ ...styles.reasonBox, fontFamily: "monospace", fontSize: 11, whiteSpace: "pre-wrap", overflow: "hidden" }}>
              {stack.slice(0, 1800)}
            </div>
          ) : null}
          <div style={{ textAlign: "center", margin: "20px 0 8px" }}>
            <Button href={reportUrl} style={styles.button}>Open error log</Button>
          </div>
        </Section>
        <Text style={{ ...styles.text, fontSize: 11, textAlign: "center", color: "#64748b" }}>
          Alerts are throttled to one per unique error every 15 minutes.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `🚨 AurumVault ${(data?.severity || "error").toUpperCase()}: ${String(data?.message || "Production error").slice(0, 80)}`,
  displayName: "Production Error Alert",
  previewData: {
    message: "TypeError: cannot read properties of undefined (reading 'id')",
    source: "client",
    severity: "fatal",
    route: "/products",
    url: "https://www.aurumvault.store/products",
    occurredAt: new Date().toISOString(),
    stack: "at ProductCard (src/components/marketplace/PremiumProductCard.tsx:42)\n  at HomeRows (src/components/marketplace/HomeRows.tsx:120)",
    recentCount: 3,
  },
} satisfies TemplateEntry;
