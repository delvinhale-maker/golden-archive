import type { AgentPermission, AgentLimits } from "./types";

export interface AgentAuthorityTemplate {
  key: string;
  name: string;
  description: string;
  permissions: AgentPermission[];
  limits: AgentLimits;
}

const baseLimits: AgentLimits = {
  currency: "USD",
  maxSinglePurchase: 0,
  maxDailySpend: 0,
  maxRefund: 0,
  maxInvoice: 0,
  externalCommunicationPolicy: "APPROVAL_REQUIRED",
  financialActionsPolicy: "BLOCK",
  sensitiveDataPolicy: "BLOCK",
  highRiskRequiresApproval: true,
  allowedSystems: [],
  blockedSystems: [],
};

const permission = (
  actionKey: string,
  label: string,
  decision: AgentPermission["decision"],
  system?: string,
): AgentPermission => ({ actionKey, label, decision, system: system ?? null, approvalRole: "APPROVER" });

export const authorityTemplates: AgentAuthorityTemplate[] = [
  {
    key: "marketing",
    name: "Marketing Agent",
    description: "Drafts and prepares marketing content with controlled publishing authority.",
    limits: { ...baseLimits, externalCommunicationPolicy: "APPROVAL_REQUIRED" },
    permissions: [
      permission("drive.read", "Read approved Drive files", "ALLOW", "Google Drive"),
      permission("marketing.draft", "Draft marketing content", "ALLOW"),
      permission("social.publish", "Publish social content", "APPROVAL_REQUIRED", "Social Media"),
      permission("email.customer.send", "Send customer email", "APPROVAL_REQUIRED", "Email"),
      permission("customer.delete", "Delete customer", "BLOCK", "CRM"),
    ],
  },
  {
    key: "sales",
    name: "Sales Agent",
    description: "Researches accounts, drafts proposals and maintains CRM notes without independent financial authority.",
    limits: { ...baseLimits, maxSinglePurchase: 100, maxDailySpend: 250, maxInvoice: 2500 },
    permissions: [
      permission("email.read", "Read email", "ALLOW", "Email"),
      permission("email.draft", "Draft email", "ALLOW", "Email"),
      permission("email.customer.send", "Send customer email", "APPROVAL_REQUIRED", "Email"),
      permission("crm.read", "Read CRM", "ALLOW", "CRM"),
      permission("crm.note.add", "Add CRM note", "ALLOW", "CRM"),
      permission("crm.customer.modify", "Modify customer", "APPROVAL_REQUIRED", "CRM"),
      permission("customer.delete", "Delete customer", "BLOCK", "CRM"),
      permission("proposal.send", "Send proposal", "APPROVAL_REQUIRED", "CRM"),
    ],
  },
  {
    key: "customer-service",
    name: "Customer Service Agent",
    description: "Reads support context and drafts responses while keeping refunds and destructive actions controlled.",
    limits: { ...baseLimits, maxRefund: 0 },
    permissions: [
      permission("customer.read", "Read customer profile", "ALLOW", "CRM"),
      permission("order.read", "Read order", "ALLOW", "Commerce"),
      permission("support.reply.draft", "Draft support reply", "ALLOW", "Support"),
      permission("support.reply.send", "Send support reply", "APPROVAL_REQUIRED", "Support"),
      permission("refund.issue", "Issue refund", "BLOCK", "Payments"),
      permission("customer.delete", "Delete customer", "BLOCK", "CRM"),
    ],
  },
  {
    key: "executive-assistant",
    name: "Executive Assistant Agent",
    description: "Manages calendars and drafts communications with no independent purchasing authority.",
    limits: { ...baseLimits },
    permissions: [
      permission("calendar.read", "Read calendar", "ALLOW", "Calendar"),
      permission("calendar.schedule", "Schedule meeting", "ALLOW", "Calendar"),
      permission("email.draft", "Draft email", "ALLOW", "Email"),
      permission("email.external.send", "Send external email", "APPROVAL_REQUIRED", "Email"),
      permission("purchase.initiate", "Initiate purchase", "BLOCK", "Payments"),
    ],
  },
  {
    key: "accounting",
    name: "Accounting Agent",
    description: "Prepares financial records and invoices without independent movement of funds.",
    limits: { ...baseLimits, maxInvoice: 5000, financialActionsPolicy: "APPROVAL_REQUIRED" },
    permissions: [
      permission("invoice.create", "Create invoice", "ALLOW", "Accounting"),
      permission("invoice.send", "Send invoice", "APPROVAL_REQUIRED", "Accounting"),
      permission("transaction.read", "Read transaction records", "ALLOW", "Accounting"),
      permission("payment.initiate", "Initiate payment", "APPROVAL_REQUIRED", "Payments"),
      permission("account.delete", "Delete financial account", "BLOCK", "Accounting"),
    ],
  },
  {
    key: "recruiting",
    name: "Recruiting Agent",
    description: "Coordinates candidates and drafts outreach without autonomous hiring decisions.",
    limits: { ...baseLimits, sensitiveDataPolicy: "APPROVAL_REQUIRED" },
    permissions: [
      permission("candidate.read", "Read candidate record", "ALLOW", "ATS"),
      permission("candidate.outreach.draft", "Draft candidate outreach", "ALLOW", "Email"),
      permission("candidate.outreach.send", "Send candidate outreach", "APPROVAL_REQUIRED", "Email"),
      permission("interview.schedule", "Schedule interview", "ALLOW", "Calendar"),
      permission("candidate.reject", "Reject candidate", "APPROVAL_REQUIRED", "ATS"),
    ],
  },
  {
    key: "social-media",
    name: "Social Media Agent",
    description: "Creates social content with human-controlled publishing and account settings.",
    limits: { ...baseLimits },
    permissions: [
      permission("social.draft", "Draft social post", "ALLOW", "Social Media"),
      permission("social.publish", "Publish social post", "APPROVAL_REQUIRED", "Social Media"),
      permission("social.reply", "Reply publicly", "APPROVAL_REQUIRED", "Social Media"),
      permission("social.delete", "Delete published post", "APPROVAL_REQUIRED", "Social Media"),
      permission("social.account.modify", "Modify account settings", "BLOCK", "Social Media"),
    ],
  },
  {
    key: "research",
    name: "Research Agent",
    description: "Researches approved sources while preventing destructive or external actions.",
    limits: { ...baseLimits, externalCommunicationPolicy: "BLOCK" },
    permissions: [
      permission("web.research", "Research public web", "ALLOW", "Web"),
      permission("drive.read", "Read approved Drive files", "ALLOW", "Google Drive"),
      permission("research.summary", "Create research summary", "ALLOW"),
      permission("email.external.send", "Send external email", "BLOCK", "Email"),
      permission("record.delete", "Delete source record", "BLOCK"),
    ],
  },
  {
    key: "operations",
    name: "Operations Agent",
    description: "Coordinates routine operations with approval gates around external and financial changes.",
    limits: { ...baseLimits, maxSinglePurchase: 100, maxDailySpend: 250 },
    permissions: [
      permission("task.read", "Read operational tasks", "ALLOW", "Project Management"),
      permission("task.update", "Update operational task", "ALLOW", "Project Management"),
      permission("calendar.schedule", "Schedule meeting", "ALLOW", "Calendar"),
      permission("vendor.contact", "Contact vendor", "APPROVAL_REQUIRED", "Email"),
      permission("purchase.initiate", "Initiate purchase", "APPROVAL_REQUIRED", "Payments"),
    ],
  },
  {
    key: "invoice",
    name: "Invoice Agent",
    description: "Creates invoices and queues delivery while protecting payment and customer deletion actions.",
    limits: { ...baseLimits, maxInvoice: 2500 },
    permissions: [
      permission("customer.read", "Read customer billing profile", "ALLOW", "CRM"),
      permission("invoice.create", "Create invoice", "ALLOW", "Accounting"),
      permission("invoice.send", "Send invoice", "APPROVAL_REQUIRED", "Accounting"),
      permission("payment.capture", "Capture payment", "BLOCK", "Payments"),
      permission("refund.issue", "Issue refund", "BLOCK", "Payments"),
    ],
  },
];

export const salesAgent03Demo = {
  agentName: "Sales Agent 03",
  templateKey: "sales",
  limits: {
    ...baseLimits,
    maxSinglePurchase: 100,
    maxRefund: 0,
    externalCommunicationPolicy: "APPROVAL_REQUIRED" as const,
    financialActionsPolicy: "BLOCK" as const,
    sensitiveDataPolicy: "BLOCK" as const,
  },
};
