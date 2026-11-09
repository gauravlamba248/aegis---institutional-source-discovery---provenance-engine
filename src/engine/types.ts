export type SourceTier =
  | 'TIER_1_OFFICIAL'
  | 'TIER_2_REGULATOR_EXCHANGE'
  | 'TIER_3_SPECIALIST_FINANCIAL'
  | 'TIER_4_REPUTABLE_SECONDARY'
  | 'TIER_5_GENERAL_REFERENCE'
  | 'TIER_6_LOW_VALUE';

export type SourceType =
  | 'OFFICIAL_COMPANY'
  | 'REGULATOR'
  | 'STOCK_EXCHANGE'
  | 'GOVERNMENT_REGISTRY'
  | 'FINANCIAL_DATABASE'
  | 'SPECIALIST_FINANCIAL'
  | 'REPUTABLE_NEWS'
  | 'INDUSTRY_PUBLICATION'
  | 'RESEARCH'
  | 'GENERAL_REFERENCE'
  | 'LOW_VALUE'
  | 'IRRELEVANT';

export type AuthorityLevel =
  | 'VERY_HIGH'
  | 'HIGH'
  | 'MEDIUM_HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'UNTRUSTED';

export type AnalysisIntent =
  | 'FINANCIAL_ANALYSIS'
  | 'COMPANY_OVERVIEW'
  | 'COMPETITIVE_ANALYSIS'
  | 'TECHNOLOGY_ANALYSIS'
  | 'MARKET_ANALYSIS';

export type EntityResolutionStatus =
  | 'VERIFIED'
  | 'AMBIGUOUS — CLARIFICATION REQUIRED'
  | 'UNRESOLVED';

export type ZeroSourceDiagnosticCode =
  | 'NONE'
  | 'NO_ENTITY_RESOLVED'
  | 'AMBIGUOUS_ENTITY_CLARIFICATION_REQUIRED'
  | 'NO_AUTHORITATIVE_SOURCE_DISCOVERED'
  | 'SOURCES_REJECTED_ENTITY_MISMATCH'
  | 'NETWORK_RETRIEVAL_FAILED'
  | 'EXTRACTION_FAILED'
  | 'RATE_LIMITED';

export type SourceLifecycleStage =
  | 'REQUESTED'
  | 'DISCOVERED'
  | 'CANDIDATE'
  | 'SELECTED'
  | 'FETCHED'
  | 'PARSED'
  | 'PRODUCED_FACT'
  | 'USED_IN_ANALYSIS'
  | 'NO_FACT'
  | 'ACCESSED'
  | 'EXTRACTED'
  | 'VALIDATED'
  | 'USED'
  | 'REJECTED';

export type JurisdictionCode =
  | 'IN'
  | 'US'
  | 'UK'
  | 'JP'
  | 'KR'
  | 'DE'
  | 'NL'
  | 'EU'
  | 'CN_HK'
  | 'GLOBAL_OSS'
  | 'JURISDICTION_UNRESOLVED'
  | (string & {});

export interface JurisdictionProfile {
  code: JurisdictionCode;
  countryName: string;
  primaryRegulators: string[];
  exchanges: string[];
  corporateRegistries: string[];
  accountingStandards: string[];
  defaultCurrency: string;
  filingTypes: string[];
  searchTemplates: string[];
}

export interface HttpRetrievalTelemetry {
  url: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string;
  bytesReceived: number;
  latencyMs: number;
  sha256Hash: string;
  ssrfChecked: boolean;
  tlsVerified: boolean;
  sanitized: boolean;
  retrievedAt: string;
  parserUsed: string;
  parseSuccess: boolean;
  error?: string;
}

export interface MissingMetricRecord {
  metricKey: string;
  metricLabel: string;
  status: 'DATA_UNAVAILABLE';
  reason: string;
  attemptedSources: string[];
}

export interface AnalysisConfidenceBreakdown {
  entityConfidence: number; // 0 - 100
  sourceConfidence: number; // 0 - 100
  dataConfidence: number; // 0 - 100
  calculationConfidence: number; // 0 - 100
  overallConfidence: number; // 0 - 100
  confidenceGrade: 'HIGH_INSTITUTIONAL' | 'MODERATE_VERIFIED' | 'LOW_PARTIAL' | 'INSUFFICIENT_EVIDENCE';
  limitingFactors: string[];
}

