export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export function today(timezone: string = DEFAULT_TIMEZONE): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

export function yesterday(timezone: string = DEFAULT_TIMEZONE): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: timezone });
}

export function getDayName(date: Date | string, timezone: string = DEFAULT_TIMEZONE): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }).toLowerCase() as string;
}

export function calcBMI(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

export function getBMILabel(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}
