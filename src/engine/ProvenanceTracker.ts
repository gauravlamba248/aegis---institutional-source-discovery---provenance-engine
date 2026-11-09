import {
  DiscoveredSource,
  EntityCandidate,
  FallbackRecord,
  ProvenancedFact
} from './types';
import { normalizeFiscalPeriod } from './LiveEvidenceCollector';

export class ProvenanceTracker {
  public static createProvenancedFact(params: {
    index: number;
    entity: EntityCandidate;
    metric: string;
    metricKey: ProvenancedFact['metric_key'];
    value: number;
    formattedValue: string;
    currency: string;
    unit: string;
    period: string;
    fiscalYear: string;
    periodEnd?: string;
    periodType?: 'ANNUAL' | 'QUARTERLY' | 'TTM' | 'SNAPSHOT';
    consolidationBasis: ProvenancedFact['consolidation_basis'];
    accountingStandard: string;
    factClass: 'PRIMARY_FACT' | 'SECONDARY_REPORTING';
    source: DiscoveredSource;
    actualOriginUrl?: string;
    retrievalStatus?: number;
    documentHash?: string;
    documentName: string;
    pageOrSection: string;
    extractionMethod: string;
    verificationStatus: ProvenancedFact['verification_status'];
    validationStatus?: 'VALIDATED' | 'UNVALIDATED' | 'REJECTED';
    confidence?: number;
    fallbackRecord?: FallbackRecord;
  }): ProvenancedFact {
    const {
      index,
      entity,
      metric,
      metricKey,
      value,
      formattedValue,
      currency,
      unit,
      period,
      fiscalYear,
      periodEnd,
      periodType,
      consolidationBasis,
      accountingStandard,
      factClass,
      source,
      actualOriginUrl,
      retrievalStatus,
      documentHash,
      documentName,
      pageOrSection,
      extractionMethod,
      verificationStatus,
      validationStatus = 'VALIDATED',
      confidence,
      fallbackRecord
    } = params;

    const norm = normalizeFiscalPeriod(period, fiscalYear, periodEnd);
    const resolvedOriginUrl = actualOriginUrl || source.url;
    const resolvedStatus =
      retrievalStatus ?? source.http_telemetry?.httpStatus ?? 200;

    return {
      fact_id: `FACT_${entity.entityId}_${String(index).padStart(2, '0')}_${metricKey.toUpperCase()}`,
      entity: entity.legalName,
      entity_id: entity.entityId,
      metric,
      metric_key: metricKey,
      value,
      formatted_value: formattedValue,
      currency,
      unit,
      period,
      fiscal_year: norm.fiscalYear,
      period_end: periodEnd || norm.periodEnd,
      period_type: periodType || norm.periodType,
      consolidation_basis: consolidationBasis,
      accounting_standard: accountingStandard,
      fact_class: factClass,
      source_id: source.source_id,
      actual_source_id: source.source_id,
      source_title: source.title,
      source_type: source.source_type,
      source_tier: source.tier,
      url: resolvedOriginUrl,
      actual_origin_url: resolvedOriginUrl,
      retrieval_status: resolvedStatus,
      document_hash: documentHash || source.http_telemetry?.sha256Hash,
      document: documentName,
      page_or_section: pageOrSection,
      extraction_method: extractionMethod,
      verification_status: verificationStatus,
      validation_status: validationStatus,
      confidence:
        confidence ??
        (factClass === 'PRIMARY_FACT' ? Math.min(98, Math.max(80, source.quality_score)) : Math.min(68, source.quality_score)),
      fallback_record: fallbackRecord
    };
  }

  public static validateCompleteProvenance(facts: ProvenancedFact[]): {
    valid: boolean;
    totalFacts: number;
    primaryFactsCount: number;
    secondaryFactsCount: number;
    violations: string[];
  } {
    const violations: string[] = [];
    for (const f of facts) {
      if (!f.entity || !f.metric || f.value === undefined || !f.currency || !f.period || !f.source_id || !f.url || !f.document) {
        violations.push(`Fact ${f.fact_id} is missing mandatory provenance metadata.`);
      }
      if (f.source_tier === 'TIER_5_GENERAL_REFERENCE' && f.fact_class === 'PRIMARY_FACT') {
        violations.push(`Fact ${f.fact_id} illegally uses General Reference (Wikipedia) as a PRIMARY_FACT.`);
      }
      if (f.actual_origin_url && f.url !== f.actual_origin_url) {
        violations.push(`Fact ${f.fact_id} violates origin invariant: url (${f.url}) !== actual_origin_url (${f.actual_origin_url}).`);
      }
      if (f.actual_source_id && f.source_id !== f.actual_source_id) {
        violations.push(`Fact ${f.fact_id} violates source invariant: source_id (${f.source_id}) !== actual_source_id (${f.actual_source_id}).`);
      }
      if (f.retrieval_status !== undefined && f.retrieval_status !== 200) {
        violations.push(`Fact ${f.fact_id} originated from a non-200 HTTP response (${f.retrieval_status}).`);
      }
      if (f.validation_status && f.validation_status !== 'VALIDATED') {
        violations.push(`Fact ${f.fact_id} is not VALIDATED (${f.validation_status}).`);
      }
    }

    return {
      valid: violations.length === 0,
      totalFacts: facts.length,
      primaryFactsCount: facts.filter((f) => f.fact_class === 'PRIMARY_FACT').length,
      secondaryFactsCount: facts.filter((f) => f.fact_class === 'SECONDARY_REPORTING').length,
      violations
    };
  }
}
