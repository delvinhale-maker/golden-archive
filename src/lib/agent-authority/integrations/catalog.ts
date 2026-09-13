export type IntegrationProvider = "gmail" | "google_drive" | "slack" | "hubspot" | "quickbooks" | "stripe" | "n8n" | "make" | "zapier";
export type IntegrationRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IntegrationCapability = {
  actionKey: string;
  label: string;
  mode: "READ" | "DRAFT" | "WRITE" | "FINANCIAL" | "ADMIN";
  defaultAuthority: "ALLOW" | "APPROVAL_REQUIRED" | "BLOCK";
  risk: IntegrationRisk;
  evidenceSource: string;
};

export type IntegrationDescriptor = {
  provider: IntegrationProvider;
  label: string;
  auth: "OAUTH2" | "API_KEY" | "WEBHOOK";
  status: "FOUNDATION_ONLY";
  secretHandling: "SERVER_SECRET_STORE_REQUIRED";
  capabilities: IntegrationCapability[];
};

const cap = (actionKey: string, label: string, mode: IntegrationCapability["mode"], defaultAuthority: IntegrationCapability["defaultAuthority"], risk: IntegrationRisk, evidenceSource: string): IntegrationCapability => ({ actionKey, label, mode, defaultAuthority, risk, evidenceSource });