export interface EntityCandidate {
  entityId: string;
  canonicalName: string;
  legalName: string;
  entityType: 'PUBLIC_COMPANY' | 'UNLISTED_PUBLIC_HOLDING' | 'PRIVATE_COMPANY' | 'OPEN_SOURCE_PROJECT';
  jurisdiction: JurisdictionCode;
  country: string;
  jurisdictionConfidence?: number;
  jurisdictionEvidence?: string[];
  tickers: string[];
  exchanges: string[];
  isin?: string;
  lei?: string;
  cinOrRegId?: string;
  cik?: string;
  wikidataId?: string;
  wikipediaSlug?: string;
  screenerUrl?: string;
  screenerStandaloneUrl?: string;
  officialDomain: string;
  investorRelationsUrl?: string;
  parentEntity?: string;
  siblingEntitiesExcluded: string[];
  aliases: string[];
  sector: string;
  confidenceScore: number;
  matchRationale: string[];
  discoveryChannelsUsed?: string[];
}

export interface EntityResolutionResult {
  rawQuery: string;
  extractedTarget: string;
  detectedIntent: AnalysisIntent;
  status: EntityResolutionStatus;
  resolvedEntity: EntityCandidate | null;
  candidatesConsidered: EntityCandidate[];
  rejectedSubstitutions: {
    name: string;
    legalName: string;
    reason: string;
  }[];
  ambiguityClarificationPrompt?: string;
  liveProbesAttempted?: string[];
}

export interface DeepWebCrawlNode {
  depth: number;
  label: string;
  url: string;
  nodeType:
    | 'HOMEPAGE'
    | 'INVESTOR_RELATIONS'
    | 'FINANCIAL_RESULTS'
    | 'ANNUAL_REPORTS'
    | 'QUARTERLY_REPORTS'
    | 'PRESENTATIONS'
    | 'REGULATORY_FILINGS'
    | 'PDF_DOCUMENT';
  status: 'DISCOVERED' | 'EXTRACTED' | 'SKIPPED';
  extractedItemsCount: number;
  httpStatus?: number;
  bytesReceived?: number;
}

export interface DiscoveredDocument {
  documentId: string;
  title: string;
  documentType:
    | 'PDF_ANNUAL_REPORT'
    | 'QUARTERLY_EARNINGS_RELEASE'
    | 'INVESTOR_PRESENTATION'
    | 'REGULATORY_FILING'
    | 'FINANCIAL_STATEMENTS'
    | 'CORPORATE_GOVERNANCE'
    | 'TECHNICAL_SPECIFICATION';
  url: string;
  parentSourceUrl: string;
  fiscalPeriod: string;
  publicationDate: string;
  fileSizeKb: number;
  httpStatus?: number;
  contentType?: string;
  sha256Hash?: string;
  extractedSections: {
    tablesCount: number;
    statements: string[];
    notesAndFootnotes: string[];
    segments: string[];
    managementCommentary: string;
    riskFactors: string[];
    unitsAndDefinitions: string;
  };
}

export interface SourceQualityBreakdown {
  authority: number; // 0 - 25
  entityMatch: number; // 0 - 20
  relevance: number; // 0 - 15
  dataDepth: number; // 0 - 12
  freshness: number; // 0 - 8
  primarySourceBonus: number; // 0 - 8
  jurisdictionMatch: number; // 0 - 6
  crossVerification: number; // 0 - 6
  duplicationPenalty: number; // 0 - 25
  seoContentFarmPenalty: number; // 0 - 35
  lowCredibilityPenalty: number; // 0 - 30
  totalScore: number; // Clamped 0 - 100
}

export interface EntityMatchEvaluation {
  score: number; // 0 - 100
  isExactEntity: boolean;
  isSiblingOrParentContamination: boolean;
  matchedSignals: string[];
  conflictingSignals: string[];
  explanation: string;
}

