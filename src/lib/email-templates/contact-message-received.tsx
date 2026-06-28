import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { styles } from "./_shared";

interface Props {
  name?: string;
  email?: string;
  topic?: string;
  message?: string;
  submittedAt?: string;
}

const Email = ({
  name = "A visitor",
  email = "unknown@unknown",
  topic = "support",
  message = "(no message)",
  submittedAt = new Date().toISOString(),
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New contact form submission from {name}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandText}>AurumVault</Text>
          <Text style={styles.brandTitle}>New contact message</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>From {name}</Heading>
          <Text style={styles.text}>
            <strong>Email:</strong> {email}
            <br />
            <strong>Topic:</strong> {topic}
            <br />
            <strong>Submitted:</strong> {new Date(submittedAt).toLocaleString()}
          </Text>
          <div style={styles.reasonBox}>
            {message.split("\n").map((line, i) => (
              <React.Fragment key={i}>
                {line}
                <br />
              </React.Fragment>
            ))}
          </div>
          <Text style={styles.mute}>
            Reply directly to {email} to respond. The full message is saved in your admin dashboard.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `New contact: ${data.topic || "support"} — ${data.name || "Visitor"}`,
  displayName: "Contact form notification",
  to: "support@aurumvault.store",
  previewData: {
    name: "Jane Doe",
    email: "jane@example.com",
    topic: "support",
    message: "Hi, I have a question about my order.",
    submittedAt: new Date().toISOString(),
  },
} satisfies TemplateEntry;
