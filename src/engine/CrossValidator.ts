import {
  CrossVerificationAudit,
  DiscoveredSource,
  EntityCandidate,
  MetricKey
} from './types';
import { LiveEvidenceBundle } from './LiveEvidenceCollector';

export class CrossValidator {
  /**
   * Cross-verifies financial metrics using ONLY actual values independently extracted from live sources.
   * Enforces CF-02, Section 3, and Section 6:
   * - ZERO synthetic candidate generation (`selectedSources.length >= 2` fallback completely removed).
   * - `candidate_values` contains ONLY independently observed/extracted values with their true source origin.
   * - If only one source produced a metric, `status = 'SINGLE_SOURCE'` (NEVER `'EXACT_CONSENSUS'`).
   */
  public static crossVerifyLiveMetrics(
    entity: EntityCandidate,
    selectedSources: DiscoveredSource[],
    bundle: LiveEvidenceBundle,
    allCandidates: DiscoveredSource[] = []
  ): CrossVerificationAudit[] {
    if (selectedSources.length === 0 || entity.entityType === 'OPEN_SOURCE_PROJECT') {
      return [];
    }

    const audits: CrossVerificationAudit[] = [];
    const sourcePool = allCandidates.length > 0 ? allCandidates : selectedSources;

    const findMatchingSource = (originUrl?: string): DiscoveredSource | undefined => {
      if (!originUrl) return undefined;
      return (
        selectedSources.find(
          (s) =>
            s.url === originUrl ||
            s.linked_documents.some((d) => d.url === originUrl && d.httpStatus === 200)
        ) ||
        sourcePool.find(
          (s) =>
            s.url === originUrl ||
            s.linked_documents.some((d) => d.url === originUrl && d.httpStatus === 200)
        )
      );
    };

    const keysToAudit: MetricKey[] = ['revenue', 'net_income', 'ebitda', 'total_assets', 'shareholders_equity'];

    for (const key of keysToAudit) {
      const raw = bundle.extractedMetrics.get(key);
      if (!raw) continue;

      const actualPrimaryUrl = raw.actualOriginUrl || raw.sourceUrl;
      const primarySource = findMatchingSource(actualPrimaryUrl);
      if (!primarySource || !primarySource.selected) {
        continue;
      }

      const fmt = (val: number) =>
        `${raw.currency} ${val.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} ${raw.unit}`;

      const hasRealStandalone = typeof raw.standaloneValue === 'number' && !isNaN(raw.standaloneValue);
      const hasRealSecondary =
        typeof raw.secondaryValue === 'number' &&
        !isNaN(raw.secondaryValue) &&
        Boolean(raw.secondarySourceUrl);

      const candidateValues: CrossVerificationAudit['candidate_values'] = [
        {
          source_id: primarySource.source_id,
          source_title: primarySource.title,
          source_type: primarySource.source_type,
          tier: primarySource.tier,
          raw_value: raw.value,
          formatted_value: fmt(raw.value),
          currency: raw.currency,
          unit: raw.unit,
          period: raw.fiscalYear,
          consolidation_basis: 'CONSOLIDATED',
          metric_basis: 'REPORTED_GAAP_INDAS',
          accounting_standard: raw.accountingStandard,
          publication_date: primarySource.publication_date
        }
      ];

      if (hasRealStandalone) {
        const standaloneOriginSource =
          sourcePool.find(
            (s) =>
              s.domain === primarySource.domain &&
              s.source_id !== primarySource.source_id &&
              s.title.toLowerCase().includes('standalone')
          ) || primarySource;

        candidateValues.push({
          source_id: standaloneOriginSource.source_id,
          source_title: `${standaloneOriginSource.title} (Standalone Parent Schedule)`,
          source_type: standaloneOriginSource.source_type,
          tier: standaloneOriginSource.tier,
          raw_value: raw.standaloneValue!,
          formatted_value: fmt(raw.standaloneValue!),
          currency: raw.currency,
          unit: raw.unit,
          period: raw.fiscalYear,
          consolidation_basis: 'STANDALONE' as const,
          metric_basis: 'REPORTED_GAAP_INDAS' as const,
          accounting_standard: raw.accountingStandard,
          publication_date: standaloneOriginSource.publication_date
        });
      }

      if (hasRealSecondary) {
        const secondaryOriginSource = findMatchingSource(raw.secondarySourceUrl);
        if (secondaryOriginSource && secondaryOriginSource.source_id !== primarySource.source_id) {
          candidateValues.push({
            source_id: secondaryOriginSource.source_id,
            source_title: raw.secondarySourceTitle || secondaryOriginSource.title,
            source_type: secondaryOriginSource.source_type,
            tier: secondaryOriginSource.tier,
            raw_value: raw.secondaryValue!,
            formatted_value: fmt(raw.secondaryValue!),
            currency: raw.currency,
            unit: raw.unit,
            period: raw.fiscalYear,
            consolidation_basis: 'CONSOLIDATED' as const,
            metric_basis: 'REPORTED_GAAP_INDAS' as const,
            accounting_standard: raw.accountingStandard,
            publication_date: secondaryOriginSource.publication_date
          });
        }
      }

      const independentConsolidatedCount = candidateValues.filter(
        (c) => c.consolidation_basis === 'CONSOLIDATED'
      ).length;
      const isExactMultiSourceMatch =
        independentConsolidatedCount >= 2 &&
        candidateValues
          .filter((c) => c.consolidation_basis === 'CONSOLIDATED')
          .every((c) => Math.abs(c.raw_value - raw.value) / Math.max(1, Math.abs(raw.value)) < 0.005);

      const discrepancyDetected =
        candidateValues.length >= 2 &&
        candidateValues.some((c) => Math.abs(c.raw_value - raw.value) > 0.001);

      let auditStatus: CrossVerificationAudit['status'];
      if (candidateValues.length === 1) {
        auditStatus = 'SINGLE_SOURCE';
      } else if (isExactMultiSourceMatch && !hasRealStandalone) {
        auditStatus = 'EXACT_CONSENSUS';
      } else if (hasRealStandalone) {
        auditStatus = 'RECONCILED_DISCREPANCY';
      } else {
        auditStatus = 'DISAGREEMENT';
      }

      audits.push({
        metric_key: key,
        metric_label: raw.metricLabel,
        status: auditStatus,
        final_value: raw.value,
        final_formatted: fmt(raw.value),
        currency: raw.currency,
        unit: raw.unit,
        period: raw.fiscalYear,
        candidate_values: candidateValues,
        discrepancy_investigation: {
          detected: discrepancyDetected,
          root_causes:
            auditStatus === 'SINGLE_SOURCE'
              ? [
                  `Single-Source Observation: Extracted exclusively from ${primarySource.title} (${primarySource.domain}) for ${raw.fiscalYear}; no second independent source extracted this metric.`
                ]
              : hasRealStandalone
              ? [
                  `Consolidation Basis Variance: Live extraction captured both Consolidated (${fmt(raw.value)}) and Standalone Parent-Only (${fmt(raw.standaloneValue!)}) schedules under ${raw.accountingStandard}.`,
                  `Variance of ${fmt(Math.abs(raw.value - raw.standaloneValue!))} is attributable to subsidiaries, associates, and joint ventures consolidated under ${raw.accountingStandard}.`
                ]
              : hasRealSecondary && discrepancyDetected
              ? [
                  `Cross-Source Disagreement / Precision Variance: Primary filing (${primarySource.domain}) reports ${fmt(raw.value)} while secondary source reports ${fmt(raw.secondaryValue!)}.`
                ]
              : [
                  `Verified independent multi-source consensus across ${candidateValues.map((c) => c.source_title).join(' and ')} for period ${raw.fiscalYear}.`
                ],
          reconciliation_explanation:
            auditStatus === 'SINGLE_SOURCE'
              ? `Single-source primary observation (${fmt(raw.value)}) from ${primarySource.domain}; no synthetic multi-source consensus claimed.`
              : hasRealStandalone
              ? `Aegis selected Consolidated ${raw.metricLabel} (${fmt(raw.value)}) as the primary institutional benchmark while preserving the Standalone figure (${fmt(raw.standaloneValue!)}) in the provenance audit.`
              : hasRealSecondary && discrepancyDetected
              ? `Aegis prioritized the authoritative primary filing figure (${fmt(raw.value)}) from ${primarySource.domain} over the secondary figure (${fmt(raw.secondaryValue!)}).`
              : `Independent multi-source agreement (${fmt(raw.value)}) verified across extracted schedules.`,
          winning_source_id: primarySource.source_id
        }
      });
    }

    return audits;
  }
}