export interface DiscoveredSource {
  source_id: string;
  url: string;
  domain: string;
  title: string;
  snippet: string;
  search_rank_order: number;
  source_type: SourceType;
  tier: SourceTier;
  authority_level: AuthorityLevel;
  jurisdiction: JurisdictionCode;
  entity_match: number; // 0 - 100 percentage
  entity_match_evaluation: EntityMatchEvaluation;
  information_types: string[];
  publication_date: string;
  retrieval_date: string;
  quality_score: number;
  quality_breakdown: SourceQualityBreakdown;
  selected: boolean;
  lifecycle_stage: SourceLifecycleStage;
  selection_reason: string[];
  rejection_reason: string[];
  linked_documents: DiscoveredDocument[];
  raw_extracted_kb: number;
  http_telemetry?: HttpRetrievalTelemetry;
}

export interface FallbackRecord {
  metric: string;
  tier1Available: boolean;
  tier2Available: boolean;
  selectedTier: SourceTier;
  selectedSourceType: SourceType;
  sourceQualityLabel: string;
  confidenceScore: number;
  reason: string;
}

export type MetricKey =
  | 'revenue'
  | 'net_income'
  | 'ebitda'
  | 'operating_income'
  | 'eps'
  | 'total_assets'
  | 'total_liabilities'
  | 'shareholders_equity'
  | 'operating_cash_flow'
  | 'free_cash_flow'
  | 'capex'
  | 'cash_and_equivalents'
  | 'total_debt'
  | 'current_assets'
  | 'current_liabilities'
  | 'retained_earnings'
  | 'market_cap'
  | 'book_value'
  | 'roe_pct'
  | 'operating_margin_pct'
  | 'industry_market_share'
  | 'github_stars'
  | 'contributors_count';

export interface ProvenancedFact {
  fact_id: string;
  entity: string;
  entity_id: string;
  metric: string;
  metric_key: MetricKey;
  value: number;
  prior_year_value?: number;
  formatted_value: string;
  currency: string;
  unit: string;
  period: string;
  fiscal_year: string;
  consolidation_basis: 'CONSOLIDATED' | 'STANDALONE' | 'GROUP_AGGREGATE' | 'N/A';
  accounting_standard: string;
  fact_class: 'PRIMARY_FACT' | 'SECONDARY_REPORTING';
  source_id: string;
  source_title: string;
  source_type: SourceType;
  source_tier: SourceTier;
  url: string;
  actual_source_id?: string;
  actual_origin_url?: string;
  retrieval_status?: number;
  document_hash?: string;
  document: string;
  page_or_section: string;
  extraction_method: string;
  exact_quote?: string;
  period_end?: string;
  period_type?: 'ANNUAL' | 'QUARTERLY' | 'TTM' | 'SNAPSHOT';
  validation_status?:
    | 'VALIDATED'
    | 'UNVALIDATED'
    | 'REJECTED'
    | 'REJECTED_UNVERIFIED'
    | 'INCOMPATIBLE_PERIOD'
    | 'SPOOFED_PROVENANCE';
  confidence?: number;
  verification_status:
    | 'VERIFIED_MULTI_SOURCE'
    | 'RECONCILED_ACROSS_STANDARDS'
    | 'VERIFIED_PRIMARY_FILING'
    | 'SECONDARY_FALLBACK';
  fallback_record?: FallbackRecord;
}

export interface CrossVerificationCandidateValue {
  source_id: string;
  source_title: string;
  source_type: SourceType;
  tier: SourceTier;
  raw_value: number;
  formatted_value: string;
  currency: string;
  unit: string;
  period: string;
  consolidation_basis: 'CONSOLIDATED' | 'STANDALONE';
  metric_basis: 'REPORTED_GAAP_INDAS' | 'ADJUSTED_NON_GAAP';
  accounting_standard: string;
  publication_date: string;
}

export interface CrossVerificationAudit {
  metric_key: string;
  metric_label: string;
  status:
    | 'SINGLE_SOURCE'
    | 'EXACT_CONSENSUS'
    | 'RECONCILED_DISCREPANCY'
    | 'PRIMARY_AUTHORITY_OVERRIDE'
    | 'DISAGREEMENT';
  final_value: number;
  final_formatted: string;
  currency: string;
  unit: string;
  period: string;
  candidate_values: CrossVerificationCandidateValue[];
  discrepancy_investigation: {
    detected: boolean;
    root_causes: string[];
    reconciliation_explanation: string;
    winning_source_id: string;
  };
}

