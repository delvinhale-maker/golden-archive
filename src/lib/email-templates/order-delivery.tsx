import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface OrderItem {
  title: string;
  downloadUrl: string;
}

interface Props {
  items?: OrderItem[];
  totalFormatted?: string;
  orderId?: string;
}

const Email = ({
  items = [],
  totalFormatted = "$0.00",
  orderId = "",
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your AurumVault download is ready</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>Your download is ready.</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Thank you for your order.</Heading>
          <Text style={styles.text}>
            Your payment was received. Click the button next to each item to
            download. Links are valid for 90 days and allow up to 5 downloads
            per item.
          </Text>
          {items.map((it, i) => (
            <div key={i} style={{ margin: "20px 0" }}>
              <Text style={{ ...styles.text, fontWeight: 600, marginBottom: 8 }}>
                {it.title}
              </Text>
              <div style={{ textAlign: "center" }}>
                <Button href={it.downloadUrl} style={styles.button}>
                  Download
                </Button>
              </div>
              {i < items.length - 1 && <Hr style={{ borderColor: "#eee", margin: "20px 0" }} />}
            </div>
          ))}
          <Hr style={{ borderColor: "#eee", margin: "20px 0" }} />
          <Text style={styles.mute}>
            Order {orderId} · Total {totalFormatted}
          </Text>
          <Text style={styles.mute}>
            Save this email — you'll need it to re-download. Questions? Reply
            and our team will help.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Your AurumVault download is ready",
  displayName: "Order delivery",
  previewData: {
    items: [{ title: "Money Smart", downloadUrl: "https://www.aurumvault.store/download/abc" }],
    totalFormatted: "$9.99",
    orderId: "ord_123",
  },
} satisfies TemplateEntry;
