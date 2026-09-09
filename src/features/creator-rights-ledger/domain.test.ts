import { describe, expect, it } from 'vitest'
import {
  calculateLifecycleStatus,
  calculateRightsHealth,
  type RightsGrant,
} from './domain'

describe('Creator Rights Ledger lifecycle', () => {
  it('keeps explicit denials distinct from expiration', () => {
    expect(calculateLifecycleStatus('NOT_GRANTED')).toBe('NOT_GRANTED')
  })

  it('keeps uncertainty explicit', () => {
    expect(calculateLifecycleStatus('UNCLEAR')).toBe('UNCLEAR')
  })

  it('recognizes perpetual grants', () => {
    expect(calculateLifecycleStatus('GRANTED', null, true)).toBe('PERPETUAL')
  })

  it('marks rights expiring inside the warning window', () => {
    expect(calculateLifecycleStatus('GRANTED', '2026-10-01', false, 30, new Date('2026-09-09'))).toBe(
      'EXPIRING_SOON',
    )
  })

  it('marks elapsed rights expired', () => {
    expect(calculateLifecycleStatus('GRANTED', '2026-09-01', false, 30, new Date('2026-09-09'))).toBe(
      'EXPIRED',
    )
  })
})

describe('Rights Health', () => {
  it('prioritizes potential conflict without declaring breach', () => {
    expect(
      calculateRightsHealth({ agreementPresent: true, statuses: ['ACTIVE'], possibleConflict: true }),
    ).toBe('POSSIBLE_CONFLICT')
  })

  it('requires attention for unclear rights or a missing agreement', () => {
    expect(calculateRightsHealth({ agreementPresent: true, statuses: ['UNCLEAR'] })).toBe(
      'NEEDS_ATTENTION',
    )
    expect(calculateRightsHealth({ agreementPresent: false, statuses: ['ACTIVE'] })).toBe(
      'NEEDS_ATTENTION',
    )
  })

  it('reports clear only when recorded state has no current issue', () => {
    expect(calculateRightsHealth({ agreementPresent: true, statuses: ['ACTIVE', 'PERPETUAL'] })).toBe(
      'CLEAR',
    )
  })
})

// Compile-time shape guard for the atomic-rights model.
const sampleGrant: RightsGrant = {
  id: 'right-1',
  organizationId: 'org-1',
  agreementId: 'agreement-1',
  assetId: 'asset-1',
  brandId: 'brand-1',
  rightType: 'PAID_MEDIA',
  permissionStatus: 'GRANTED',
  startDate: '2026-09-09',
  endDate: '2026-12-08',
  isPerpetual: false,
  platformScope: ['Instagram'],
  territoryScope: ['US'],
  renewalAvailable: true,
  notes: null,
}

void sampleGrant
