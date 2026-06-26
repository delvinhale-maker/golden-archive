import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Issue {
  severity?: string;
  area?: string;
  message: string;
}

interface Props {
  brandName?: string;
  productTitle?: string;
  status?: "approved" | "needs-changes";
  score?: number;
  issues?: Issue[];
  productUrl?: string;
  siteUrl?: string;
}

const Email = ({
  brandName = "Creator",
  productTitle = "your product",
  status = "approved",
  score,
  issues = [],
  productUrl,
  siteUrl = "https://aurumvault.store",
}: Props) => {
  const approved = status === "approved";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {approved
          ? `"${productTitle}" passed AI review`
          : `"${productTitle}" needs a few changes`}
      </Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brandText}>AurumVault</Text>
            <Text style={styles.brandTitle}>
              {approved ? "AI review passed" : "Changes requested"}
            </Text>
          </Section>
          <Section style={styles.card}>
            <Heading style={styles.heading}>Hi {brandName},</Heading>
            <Text style={styles.text}>
              {approved ? (
                <>
                  Good news — <strong>{productTitle}</strong> passed our automated
                  quality review{typeof score === "number" ? ` with a score of ${score}/100` : ""}.
                  It's ready for the storefront.
                </>
              ) : (
                <>
                  Our AI review flagged a few items on <strong>{productTitle}</strong>
                  {typeof score === "number" ? ` (score ${score}/100)` : ""} that
                  need attention before it can be approved.
                </>
              )}
            </Text>
            {!approved && issues.length > 0 ? (
              <>
                <Text style={{ ...styles.text, marginBottom: 6, fontWeight: 600 }}>
                  What to fix:
                </Text>
                <div style={styles.reasonBox}>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {issues.slice(0, 6).map((it, i) => (
                      <li key={i} style={{ marginBottom: 6 }}>
                        {it.area ? <strong>{it.area}: </strong> : null}
                        {it.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}
            <div style={{ textAlign: "center", margin: "20px 0 8px" }}>
              <Button href={productUrl || `${siteUrl}/dashboard`} style={styles.button}>
                {approved ? "View product" : "Edit product"}
              </Button>
            </div>
            <Text style={styles.mute}>
              Questions? Just reply to this email — our team reads every message.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data?.status === "needs-changes"
      ? `Changes requested on "${data?.productTitle ?? "your product"}"`
      : `"${data?.productTitle ?? "Your product"}" passed AI review`,
  displayName: "Product AI review update",
  previewData: {
    brandName: "Delvin",
    productTitle: "Money Smart",
    status: "needs-changes",
    score: 62,
    issues: [
      { area: "description", severity: "medium", message: "Add a clear table of contents and target reader." },
      { area: "cover", severity: "low", message: "Title text is hard to read at thumbnail size." },
    ],
  },
} satisfies TemplateEntry;
