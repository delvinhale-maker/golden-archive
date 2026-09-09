import { differenceInCalendarDays, parseISO } from 'date-fns'

export type PermissionStatus = 'GRANTED' | 'NOT_GRANTED' | 'UNCLEAR'
export type LifecycleStatus =
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'PERPETUAL'
  | 'NOT_GRANTED'
  | 'UNCLEAR'

export type RightsHealth = 'CLEAR' | 'NEEDS_ATTENTION' | 'POSSIBLE_CONFLICT'

export type RightType =
  | 'ORGANIC_USAGE'
  | 'PAID_MEDIA'
  | 'CREATOR_HANDLE_ADVERTISING'
  | 'WEBSITE'
  | 'EMAIL'
  | 'ECOMMERCE'
  | 'RETAIL'
  | 'BROADCAST'
  | 'RAW_FOOTAGE'
  | 'EDITING_DERIVATIVES'
  | 'LIKENESS'
  | 'NAME'
  | 'VOICE'
  | 'AI_TRAINING'
  | 'SYNTHETIC_CONTENT'
  | 'VOICE_CLONE'
  | 'DIGITAL_REPLICA'
  | 'EXCLUSIVITY'
  | 'TERRITORY'
  | 'SUBLICENSING'
  | 'PERPETUITY'
  | 'CUSTOM'

export interface RightsGrant {
  id: string
  organizationId: string
  agreementId: string | null
  assetId: string
  brandId: string
  rightType: RightType
  permissionStatus: PermissionStatus
  startDate: string | null
  endDate: string | null
  isPerpetual: boolean
  platformScope: string[]
  territoryScope: string[]
  renewalAvailable: boolean
  notes: string | null
}

export function calculateLifecycleStatus(
  permission: PermissionStatus,
  endDate?: string | null,
  isPerpetual = false,
  warningDays = 30,
  now = new Date(),
): LifecycleStatus {
  if (permission === 'NOT_GRANTED') return 'NOT_GRANTED'
  if (permission === 'UNCLEAR') return 'UNCLEAR'
  if (isPerpetual) return 'PERPETUAL'
  if (!endDate) return 'ACTIVE'

  const days = differenceInCalendarDays(parseISO(endDate), now)
  if (days < 0) return 'EXPIRED'
  if (days <= warningDays) return 'EXPIRING_SOON'
  return 'ACTIVE'
}

export function calculateRightsHealth(input: {
  agreementPresent: boolean
  statuses: LifecycleStatus[]
  possibleConflict?: boolean
}): RightsHealth {
  if (input.possibleConflict) return 'POSSIBLE_CONFLICT'
  if (
    !input.agreementPresent ||
    input.statuses.some((status) => status === 'UNCLEAR' || status === 'EXPIRING_SOON')
  ) {
    return 'NEEDS_ATTENTION'
  }
  return 'CLEAR'
}

export function canSilentlyReplaceMaterialRight(previous: RightsGrant, next: RightsGrant) {
  return JSON.stringify(previous) === JSON.stringify(next)
}

export const CRL_WORKFLOW = [
  'REGISTER',
  'DOCUMENT',
  'LICENSE',
  'MONITOR',
  'ALERT',
  'RENEW',
  'PROTECT',
] as const
