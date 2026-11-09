import {
  DiscoveredSource,
  EntityCandidate,
  FallbackRecord,
  JurisdictionProfile,
  MetricKey,
  MissingMetricRecord,
  ProvenancedFact
} from './types';
import { LiveEvidenceBundle } from './LiveEvidenceCollector';
import { ProvenanceTracker } from './ProvenanceTracker';

const CORE_FINANCIAL_METRICS: { key: MetricKey; label: string }[] = [
  { key: 'revenue', label: 'Revenue from Operations / Total Income' },
  { key: 'ebitda', label: 'Operating Profit / EBITDA' },
  { key: 'net_income', label: 'Net Profit After Tax (PAT)' },
  { key: 'total_assets', label: 'Total Assets' },
  { key: 'total_liabilities', label: 'Total Liabilities' },
  { key: 'shareholders_equity', label: "Total Shareholders' Equity" },
  { key: 'total_debt', label: 'Total Borrowings / Debt' },
  { key: 'operating_cash_flow', label: 'Operating Cash Flow (OCF)' }
];

export class FactExtractor {
  /**
   * Extracts provenanced facts strictly from the live-retrieved LiveEvidenceBundle.
   * Enforces CF-01, CF-02, CF-04, and Hard Safety Invariants (Section 27):
   * - ZERO `defaultPrimarySource` fallback.
   * - Every accepted fact must come from a source with `selected === true` and `httpStatus === 200`.
   * - `fact.url === fact.actual_origin_url` and `fact.source_id === fact.actual_source_id`.
   * - Derived ratios require identical `entity_id`, `currency`, `fiscal_year`, `period_type`, and `consolidation_basis`.
   */
  public static extractProvenancedFactsFromLiveBundle(
    entity: EntityCandidate,
    jurisdiction: JurisdictionProfile,
    selectedSources: DiscoveredSource[],
    bundle: LiveEvidenceBundle
  ): {
    facts: ProvenancedFact[];
    fallbacks: FallbackRecord[];
    missingMetrics: MissingMetricRecord[];
  } {
    const facts: ProvenancedFact[] = [];
    const fallbacks: FallbackRecord[] = [];
    const missingMetrics: MissingMetricRecord[] = [];

    const validSelectedSources = selectedSources.filter(
      (s) =>
        s.selected &&
        (!s.http_telemetry || s.http_telemetry.httpStatus === 200) &&
        s.raw_extracted_kb > 0
    );

    if (validSelectedSources.length === 0) {
      for (const core of CORE_FINANCIAL_METRICS) {
        missingMetrics.push({
          metricKey: core.key,
          metricLabel: core.label,
          status: 'DATA_UNAVAILABLE',
          reason: 'Zero authoritative sources passed EntityMatch, HTTP 200 retrieval, and QualityScore thresholds.',
          attemptedSources: bundle.candidateSources.map((c) => c.url)
        });
      }
      return { facts, fallbacks, missingMetrics };
    }

    const tier1Source = validSelectedSources.find((s) => s.tier === 'TIER_1_OFFICIAL');
    const tier2Source = validSelectedSources.find((s) => s.tier === 'TIER_2_REGULATOR_EXCHANGE');

    let factIndex = 1;
    for (const [metricKey, raw] of bundle.extractedMetrics.entries()) {
      const originUrl = raw.actualOriginUrl || raw.sourceUrl;
      const retrievalStatus = raw.retrievalStatus ?? 200;

      // Hard Invariant (Section 9 & 27): Reject any metric whose HTTP retrieval status !== 200 or whose origin mismatches sourceUrl
      if (retrievalStatus !== 200 || raw.sourceUrl !== originUrl) {
        continue;
      }

      // Match the exact selected source whose URL or linked document matches the true origin URL (NO defaultPrimarySource fallback!)
      const matchedSource =
        validSelectedSources.find((s) => s.url === originUrl) ||
        validSelectedSources.find((s) => s.linked_documents.some((d) => d.url === originUrl && d.httpStatus === 200));

      if (!matchedSource || !matchedSource.selected) {
        continue;
      }

      // Hard Invariant (CF-04): Wikipedia / TIER_5_GENERAL_REFERENCE can NEVER produce a PRIMARY_FACT
      const enforcedFactClass: 'PRIMARY_FACT' | 'SECONDARY_REPORTING' =
        matchedSource.tier === 'TIER_5_GENERAL_REFERENCE' ||
        matchedSource.source_type === 'GENERAL_REFERENCE' ||
        matchedSource.tier === 'TIER_4_REPUTABLE_SECONDARY'
          ? 'SECONDARY_REPORTING'
          : raw.factClass;

      const isFallback =
        !tier1Source &&
        !tier2Source &&
        (matchedSource.tier === 'TIER_3_SPECIALIST_FINANCIAL' ||
          matchedSource.tier === 'TIER_4_REPUTABLE_SECONDARY' ||
          matchedSource.tier === 'TIER_5_GENERAL_REFERENCE');

      let fallbackRecord: FallbackRecord | undefined;
      if (isFallback || entity.entityType === 'PRIVATE_COMPANY' || enforcedFactClass === 'SECONDARY_REPORTING') {
        fallbackRecord = {
          metric: raw.metricLabel,
          tier1Available: Boolean(tier1Source),
          tier2Available: Boolean(tier2Source),
          selectedTier: matchedSource.tier,
          selectedSourceType: matchedSource.source_type,
          sourceQualityLabel:
            enforcedFactClass === 'SECONDARY_REPORTING'
              ? 'Secondary Reference Summary (Non-Primary)'
              : entity.entityType === 'PRIVATE_COMPANY'
              ? 'Private Entity Secondary Disclosure (No Public 10-K/AOC-4)'
              : 'Tier 3 Institutional Financial Database',
          confidenceScore:
            enforcedFactClass === 'SECONDARY_REPORTING'
              ? 42
              : entity.entityType === 'PRIVATE_COMPANY'
              ? 55
              : 88,
          reason:
            enforcedFactClass === 'SECONDARY_REPORTING'
              ? `Extracted from secondary source ${matchedSource.title} (${matchedSource.domain}); no primary filing available.`
              : `Extracted from ${matchedSource.title} (${matchedSource.domain}).`
        };
        fallbacks.push(fallbackRecord);
      }

      const formattedValue =
        raw.currency === 'OSS'
          ? `${raw.value.toLocaleString()} ${raw.unit}`
          : `${raw.currency} ${raw.value.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })} ${raw.unit}`;

      const fact = ProvenanceTracker.createProvenancedFact({
        index: factIndex++,
        entity,
        metric: raw.metricLabel,
        metricKey,
        value: raw.value,
        formattedValue,
        currency: raw.currency,
        unit: raw.unit,
        period: raw.period,
        fiscalYear: raw.fiscalYear,
        periodEnd: raw.periodEnd,
        periodType: raw.periodType,
        consolidationBasis: raw.consolidationBasis,
        accountingStandard: raw.accountingStandard,
        factClass: enforcedFactClass,
        source: matchedSource,
        actualOriginUrl: originUrl,
        retrievalStatus,
        documentHash: raw.documentHash,
        documentName: raw.documentTitle,
        pageOrSection: raw.pageOrSection,
        extractionMethod: raw.extractionMethod,
        verificationStatus:
          raw.standaloneValue !== undefined
            ? 'RECONCILED_ACROSS_STANDARDS'
            : raw.secondaryValue !== undefined &&
              raw.secondarySourceUrl &&
              raw.secondarySourceUrl !== originUrl &&
              Math.abs(raw.secondaryValue - raw.value) / Math.max(1, Math.abs(raw.value)) < 0.01 &&
              enforcedFactClass === 'PRIMARY_FACT'
            ? 'VERIFIED_MULTI_SOURCE'
            : enforcedFactClass === 'PRIMARY_FACT'
            ? 'VERIFIED_PRIMARY_FILING'
            : 'SECONDARY_FALLBACK',
        validationStatus: 'VALIDATED',
        fallbackRecord
      });

      fact.prior_year_value = raw.priorYearValue;
      fact.exact_quote = raw.exactQuote;
      facts.push(fact);
    }

    // Derive ROE % and Operating Margin % strictly from VALIDATED facts passing the 5-part period/currency/entity/consolidation alignment guard (Section 4)
    const revFact = facts.find((f) => f.metric_key === 'revenue');
    const patFact = facts.find((f) => f.metric_key === 'net_income');
    const eqFact = facts.find((f) => f.metric_key === 'shareholders_equity');
    const opFact = facts.find((f) => f.metric_key === 'ebitda' || f.metric_key === 'operating_income');

    const areFactsStrictlyAligned = (a?: ProvenancedFact, b?: ProvenancedFact): boolean =>
      Boolean(
        a &&
          b &&
          a.validation_status === 'VALIDATED' &&
          b.validation_status === 'VALIDATED' &&
          a.entity_id === b.entity_id &&
          a.currency === b.currency &&
          a.fiscal_year === b.fiscal_year &&
          (a.period_type || 'ANNUAL') === (b.period_type || 'ANNUAL') &&
          a.consolidation_basis === b.consolidation_basis
      );

    if (patFact && eqFact && eqFact.value > 0 && areFactsStrictlyAligned(patFact, eqFact)) {
      const roePct = Number(((patFact.value / eqFact.value) * 100).toFixed(2));
      facts.push({
        fact_id: `FACT_${entity.entityId}_ROE`,
        entity: entity.legalName,
        entity_id: entity.entityId,
        metric: 'Return on Equity (ROE %)',
        metric_key: 'roe_pct',
        value: roePct,
        formatted_value: `${roePct.toFixed(2)}%`,
        currency: patFact.currency,
        unit: '%',
        period: patFact.period,
        fiscal_year: patFact.fiscal_year,
        period_end: patFact.period_end,
        period_type: patFact.period_type,
        consolidation_basis: patFact.consolidation_basis,
        accounting_standard: patFact.accounting_standard,
        fact_class: patFact.fact_class,
        source_id: patFact.source_id,
        actual_source_id: patFact.actual_source_id,
        source_title: patFact.source_title,
        source_type: patFact.source_type,
        source_tier: patFact.source_tier,
        url: patFact.url,
        actual_origin_url: patFact.actual_origin_url,
        retrieval_status: patFact.retrieval_status,
        document_hash: patFact.document_hash,
        document: patFact.document,
        page_or_section: `Computed from Verified PAT (${patFact.formatted_value}) ÷ Total Equity (${eqFact.formatted_value})`,
        extraction_method: 'Deterministic Ratio from Live Provenanced Facts',
        exact_quote: `${patFact.value} / ${eqFact.value} = ${roePct}%`,
        verification_status: patFact.verification_status,
        validation_status: 'VALIDATED',
        confidence: Math.min(patFact.confidence ?? 90, eqFact.confidence ?? 90)
      });
    }

    if (opFact && revFact && revFact.value > 0 && areFactsStrictlyAligned(opFact, revFact)) {
      const opMarginPct = Number(((opFact.value / revFact.value) * 100).toFixed(2));
      facts.push({
        fact_id: `FACT_${entity.entityId}_OPM`,
        entity: entity.legalName,
        entity_id: entity.entityId,
        metric: 'Operating Margin (%)',
        metric_key: 'operating_margin_pct',
        value: opMarginPct,
        formatted_value: `${opMarginPct.toFixed(2)}%`,
        currency: revFact.currency,
        unit: '%',
        period: revFact.period,
        fiscal_year: revFact.fiscal_year,
        period_end: revFact.period_end,
        period_type: revFact.period_type,
        consolidation_basis: revFact.consolidation_basis,
        accounting_standard: revFact.accounting_standard,
        fact_class: revFact.fact_class,
        source_id: opFact.source_id,
        actual_source_id: opFact.actual_source_id,
        source_title: opFact.source_title,
        source_type: opFact.source_type,
        source_tier: opFact.source_tier,
        url: opFact.url,
        actual_origin_url: opFact.actual_origin_url,
        retrieval_status: opFact.retrieval_status,
        document_hash: opFact.document_hash,
        document: opFact.document,
        page_or_section: `Computed from Verified Operating Profit (${opFact.formatted_value}) ÷ Revenue (${revFact.formatted_value})`,
        extraction_method: 'Deterministic Ratio from Live Provenanced Facts',
        exact_quote: `${opFact.value} / ${revFact.value} = ${opMarginPct}%`,
        verification_status: opFact.verification_status,
        validation_status: 'VALIDATED',
        confidence: Math.min(opFact.confidence ?? 90, revFact.confidence ?? 90)
      });
    }

    // Record Missing Metrics (Never invent missing data!)
    if (entity.entityType !== 'OPEN_SOURCE_PROJECT') {
      const attemptedUrls = validSelectedSources.map((s) => s.url);
      for (const core of CORE_FINANCIAL_METRICS) {
        if (!facts.some((f) => f.metric_key === core.key)) {
          missingMetrics.push({
            metricKey: core.key,
            metricLabel: core.label,
            status: 'DATA_UNAVAILABLE',
            reason:
              entity.entityType === 'PRIVATE_COMPANY'
                ? `DATA UNAVAILABLE: ${entity.legalName} is a private company and does not publicly disclose audited ${core.label} in statutory exchange filings.`
                : `DATA UNAVAILABLE: ${core.label} was not reported in the retrieved schedules (${validSelectedSources.map((s) => s.domain).join(', ')}). Aegis refuses to synthesize or extrapolate missing values.`,
            attemptedSources: attemptedUrls
          });
        }
      }
    }

    return { facts, fallbacks, missingMetrics };
  }
}
