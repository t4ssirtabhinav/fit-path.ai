import { SOUTH_ASIA_COUNTRIES, MIDDLE_EAST_COUNTRIES, SOUTHEAST_ASIA_COUNTRIES } from './countries';

export const COMMON_CUISINE_OPTIONS = [
  { id: 'continental',  label: 'Continental / Western' },
  { id: 'high_protein', label: 'High-protein snacks' },
  { id: 'quick_prep',   label: 'Quick / low-effort meals' },
];

export function getCuisineOptions(country: string): { id: string; label: string }[] {
  if (SOUTH_ASIA_COUNTRIES.includes(country)) {
    return [
      { id: 'north_indian',    label: 'North Indian' },
      { id: 'south_indian',    label: 'South Indian' },
      { id: 'bengali',         label: 'Bengali / East Indian' },
      { id: 'gujarati',        label: 'Gujarati / Rajasthani' },
      { id: 'maharashtrian',   label: 'Maharashtrian' },
      ...COMMON_CUISINE_OPTIONS,
    ];
  }
  if (MIDDLE_EAST_COUNTRIES.includes(country)) {
    return [
      { id: 'levantine',   label: 'Levantine (Lebanese, Syrian)' },
      { id: 'gulf',        label: 'Gulf / Khaleeji' },
      { id: 'egyptian',    label: 'Egyptian / North African' },
      { id: 'south_asian', label: 'South Asian' },
      ...COMMON_CUISINE_OPTIONS,
    ];
  }
  if (SOUTHEAST_ASIA_COUNTRIES.includes(country)) {
    return [
      { id: 'malay',   label: 'Malay' },
      { id: 'chinese', label: 'Chinese' },
      { id: 'indian',  label: 'Indian' },
      { id: 'thai',    label: 'Thai / Southeast Asian' },
      ...COMMON_CUISINE_OPTIONS,
    ];
  }
  return [
    { id: 'mediterranean', label: 'Mediterranean' },
    { id: 'asian',         label: 'Asian-inspired' },
    { id: 'latin',         label: 'Latin American' },
    ...COMMON_CUISINE_OPTIONS,
  ];
}