export const AGENT_AUTHORITY_INTEGRATION_CATALOG: readonly IntegrationDescriptor[] = [
  { provider: "gmail", label: "Gmail", auth: "OAUTH2", status: "FOUNDATION_ONLY", secretHandling: "SERVER_SECRET_STORE_REQUIRED", capabilities: [
    cap("gmail.message.read", "Read message metadata/content", "READ", "ALLOW", "MEDIUM", "Gmail message id + history id"),
    cap("gmail.draft.create", "Create draft", "DRAFT", "ALLOW", "MEDIUM", "Gmail draft id"),
    cap("gmail.message.send", "Send message", "WRITE", "APPROVAL_REQUIRED", "HIGH", "Gmail sent message id"),
    cap("gmail.message.delete", "Delete message", "WRITE", "BLOCK", "HIGH", "Gmail history id"),
  ]},
  { provider: "google_drive", label: "Google Drive", auth: "OAUTH2", status: "FOUNDATION_ONLY", secretHandling: "SERVER_SECRET_STORE_REQUIRED", capabilities: [
    cap("drive.file.read", "Read file", "READ", "ALLOW", "MEDIUM", "Drive file id + revision"),
    cap("drive.file.create", "Create file", "WRITE", "APPROVAL_REQUIRED", "MEDIUM", "Drive file id"),
    cap("drive.file.share", "Change sharing", "ADMIN", "APPROVAL_REQUIRED", "HIGH", "Drive permission id"),
    cap("drive.file.delete", "Delete file", "WRITE", "BLOCK", "HIGH", "Drive change token"),
  ]},
  { provider: "slack", label: "Slack", auth: "OAUTH2", status: "FOUNDATION_ONLY", secretHandling: "SERVER_SECRET_STORE_REQUIRED", capabilities: [
    cap("slack.message.read", "Read channel messages", "READ", "ALLOW", "MEDIUM", "Slack channel + ts"),
    cap("slack.message.send", "Send message", "WRITE", "APPROVAL_REQUIRED", "MEDIUM", "Slack channel + ts"),
    cap("slack.message.delete", "Delete message", "WRITE", "BLOCK", "HIGH", "Slack channel + ts"),
  ]},
  { provider: "hubspot", label: "HubSpot", auth: "OAUTH2", status: "FOUNDATION_ONLY", secretHandling: "SERVER_SECRET_STORE_REQUIRED", capabilities: [
    cap("hubspot.contact.read", "Read contact", "READ", "ALLOW", "MEDIUM", "HubSpot object id"),
    cap("hubspot.contact.update", "Update contact", "WRITE", "APPROVAL_REQUIRED", "HIGH", "HubSpot object id + updatedAt"),
    cap("hubspot.deal.update", "Update deal", "WRITE", "APPROVAL_REQUIRED", "HIGH", "HubSpot deal id + updatedAt"),
    cap("hubspot.object.delete", "Delete CRM object", "WRITE", "BLOCK", "CRITICAL", "HubSpot object id"),
  ]},
  { provider: "quickbooks", label: "QuickBooks Online", auth: "OAUTH2", status: "FOUNDATION_ONLY", secretHandling: "SERVER_SECRET_STORE_REQUIRED", capabilities: [
    cap("quickbooks.invoice.read", "Read invoice", "READ", "ALLOW", "HIGH", "QuickBooks entity id + SyncToken"),
    cap("quickbooks.invoice.create", "Create invoice", "FINANCIAL", "APPROVAL_REQUIRED", "HIGH", "QuickBooks entity id + SyncToken"),
    cap("quickbooks.payment.create", "Create payment", "FINANCIAL", "BLOCK", "CRITICAL", "QuickBooks payment id"),
  ]},
  { provider: "stripe", label: "Stripe", auth: "API_KEY", status: "FOUNDATION_ONLY", secretHandling: "SERVER_SECRET_STORE_REQUIRED", capabilities: [
    cap("stripe.customer.read", "Read customer", "READ", "ALLOW", "HIGH", "Stripe object id + request id"),
    cap("stripe.invoice.create", "Create invoice", "FINANCIAL", "APPROVAL_REQUIRED", "HIGH", "Stripe invoice id + request id"),
    cap("stripe.refund.create", "Issue refund", "FINANCIAL", "BLOCK", "CRITICAL", "Stripe refund id + request id"),
    cap("stripe.payment.capture", "Capture payment", "FINANCIAL", "BLOCK", "CRITICAL", "Stripe payment intent id + request id"),
  ]},
  { provider: "n8n", label: "n8n", auth: "API_KEY", status: "FOUNDATION_ONLY", secretHandling: "SERVER_SECRET_STORE_REQUIRED", capabilities: [
    cap("n8n.workflow.trigger", "Trigger workflow", "WRITE", "APPROVAL_REQUIRED", "HIGH", "n8n execution id"),
    cap("n8n.workflow.modify", "Modify workflow", "ADMIN", "BLOCK", "CRITICAL", "n8n workflow version"),
  ]},
  { provider: "make", label: "Make", auth: "API_KEY", status: "FOUNDATION_ONLY", secretHandling: "SERVER_SECRET_STORE_REQUIRED", capabilities: [
    cap("make.scenario.run", "Run scenario", "WRITE", "APPROVAL_REQUIRED", "HIGH", "Make execution id"),
    cap("make.scenario.modify", "Modify scenario", "ADMIN", "BLOCK", "CRITICAL", "Make scenario version"),
  ]},
  { provider: "zapier", label: "Zapier", auth: "OAUTH2", status: "FOUNDATION_ONLY", secretHandling: "SERVER_SECRET_STORE_REQUIRED", capabilities: [
    cap("zapier.action.invoke", "Invoke approved action", "WRITE", "APPROVAL_REQUIRED", "HIGH", "Zapier run/action id"),
    cap("zapier.workflow.modify", "Modify automation", "ADMIN", "BLOCK", "CRITICAL", "Zapier workflow version"),
  ]},
] as const;

export function getIntegrationDescriptor(provider: IntegrationProvider): IntegrationDescriptor {
  const descriptor = AGENT_AUTHORITY_INTEGRATION_CATALOG.find((item) => item.provider === provider);
  if (!descriptor) throw new Error(`Unsupported integration provider: ${provider}`);
  return descriptor;
}

export function assertFoundationOnlyIntegration(provider: IntegrationProvider): never {
  throw new Error(`${getIntegrationDescriptor(provider).label} execution is not enabled; Agent Authority currently exposes governance architecture only`);
}