export interface FinancialModelOutput {
  altmanZScore: {
    available: boolean;
    score: number | null;
    zone: 'SAFE_ZONE' | 'GREY_ZONE' | 'DISTRESS_ZONE' | 'NOT_APPLICABLE';
    formulaVariant: string;
    components: {
      label: string;
      value: string;
      provenanceFactId?: string;
    }[];
    missingInputs: string[];
  };
  piotroskiFScore: {
    available: boolean;
    score: number | null;
    maxScore: number;
    strengthLabel: string;
    criteria: {
      name: string;
      category: 'PROFITABILITY' | 'LEVERAGE_LIQUIDITY' | 'OPERATING_EFFICIENCY';
      passed: boolean;
      detail: string;
    }[];
  };
  dupontAnalysis: {
    available: boolean;
    roePct: number | null;
    netProfitMarginPct: number | null;
    assetTurnover: number | null;
    equityMultiplier: number | null;
    interpretation: string;
  };
  keyRatios: {
    label: string;
    value: string;
    benchmarkNote: string;
    provenanceFactIds: string[];
  }[];
  qualitativeSynthesis: {
    primaryFactsSummary: string[];
    secondaryReportingInsights: {
      topic: string;
      insight: string;
      sourceTitle: string;
      sourceType: SourceType;
      factClass: 'SECONDARY_REPORTING';
    }[];
  };
  analysisConfidence?: AnalysisConfidenceBreakdown;
  missingMetrics?: MissingMetricRecord[];
}

export interface LedgerSummaryStats {
  requestedMaxSources: number;
  totalDiscoveredCandidates: number;
  retrievedSourcesCount?: number;
  parsedSourcesCount?: number;
  entityVerifiedCount?: number;
  selectedSourcesCount: number;
  actuallyUsedCount?: number;
  rejectedSourcesCount: number;
  uniqueDomainsSelected: number;
  rawExtractedKb: number;
  overallDataQuality: 'INSTITUTIONAL_GRADE' | 'HIGH_VERIFIED' | 'PARTIAL_SECONDARY' | 'INSUFFICIENT';
  zeroSourceDiagnostic: {
    code: ZeroSourceDiagnosticCode;
    headline: string;
    detailedExplanation: string;
    remediationSteps: string[];
  };
}

export interface AegisPipelineRun {
  runId: string;
  timestamp: string;
  executionMode?: 'LIVE_NETWORK' | 'DETERMINISTIC_OFFLINE';
  query: string;
  intent: AnalysisIntent;
  maxSourcesRequested: number;
  entityResolution: EntityResolutionResult;
  jurisdictionProfile: JurisdictionProfile | null;
  targetedSearchQueries: {
    category: 'COMPANY_SPECIFIC' | 'JURISDICTION_REGULATORY' | 'DEEP_DOCUMENT_PDF' | 'SPECIALIST_AND_SECONDARY';
    query: string;
    purpose: string;
  }[];
  deepWebCrawlTree: DeepWebCrawlNode[];
  discoveredDocuments: DiscoveredDocument[];
  sourceLedger: DiscoveredSource[];
  selectedSources: DiscoveredSource[];
  provenancedFacts: ProvenancedFact[];
  missingMetrics?: MissingMetricRecord[];
  crossVerifications: CrossVerificationAudit[];
  fallbackRecords: FallbackRecord[];
  financialAnalysis: FinancialModelOutput;
  analysisConfidence?: AnalysisConfidenceBreakdown;
  httpTelemetry?: HttpRetrievalTelemetry[];
  ledgerStats: LedgerSummaryStats;
}

export interface RegressionTestResult {
  testEntityQuery: string;
  expectedCategory: string;
  executionMode?: 'LIVE' | 'HYBRID' | 'MOCKED';
  resolvedStatus: EntityResolutionStatus;
  resolvedCanonicalName: string;
  resolvedLegalName: string;
  jurisdiction: string;
  regulatorsUsed: string[];
  discoveredCount: number;
  selectedCount: number;
  tier1Count: number;
  tier2Count: number;
  wikipediaSelectedAsPrimaryFinancial: boolean;
  siblingContaminationBlocked: boolean;
  topSourceTitle: string;
  topSourceScore: number;
  verifiedRevenueFormatted: string;
  qualityGrade: string;
  passedAllInvariants: boolean;
}
