/** Public pages on the Dosely site (apps/web marketing routes). */
export const SITE_URL = 'https://getdosely.vercel.app';

export const links = {
  privacy: `${SITE_URL}/privacy`,
  support: `${SITE_URL}/support`,
  terms: `${SITE_URL}/terms`,
  themes: `${SITE_URL}/themes`,
} as const;

export const MEDICAL_DISCLAIMER =
  'Dosely is a reminder tool, not medical advice. Always follow your prescriber and pharmacist. ' +
  'In an emergency, call your local emergency number.';
