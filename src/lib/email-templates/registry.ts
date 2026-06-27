import type { ComponentType } from 'react'
import { template as sellerApplicationReceived } from './seller-application-received'
import { template as sellerApplicationApproved } from './seller-application-approved'
import { template as sellerApplicationRejected } from './seller-application-rejected'
import { template as orderDelivery } from './order-delivery'
import { template as coverAuditAlert } from './cover-audit-alert'
import { template as productReviewUpdate } from './product-review-update'
import { template as subscriberConfirmation } from './subscriber-confirmation'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'seller-application-received': sellerApplicationReceived,
  'seller-application-approved': sellerApplicationApproved,
  'seller-application-rejected': sellerApplicationRejected,
  'order-delivery': orderDelivery,
  'cover-audit-alert': coverAuditAlert,
  'product-review-update': productReviewUpdate,
}
