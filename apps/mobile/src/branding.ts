/**
 * Shop branding helpers — pure (no React, no SQL) so the on-screen preview and
 * the printed/PDF receipt derive exactly the same content from a Store, and so
 * it can be unit-tested under node.
 */
import type { ReceiptPaper } from './repos';

export const DEFAULT_ACCENT = '#0ca678';
export const DEFAULT_FOOTER = 'Thank you for your business!';

export const ACCENT_PRESETS = ['#0ca678', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#dc2626', '#0891b2', '#111827'];

export const PAPER_OPTIONS: { key: ReceiptPaper; label: string; hint: string }[] = [
  { key: 'a4', label: 'A4 invoice', hint: 'Full page, laser / PDF' },
  { key: 'thermal80', label: '80 mm', hint: 'Thermal roll' },
  { key: 'thermal58', label: '58 mm', hint: 'Small thermal roll' },
];

/** The accent ends up inside CSS, so only ever accept a plain #rrggbb value. */
export function safeAccent(input: string | null | undefined): string {
  const v = (input ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : DEFAULT_ACCENT;
}

/** Best text colour (white or near-black) on top of a given accent. */
export function onAccent(accent: string): string {
  const h = safeAccent(accent).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (0.299 * r! + 0.587 * g! + 0.114 * b!) / 255;
  return lum > 0.62 ? '#111827' : '#ffffff';
}

export interface ContactFields {
  address?: string | null; phone?: string | null; email?: string | null; website?: string | null;
}

/** Non-empty contact lines in the order they should print. */
export function contactLines(c: ContactFields): string[] {
  return [c.address, c.phone, c.email, c.website].map((v) => (v ?? '').trim()).filter(Boolean);
}

export function shopInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
}

/** Page width in CSS pixels / PDF points for each paper option (A4 handled by @page). */
export const THERMAL_WIDTH_PT: Record<Exclude<ReceiptPaper, 'a4'>, number> = { thermal80: 226, thermal58: 164 };

export function normalizeUrl(v: string): string {
  return v.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

/** Currencies offered at setup. Locales are English variants so digits stay Latin everywhere. */
export const CURRENCIES: { code: string; locale: string; name: string }[] = [
  { code: 'USD', locale: 'en-US', name: 'US dollar' },
  { code: 'EUR', locale: 'en-IE', name: 'Euro' },
  { code: 'GBP', locale: 'en-GB', name: 'British pound' },
  { code: 'CAD', locale: 'en-CA', name: 'Canadian dollar' },
  { code: 'AUD', locale: 'en-AU', name: 'Australian dollar' },
  { code: 'INR', locale: 'en-IN', name: 'Indian rupee' },
  { code: 'AED', locale: 'en-AE', name: 'UAE dirham' },
  { code: 'SAR', locale: 'en-SA', name: 'Saudi riyal' },
  { code: 'ZAR', locale: 'en-ZA', name: 'South African rand' },
  { code: 'PKR', locale: 'en-PK', name: 'Pakistani rupee' },
];

const EURO_REGIONS = new Set(['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI', 'GR', 'LU', 'SK', 'SI', 'EE', 'LV', 'LT', 'MT', 'CY', 'HR']);
const REGION_CURRENCY: Record<string, string> = { US: 'USD', CA: 'CAD', GB: 'GBP', AU: 'AUD', IN: 'INR', AE: 'AED', SA: 'SAR', ZA: 'ZAR', PK: 'PKR' };

/** Best-guess setup currency from a device locale tag such as "en-GB". Falls back to USD. */
export function defaultCurrencyFor(localeTag: string | null | undefined): string {
  const region = (localeTag ?? '').split(/[-_]/)[1]?.toUpperCase();
  if (!region) return 'USD';
  if (EURO_REGIONS.has(region)) return 'EUR';
  return REGION_CURRENCY[region] ?? 'USD';
}

export function localeForCurrency(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.locale ?? 'en-US';
}
