/**
 * Commercial banks by country for vendor registration.
 * Used to populate bank dropdown based on selected country.
 */

export const BANKS_NIGERIA: string[] = [
  "Access Bank Limited",
  "Fidelity Bank Plc",
  "First City Monument Bank Limited",
  "First Bank of Nigeria Limited",
  "Guaranty Trust Bank Limited",
  "United Bank for Africa Plc",
  "Zenith Bank Plc",
  "Citibank Nigeria Limited",
  "Ecobank Nigeria Limited",
  "Heritage Bank Plc",
  "Globus Bank Limited",
  "Keystone Bank Limited",
  "Polaris Bank Limited",
  "Stanbic IBTC Bank Limited",
  "Standard Chartered Bank Nigeria",
  "Sterling Bank Limited",
  "Titan Trust Bank Limited",
  "Union Bank of Nigeria Plc",
  "Unity Bank Plc",
  "Wema Bank Plc",
  "Premium Trust Bank Limited",
  "Optimus Bank Limited",
  "Providus Bank Limited",
  "Parallex Bank Limited",
  "Suntrust Bank Nigeria Limited",
  "Signature Bank Limited",
  "Jaiz Bank Plc",
  "Taj Bank Limited",
  "Kuda Bank",
  "OPay",
  "Palmpay",
].sort((a, b) => a.localeCompare(b));

export const BANKS_UNITED_STATES: string[] = [
  "JPMorgan Chase Bank",
  "Bank of America",
  "Citibank",
  "Wells Fargo Bank",
  "U.S. Bank",
  "Capital One",
  "Goldman Sachs Bank USA",
  "PNC Bank",
  "Truist Bank",
  "Bank of New York Mellon",
  "State Street Bank",
  "TD Bank",
  "Morgan Stanley Bank",
  "BMO Bank",
  "Charles Schwab Bank",
  "Ally Bank",
  "Discover Bank",
  "American Express National Bank",
  "Fifth Third Bank",
  "KeyBank",
  "Citizens Bank",
  "M&T Bank",
  "Regions Bank",
  "Huntington Bank",
  "First Republic Bank",
  "Silicon Valley Bank",
  "Navy Federal Credit Union",
  "USAA",
  "Capital One 360",
  "Chase",
].sort((a, b) => a.localeCompare(b));

export const BANKS_UNITED_KINGDOM: string[] = [
  "Barclays",
  "HSBC UK",
  "Lloyds Bank",
  "NatWest",
  "Santander UK",
  "Standard Chartered",
  "Nationwide Building Society",
  "TSB Bank",
  "Virgin Money",
  "Metro Bank",
  "Starling Bank",
  "Monzo Bank",
  "Revolut",
  "First Direct",
  "Clydesdale Bank",
  "Yorkshire Bank",
].sort((a, b) => a.localeCompare(b));

export const BANKS_GHANA: string[] = [
  "Ecobank Ghana",
  "Standard Chartered Bank Ghana",
  "Barclays Bank Ghana",
  "Ghana Commercial Bank",
  "Stanbic Bank Ghana",
  "Zenith Bank Ghana",
  "United Bank for Africa Ghana",
  "Access Bank Ghana",
  "Fidelity Bank Ghana",
  "CalBank",
  "Republic Bank Ghana",
  "FBNBank Ghana",
  "Guaranty Trust Bank Ghana",
  "OmniBSIC Bank",
  "Prudential Bank",
  "Bank of Africa Ghana",
].sort((a, b) => a.localeCompare(b));

export const BANKS_SOUTH_AFRICA: string[] = [
  "Standard Bank",
  "First National Bank",
  "Nedbank",
  "Absa Bank",
  "Capitec Bank",
  "Investec Bank",
  "Discovery Bank",
  "TymeBank",
  "African Bank",
  "Bidvest Bank",
].sort((a, b) => a.localeCompare(b));

/** Country code (ISO 3166-1) to list of bank names */
export const BANKS_BY_COUNTRY: Record<string, string[]> = {
  NG: BANKS_NIGERIA,
  US: BANKS_UNITED_STATES,
  GB: BANKS_UNITED_KINGDOM,
  GH: BANKS_GHANA,
  ZA: BANKS_SOUTH_AFRICA,
};

/**
 * Get bank list for a country code. Returns empty array if country has no predefined list.
 */
export function getBanksForCountry(countryCode: string): string[] {
  return BANKS_BY_COUNTRY[countryCode] ?? [];
}

/**
 * Whether the country has a predefined bank list (show dropdown vs free text).
 */
export function hasBankListForCountry(countryCode: string): boolean {
  return countryCode in BANKS_BY_COUNTRY && (BANKS_BY_COUNTRY[countryCode]?.length ?? 0) > 0;
}
