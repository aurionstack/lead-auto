// Canonical Lead Recovery business-policy boundary.
// The compatibility module remains at lib/campaign.ts while callers migrate incrementally.
export {
  ACTIVE_CAMPAIGN,
  campaignSequenceId,
  isHomeServiceCategory,
  isUnitedStatesLocation,
  validateCampaignTarget,
} from '@/lib/campaign';
