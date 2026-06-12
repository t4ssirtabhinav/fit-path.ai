export const CURRENCY_INFO: Record<string, { symbol: string; tiers: [number, number, number] }> = {
  'India':          { symbol: '₹',   tiers: [500, 1500, 3000] },
  'United States':  { symbol: '$',   tiers: [20, 50, 100] },
  'United Kingdom': { symbol: '£',   tiers: [15, 40, 80] },
  'Canada':         { symbol: 'C$',  tiers: [25, 65, 130] },
  'Australia':      { symbol: 'A$',  tiers: [30, 75, 150] },
  'UAE':            { symbol: 'AED', tiers: [75, 200, 400] },
  'Singapore':      { symbol: 'S$',  tiers: [25, 70, 140] },
  'New Zealand':    { symbol: 'NZ$', tiers: [30, 80, 160] },
  'Pakistan':       { symbol: '₨',   tiers: [3000, 8000, 15000] },
  'Bangladesh':     { symbol: '৳',   tiers: [2000, 5000, 10000] },
  'Sri Lanka':      { symbol: 'Rs',  tiers: [4000, 10000, 20000] },
  'Nepal':          { symbol: 'Rs',  tiers: [3000, 8000, 15000] },
  'Germany':        { symbol: '€',   tiers: [20, 50, 100] },
  'Netherlands':    { symbol: '€',   tiers: [20, 50, 100] },
  'France':         { symbol: '€',   tiers: [20, 50, 100] },
  'Italy':          { symbol: '€',   tiers: [20, 50, 100] },
  'Spain':          { symbol: '€',   tiers: [20, 50, 100] },
  'Switzerland':    { symbol: 'CHF', tiers: [25, 60, 120] },
  'Sweden':         { symbol: 'kr',  tiers: [200, 500, 1000] },
  'Norway':         { symbol: 'kr',  tiers: [200, 500, 1000] },
  'Qatar':          { symbol: 'QR',  tiers: [75, 200, 400] },
  'Kuwait':         { symbol: 'KD',  tiers: [7, 18, 35] },
  'Saudi Arabia':   { symbol: 'SR',  tiers: [75, 200, 400] },
  'Bahrain':        { symbol: 'BD',  tiers: [7, 18, 35] },
  'Oman':           { symbol: 'OMR', tiers: [7, 18, 35] },
  'Malaysia':       { symbol: 'RM',  tiers: [80, 220, 450] },
  'South Africa':   { symbol: 'R',   tiers: [350, 900, 1800] },
  'Kenya':          { symbol: 'KSh', tiers: [2500, 6500, 13000] },
  'Nigeria':        { symbol: '₦',   tiers: [8000, 20000, 40000] },
  'Ireland':        { symbol: '€',   tiers: [20, 50, 100] },
};

export const DEFAULT_CURRENCY: { symbol: string; tiers: [number, number, number] } = { symbol: '$', tiers: [20, 50, 100] };

export function getSupplementBudgetOptions(country: string): { value: string; label: string }[] {
  const { symbol, tiers } = CURRENCY_INFO[country] ?? DEFAULT_CURRENCY;
  const [t1, t2, t3] = tiers;
  return [
    { value: 'under_500', label: `Under ${symbol}${t1.toLocaleString()}` },
    { value: '500_1500',  label: `${symbol}${t1.toLocaleString()}–${symbol}${t2.toLocaleString()}` },
    { value: '1500_3000', label: `${symbol}${t2.toLocaleString()}–${symbol}${t3.toLocaleString()}` },
    { value: 'no_limit',  label: 'No strict limit' },
  ];
}
