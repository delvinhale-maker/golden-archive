import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface CategorySummary {
  category: string;
  total: number;
  failing: number;
}

interface Props {
  totalFailing?: number;
  threshold?: number;
  ranAt?: string;
  reportUrl?: string;
  categories?: CategorySummary[];
}

const Email = ({
  totalFailing = 0,
  threshold = 1,
  ranAt = new Date().toISOString(),
  reportUrl = "https://aurumvault.store/admin/health/covers",
  categories = [],
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Cover audit alert: ${totalFailing} failing (threshold ${threshold})`}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault · Alerts</Text>
          <Text style={styles.brandTitle}>Cover audit failures detected</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>
            {totalFailing} failing cover{totalFailing === 1 ? "" : "s"}
          </Heading>
          <Text style={styles.text}>
            The scheduled cover audit found <strong>{totalFailing}</strong> failing cover
            {totalFailing === 1 ? "" : "s"}, which is at or above your alert threshold of{" "}
            <strong>{threshold}</strong>.
          </Text>
          <div style={styles.reasonBox}>
            {categories.length === 0 ? (
              <Text style={{ ...styles.text, margin: 0 }}>No per-category breakdown available.</Text>
            ) : (
              categories.map((c) => (
                <Text key={c.category} style={{ ...styles.text, margin: "2px 0" }}>
                  <strong>{c.category}</strong> — {c.failing} failing of {c.total}
                </Text>
              ))
            )}
          </div>
          <div style={{ textAlign: "center", margin: "20px 0 8px" }}>
            <Button href={reportUrl} style={styles.button}>
              Open cover audit
            </Button>
          </div>
          <Text style={styles.mute}>Run at {new Date(ranAt).toLocaleString()}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `[AurumVault] ${data.totalFailing ?? 0} failing cover${data.totalFailing === 1 ? "" : "s"} detected`,
  displayName: "Cover audit failure alert",
  previewData: {
    totalFailing: 3,
    threshold: 1,
    ranAt: new Date().toISOString(),
    reportUrl: "https://aurumvault.store/admin/health/covers",
    categories: [
      { category: "ebooks", total: 5, failing: 2 },
      { category: "courses", total: 3, failing: 1 },
    ],
  },
} satisfies TemplateEntry;
