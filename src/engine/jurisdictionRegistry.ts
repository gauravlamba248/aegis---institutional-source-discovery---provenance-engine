import { JurisdictionCode, JurisdictionProfile } from './types';

export const JURISDICTION_REGISTRY: Record<string, JurisdictionProfile> = {
  IN: {
    code: 'IN',
    countryName: 'India',
    primaryRegulators: ['SEBI (Securities and Exchange Board of India)', 'MCA (Ministry of Corporate Affairs)', 'RBI (Reserve Bank of India)'],
    exchanges: ['BSE (Bombay Stock Exchange)', 'NSE (National Stock Exchange of India)'],
    corporateRegistries: ['MCA21 Corporate Registry (CIN)', 'ROC (Registrar of Companies)'],
    accountingStandards: ['Ind AS (Indian Accounting Standards)', 'IFRS Converged'],
    defaultCurrency: 'INR',
    filingTypes: ['Integrated Annual Report', 'Clause 41 / Reg 33 Quarterly Financial Results', 'MCA Form AOC-4 / MGT-7', 'BSE/NSE Corporate Announcements', 'DRHP / RHP'],
    searchTemplates: [
      '"{company}" BSE corporate filings financial results',
      '"{company}" NSE shareholding pattern financial statements',
      '"{company}" SEBI regulatory disclosures',
      '"{company}" MCA CIN AOC-4 annual return',
      '"{company}" integrated annual report FY2025 PDF'
    ]
  },
  US: {
    code: 'US',
    countryName: 'United States',
    primaryRegulators: ['SEC (U.S. Securities and Exchange Commission)', 'FINRA'],
    exchanges: ['NASDAQ', 'NYSE (New York Stock Exchange)'],
    corporateRegistries: ['SEC EDGAR (CIK)', 'Delaware Division of Corporations'],
    accountingStandards: ['US GAAP'],
    defaultCurrency: 'USD',
    filingTypes: ['Form 10-K (Annual Report)', 'Form 10-Q (Quarterly Report)', 'Form 8-K (Current Report)', 'DEF 14A (Proxy Statement)', 'Form S-1'],
    searchTemplates: [
      '"{company}" SEC EDGAR Form 10-K annual report',
      '"{company}" Form 10-Q quarterly financial statements',
      '"{company}" Form 8-K earnings release',
      '"{company}" investor relations XBRL financial tables'
    ]
  },
  UK: {
    code: 'UK',
    countryName: 'United Kingdom & Netherlands (Dual/European)',
    primaryRegulators: ['FCA (Financial Conduct Authority)', 'FRC (Financial Reporting Council)'],
    exchanges: ['LSE (London Stock Exchange)', 'Euronext Amsterdam', 'NYSE ADR'],
    corporateRegistries: ['UK Companies House', 'National Storage Mechanism (NSM)'],
    accountingStandards: ['UK-adopted IFRS', 'IFRS'],
    defaultCurrency: 'USD',
    filingTypes: ['Annual Report and Accounts', 'Companies House Full Accounts Filing', 'RNS Regulatory News Service Announcement', 'Form 20-F'],
    searchTemplates: [
      '"{company}" Companies House full accounts filing',
      '"{company}" London Stock Exchange RNS financial results',
      '"{company}" FCA National Storage Mechanism annual report PDF'
    ]
  },
  JP: {
    code: 'JP',
    countryName: 'Japan',
    primaryRegulators: ['FSA Japan (Financial Services Agency)', 'EDINET'],
    exchanges: ['TSE (Tokyo Stock Exchange Prime)', 'NYSE ADR'],
    corporateRegistries: ['EDINET Electronic Disclosure System', 'Ministry of Justice Corporate Registry'],
    accountingStandards: ['IFRS', 'J-GAAP'],
    defaultCurrency: 'JPY',
    filingTypes: ['Yuho (Annual Securities Report / Yukashoken Hokokusho)', 'Kessan Tanshin (Consolidated Financial Results)', 'Integrated Report', 'SEC Form 20-F'],
    searchTemplates: [
      '"{company}" EDINET Yukashoken Hokokusho securities report',
      '"{company}" TSE Kessan Tanshin financial results PDF',
      '"{company}" investor relations FY2025 financial summary'
    ]
  },
  KR: {
    code: 'KR',
    countryName: 'South Korea',
    primaryRegulators: ['FSS (Financial Supervisory Service)', 'FSC Korea'],
    exchanges: ['KRX (Korea Exchange / KOSPI)', 'LSE GDR'],
    corporateRegistries: ['DART (Data Analysis, Retrieval and Transfer System)'],
    accountingStandards: ['K-IFRS (Korean International Financial Reporting Standards)'],
    defaultCurrency: 'KRW',
    filingTypes: ['DART Annual Business Report (Saeopbogoseo)', 'Consolidated Audit Report', 'Quarterly Earnings Release'],
    searchTemplates: [
      '"{company}" DART FSS business report consolidated financial statements',
      '"{company}" KRX KOSPI regulatory disclosures',
      '"{company}" investor relations audited financial statements PDF'
    ]
  },
  DE: {
    code: 'DE',
    countryName: 'Germany (European Union)',
    primaryRegulators: ['BaFin (Federal Financial Supervisory Authority)', 'ESMA'],
    exchanges: ['XETRA / Frankfurt Stock Exchange (FWB)'],
    corporateRegistries: ['Unternehmensregister (German Company Register)', 'Bundesanzeiger (Federal Gazette)'],
    accountingStandards: ['IFRS (EU-endorsed)', 'HGB (German Commercial Code)'],
    defaultCurrency: 'EUR',
    filingTypes: ['Konzernabschluss (Consolidated Annual Financial Report)', 'Halbjahresfinanzbericht', 'Ad-hoc Disclosure (WpHG)'],
    searchTemplates: [
      '"{company}" BaFin Unternehmensregister Konzernabschluss',
      '"{company}" XETRA Frankfurt Stock Exchange annual report PDF',
      '"{company}" investor relations IFRS consolidated statements'
    ]
  },
  CN_HK: {
    code: 'CN_HK',
    countryName: 'China / Hong Kong SAR (Dual Primary)',
    primaryRegulators: ['SFC Hong Kong', 'SEC (Foreign Private Issuer)', 'CSRC'],
    exchanges: ['HKEX (Hong Kong Stock Exchange)', 'NYSE'],
    corporateRegistries: ['HKEXnews Disclosure Easy', 'SEC EDGAR (Form 20-F)'],
    accountingStandards: ['US GAAP', 'IFRS'],
    defaultCurrency: 'CNY',
    filingTypes: ['HKEX Annual Report', 'SEC Form 20-F', 'Interim Results Announcement'],
    searchTemplates: [
      '"{company}" HKEXnews annual report financial statements',
      '"{company}" SEC EDGAR Form 20-F',
      '"{company}" quarterly results announcement PDF'
    ]
  },
  NL: {
    code: 'NL',
    countryName: 'Netherlands',
    primaryRegulators: ['AFM (Dutch Authority for the Financial Markets)', 'ESMA', 'SEC (Form 20-F Foreign Private Issuer)'],
    exchanges: ['Euronext Amsterdam', 'NASDAQ'],
    corporateRegistries: ['KVK (Netherlands Chamber of Commerce Handelsregister)', 'AFM Financial Reporting Registry'],
    accountingStandards: ['IFRS (EU-endorsed)', 'US GAAP'],
    defaultCurrency: 'EUR',
    filingTypes: ['Statutory Annual Report (Jaarverslag)', 'SEC Form 20-F', 'Half-Year Financial Report'],
    searchTemplates: [
      '"{company}" AFM Euronext Amsterdam annual report IFRS',
      '"{company}" SEC EDGAR Form 20-F',
      '"{company}" investor relations consolidated financial statements PDF'
    ]
  },
  GLOBAL_OSS: {
    code: 'GLOBAL_OSS',
    countryName: 'Global Open-Source Foundation',
    primaryRegulators: ['Open-Source Foundation Technical Oversight Committee'],
    exchanges: ['GitHub Official Organization', 'Official Source Repository'],
    corporateRegistries: ['Open-Source Foundation Project Registry', 'SPDX / OpenSSF Scorecard'],
    accountingStandards: ['Open-Source Repository Telemetry Metrics'],
    defaultCurrency: 'USD',
    filingTypes: ['Official Project Release Notes', 'GitHub Repository Metadata', 'Technical Documentation Specification'],
    searchTemplates: [
      '"{company}" official documentation architecture specification',
      '"{company}" GitHub repository release notes contributors telemetry'
    ]
  },
  JURISDICTION_UNRESOLVED: {
    code: 'JURISDICTION_UNRESOLVED',
    countryName: 'JURISDICTION_UNRESOLVED',
    primaryRegulators: ['International / Cross-Border Securities Filings', 'IFRS Foundation / SEC Form 20-F'],
    exchanges: ['International Stock Exchange / Cross-Listing'],
    corporateRegistries: ['International Corporate Registry'],
    accountingStandards: ['IFRS', 'US GAAP'],
    defaultCurrency: 'USD',
    filingTypes: ['Audited Annual Report', 'SEC Form 20-F Foreign Private Issuer', 'Consolidated Financial Statements'],
    searchTemplates: [
      '"{company}" official annual report consolidated financial statements',
      '"{company}" investor relations audited financial statements PDF'
    ]
  }
};

