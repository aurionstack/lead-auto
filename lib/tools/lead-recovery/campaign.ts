export const ACTIVE_CAMPAIGN = {
  code: 'us-home-services-pilot',
  name: 'AurionStack Lead Recovery',
  market: 'United States',
  offer: 'Missed Lead Recovery System',
  idealCompanySize: '5–50 employees',
  qualificationThreshold: 70,
  followUps: [
    { step: 1, delayDays: 1 },
    { step: 2, delayDays: 3 },
  ],
  targets: [
    { category: 'HVAC contractors', location: 'Dallas, Texas', maxResults: 50, channel: 'email' as const },
    { category: 'Plumbing contractors', location: 'Dallas, Texas', maxResults: 50, channel: 'email' as const },
  ],
} as const;

export function campaignSequenceId(step: 'initial' | 1 | 2): string {
  return `${ACTIVE_CAMPAIGN.code}:${step === 'initial' ? step : `follow-up-${step}`}`;
}

const US_LOCATION_PATTERN = /\b(?:united states|usa|u\.s\.|alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i;
const US_STATE_OR_ZIP_PATTERN = /(?:\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b|\b\d{5}(?:-\d{4})?\b)/i;
const HOME_SERVICE_PATTERN = /\b(?:hvac|heating|air conditioning|plumb(?:er|ing)?|roof(?:er|ing)?|garage[ -]?door)\b/i;

export function validateCampaignTarget(category: string, location: string): string | null {
  if (!isUnitedStatesLocation(location)) return 'This pilot is limited to United States locations.';
  if (!isHomeServiceCategory(category)) return 'This pilot is limited to HVAC, plumbing, roofing, and garage-door companies.';
  return null;
}

export function isHomeServiceCategory(category: string | null | undefined): boolean {
  return Boolean(category && HOME_SERVICE_PATTERN.test(category));
}

export function isUnitedStatesLocation(location: string | null | undefined): boolean {
  return Boolean(location && (US_LOCATION_PATTERN.test(location) || US_STATE_OR_ZIP_PATTERN.test(location)));
}
