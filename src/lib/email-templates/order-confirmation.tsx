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
  Hr,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface OrderItem {
  title: string;
  amountFormatted: string;
}

interface Props {
  items?: OrderItem[];
  totalFormatted?: string;
  orderId?: string;
  buyerEmail?: string;
  isPreorder?: boolean;
}

const Email = ({
  items = [],
  totalFormatted = "$0.00",
  orderId = "",
  buyerEmail = "",
  isPreorder = false,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Order confirmed — thanks for your purchase</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>Order confirmed.</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Thank you for your order.</Heading>
          <Text style={styles.text}>
            We've received your payment. A receipt and summary are below.
            {isPreorder
              ? " One or more items in this order are a pre-order — you'll get a separate email with your download link the moment it's released."
              : " A separate email with your download link is on its way to your inbox shortly."}
          </Text>

          <div style={styles.reasonBox}>
            {items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "6px 0",
                  borderBottom:
                    i < items.length - 1 ? "1px solid #eee" : "none",
                }}
              >
                <span style={{ flex: 1 }}>{it.title}</span>
                <span style={{ fontWeight: 600 }}>{it.amountFormatted}</span>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0 0",
                marginTop: 8,
                borderTop: "1px solid #ddd",
                fontWeight: 700,
              }}
            >
              <span>Total</span>
              <span>{totalFormatted}</span>
            </div>
          </div>

          <Hr style={{ borderColor: "#eee", margin: "20px 0" }} />
          <Text style={styles.mute}>
            Order {orderId}
            {buyerEmail ? ` · ${buyerEmail}` : ""}
          </Text>
          <Text style={styles.mute}>
            Keep this email for your records. Questions? Reply and our team
            will help.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Your AurumVault order is confirmed",
  displayName: "Order confirmation",
  previewData: {
    items: [
      { title: "Kingdom Mind™ 90-Day Journal", amountFormatted: "$9.99" },
    ],
    totalFormatted: "$9.99",
    orderId: "ord_123",
    buyerEmail: "buyer@example.com",
    isPreorder: false,
  },
} satisfies TemplateEntry;