export function getJurisdictionProfile(
  code: JurisdictionCode,
  countryName?: string,
  defaultCurrency?: string
): JurisdictionProfile {
  const existing = JURISDICTION_REGISTRY[code];
  if (existing) {
    if (
      countryName &&
      countryName !== existing.countryName &&
      code !== 'GLOBAL_OSS' &&
      code !== 'JURISDICTION_UNRESOLVED'
    ) {
      return {
        ...existing,
        countryName
      };
    }
    return existing;
  }

  const resolvedCountry = countryName || code || 'JURISDICTION_UNRESOLVED';
  const currencyByCode: Record<string, string> = {
    TW: 'TWD',
    BR: 'BRL',
    AU: 'AUD',
    DK: 'DKK',
    NO: 'NOK',
    ES: 'EUR',
    FR: 'EUR',
    IT: 'EUR',
    CH: 'CHF',
    SE: 'SEK',
    SG: 'SGD',
    CA: 'CAD',
    GB: 'GBP'
  };
  return {
    code,
    countryName: resolvedCountry,
    primaryRegulators: [`${resolvedCountry} National Securities Regulator`, 'IOSCO / IFRS Foundation'],
    exchanges: [`${resolvedCountry} Primary Stock Exchange`, 'International ADR / Global Listing'],
    corporateRegistries: [`${resolvedCountry} Official Corporate Registry`],
    accountingStandards: ['IFRS', 'US GAAP'],
    defaultCurrency: defaultCurrency || currencyByCode[code] || 'USD',
    filingTypes: ['Audited Annual Report', 'Consolidated Financial Statements', 'SEC Form 20-F / Exchange Filing'],
    searchTemplates: [
      `"{company}" ${resolvedCountry} official annual report consolidated financial statements`,
      `"{company}" investor relations audited financial statements PDF`
    ]
  };
}
