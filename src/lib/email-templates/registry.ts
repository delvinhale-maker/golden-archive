import type { ComponentType } from 'react'
import { template as sellerApplicationReceived } from './seller-application-received'
import { template as sellerApplicationApproved } from './seller-application-approved'
import { template as sellerApplicationRejected } from './seller-application-rejected'

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
}
