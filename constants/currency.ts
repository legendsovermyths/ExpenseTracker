import { useExpensifyStore } from "../store/store";

export type CompactUnits = "indian" | "western";

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  /** Short labels in charts: 1.2L / 2.5Cr (indian) vs 120k / 25M (western). */
  units: CompactUnits;
}

export const DEFAULT_CURRENCY_CODE = "INR";
export const CURRENCY_CONSTANT_KEY = "currency";

export const CURRENCIES: Currency[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", units: "indian" },
  { code: "USD", symbol: "$", name: "US Dollar", units: "western" },
  { code: "EUR", symbol: "€", name: "Euro", units: "western" },
  { code: "GBP", symbol: "£", name: "British Pound", units: "western" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", units: "western" },
  { code: "CNY", symbol: "CN¥", name: "Chinese Yuan", units: "western" },
  { code: "AED", symbol: "AED ", name: "UAE Dirham", units: "western" },
  { code: "SAR", symbol: "SAR ", name: "Saudi Riyal", units: "western" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", units: "western" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", units: "western" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", units: "western" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", units: "western" },
  { code: "CHF", symbol: "CHF ", name: "Swiss Franc", units: "western" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", units: "western" },
  { code: "KRW", symbol: "₩", name: "South Korean Won", units: "western" },
  { code: "THB", symbol: "฿", name: "Thai Baht", units: "western" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", units: "western" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", units: "western" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso", units: "western" },
  { code: "PKR", symbol: "Rs ", name: "Pakistani Rupee", units: "indian" },
  { code: "LKR", symbol: "Rs ", name: "Sri Lankan Rupee", units: "western" },
  { code: "NPR", symbol: "Rs ", name: "Nepalese Rupee", units: "indian" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", units: "indian" },
  { code: "ZAR", symbol: "R", name: "South African Rand", units: "western" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", units: "western" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling", units: "western" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", units: "western" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", units: "western" },
  { code: "RUB", symbol: "₽", name: "Russian Ruble", units: "western" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", units: "western" },
];

export const getCurrency = (code?: string | null): Currency =>
  CURRENCIES.find((c) => c.code === code) ??
  (CURRENCIES.find((c) => c.code === DEFAULT_CURRENCY_CODE) as Currency);

/** Every symbol we know about, longest first, for stripping from search input. */
export const ALL_CURRENCY_SYMBOLS = Array.from(
  new Set(CURRENCIES.map((c) => c.symbol.trim())),
).sort((a, b) => b.length - a.length);

/** Reactive: components re-render when the user changes currency. */
export const useCurrency = (): Currency =>
  getCurrency(
    useExpensifyStore((s) => s.getAppconstantByKey(CURRENCY_CONSTANT_KEY)?.value),
  );

/** Non-reactive snapshot for services and non-component helpers. */
export const getActiveCurrency = (): Currency =>
  getCurrency(
    useExpensifyStore.getState().getAppconstantByKey(CURRENCY_CONSTANT_KEY)?.value,
  );

export const getCurrencySymbol = (): string => getActiveCurrency().symbol;
