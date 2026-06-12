export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}

export function detectCountry(): string {
  try {
    const tz = detectTimezone();
    if (/Kolkata|Calcutta/.test(tz))                                       return 'India';
    if (/Karachi/.test(tz))                                                return 'Pakistan';
    if (/Dhaka/.test(tz))                                                  return 'Bangladesh';
    if (/Colombo/.test(tz))                                                return 'Sri Lanka';
    if (/Kathmandu/.test(tz))                                              return 'Nepal';
    if (/Dubai|Abu_Dhabi|Muscat/.test(tz))                                 return 'UAE';
    if (/Singapore/.test(tz))                                              return 'Singapore';
    if (/Kuala_Lumpur/.test(tz))                                           return 'Malaysia';
    if (/London/.test(tz))                                                 return 'United Kingdom';
    if (/New_York|Chicago|Los_Angeles|Denver|Phoenix|Anchorage/.test(tz))  return 'United States';
    if (/Toronto|Vancouver|Winnipeg/.test(tz))                             return 'Canada';
    if (/Sydney|Melbourne|Brisbane|Perth|Adelaide/.test(tz))               return 'Australia';
    if (/Auckland/.test(tz))                                               return 'New Zealand';
    if (/Berlin|Frankfurt/.test(tz))                                       return 'Germany';
    if (/Paris/.test(tz))                                                  return 'France';
    if (/Riyadh/.test(tz))                                                 return 'Saudi Arabia';
    if (/Doha/.test(tz))                                                   return 'Qatar';
  } catch { /* fall through */ }
  return '';
}
