import {
  AnalysisIntent,
  DiscoveredSource,
  FinancialModelOutput,
  ProvenancedFact
} from './types';

export class SourceSelector {
  public static selectOptimalSources(
    candidates: DiscoveredSource[],
    maxSources: number,
    intent: AnalysisIntent
  ): DiscoveredSource[] {
    // Sort candidates strictly by quality_score descending (NEVER by search_rank_order)
    const sorted = [...candidates].sort((a, b) => b.quality_score - a.quality_score);

    const eligiblePrimaryCount = sorted.filter(
      (s) =>
        (s.tier === 'TIER_1_OFFICIAL' ||
          s.tier === 'TIER_2_REGULATOR_EXCHANGE' ||
          s.tier === 'TIER_3_SPECIALIST_FINANCIAL') &&
        s.entity_match_evaluation.isExactEntity &&
        (!s.http_telemetry || s.http_telemetry.httpStatus === 200) &&
        s.raw_extracted_kb > 0
    ).length;

    const hasPrimaryFinancialStatementSource = sorted.some(
      (s) =>
        (s.tier === 'TIER_1_OFFICIAL' ||
          s.tier === 'TIER_2_REGULATOR_EXCHANGE' ||
          s.tier === 'TIER_3_SPECIALIST_FINANCIAL') &&
        s.entity_match_evaluation.isExactEntity &&
        (!s.http_telemetry || s.http_telemetry.httpStatus === 200) &&
        s.raw_extracted_kb > 0 &&
        s.information_types.some((t) =>
          /Income Statement|Balance Sheet|Annual Report|XBRL|Financial Ratios/i.test(t)
        )
    );

    const selectedIds = new Set<string>();
    const domainCounts = new Map<string, number>();

    // First pass: Diversity-aware selection across distinct tiers
    const desiredCategories: ((s: DiscoveredSource) => boolean)[] = [
      (s) => s.tier === 'TIER_1_OFFICIAL',
      (s) => s.tier === 'TIER_2_REGULATOR_EXCHANGE',
      (s) => s.tier === 'TIER_3_SPECIALIST_FINANCIAL',
      (s) => s.tier === 'TIER_4_REPUTABLE_SECONDARY' || s.tier === 'TIER_2_REGULATOR_EXCHANGE'
    ];

    for (const matcher of desiredCategories) {
      if (selectedIds.size >= maxSources) break;
      const bestInCategory = sorted.find((candidate) => {
        if (selectedIds.has(candidate.source_id)) return false;
        if (!this.isCandidateSelectable(candidate, intent, eligiblePrimaryCount, hasPrimaryFinancialStatementSource)) return false;
        const currentDomainCount = domainCounts.get(candidate.domain) || 0;
        if (currentDomainCount >= 1) return false;
        return matcher(candidate);
      });

      if (bestInCategory) {
        selectedIds.add(bestInCategory.source_id);
        domainCounts.set(bestInCategory.domain, (domainCounts.get(bestInCategory.domain) || 0) + 1);
      }
    }

    // Second pass: Fill remaining slots up to maxSources with highest quality eligible sources
    for (const candidate of sorted) {
      if (selectedIds.size >= maxSources) break;
      if (selectedIds.has(candidate.source_id)) continue;
      if (!this.isCandidateSelectable(candidate, intent, eligiblePrimaryCount, hasPrimaryFinancialStatementSource)) continue;

      const currentDomainCount = domainCounts.get(candidate.domain) || 0;
      if (currentDomainCount >= 2) continue;

      selectedIds.add(candidate.source_id);
      domainCounts.set(candidate.domain, currentDomainCount + 1);
    }

    return sorted.map((source) => {
      const isSelected = selectedIds.has(source.source_id);
      if (isSelected) {
        const reasons: string[] = [];
        if (source.tier === 'TIER_1_OFFICIAL') {
          reasons.push('Official company-controlled primary disclosure');
        } else if (source.tier === 'TIER_2_REGULATOR_EXCHANGE') {
          reasons.push(`Authoritative sovereign regulator / stock exchange filing (${source.jurisdiction})`);
        } else if (source.tier === 'TIER_3_SPECIALIST_FINANCIAL') {
          reasons.push('High-depth institutional financial database with standardized metrics');
        } else if (source.tier === 'TIER_4_REPUTABLE_SECONDARY') {
          reasons.push('Reputable secondary industry/financial reporting providing competitive context');
        } else if (source.tier === 'TIER_5_GENERAL_REFERENCE') {
          reasons.push('Secondary reference fallback selected ONLY because zero primary financial statement filings exist for this entity');
        }
        reasons.push(`Exact entity match (${source.entity_match}%) via ${source.entity_match_evaluation.matchedSignals.slice(0, 2).join(' & ')}`);
        if (source.linked_documents.length > 0) {
          reasons.push(`Contains ${source.linked_documents.length} linked primary PDF/XBRL filing document(s)`);
        }
        reasons.push(`High composite quality score (${source.quality_score}/100) vs search rank #${source.search_rank_order}`);

        return {
          ...source,
          selected: true,
          lifecycle_stage: 'SELECTED',
          selection_reason: reasons,
          rejection_reason: []
        };
      } else {
        const rejections: string[] = [];
        if (source.http_telemetry && source.http_telemetry.httpStatus !== 200) {
          rejections.push(`HTTP retrieval failed with status ${source.http_telemetry.httpStatus} (un-retrieved source excluded)`);
        } else if (source.raw_extracted_kb <= 0) {
          rejections.push('Zero extracted payload (0.0 KB)');
        }
        if (source.entity_match_evaluation.isSiblingOrParentContamination) {
          rejections.push(source.entity_match_evaluation.explanation);
        } else if (!source.entity_match_evaluation.isExactEntity) {
          rejections.push(`Entity identity score (${source.entity_match}%) below strict 60% verification threshold`);
        }
        if (source.source_type === 'LOW_VALUE') {
          rejections.push('Classified as low-credibility SEO content farm / generic aggregator');
        }
        if (source.source_type === 'GENERAL_REFERENCE' && intent === 'FINANCIAL_ANALYSIS' && hasPrimaryFinancialStatementSource) {
          rejections.push(
            'General reference (Wikipedia) demoted for primary financial figures because authoritative Tier 1–3 financial statement sources are available'
          );
        }
        if (source.quality_breakdown.duplicationPenalty > 0) {
          rejections.push('Redundant domain content already covered by a higher-ranked official filing');
        }
        if (rejections.length === 0) {
          rejections.push(
            `Outranked by higher-authority diversified sources (Quality Score ${source.quality_score}/100; user cap: ${maxSources} sources)`
          );
        }

        return {
          ...source,
          selected: false,
          lifecycle_stage: 'REJECTED',
          selection_reason: [],
          rejection_reason: rejections
        };
      }
    });
  }

  /**
   * Reconciles each source's truthful lifecycle_stage AFTER fact extraction and financial analysis.
   * Enforces the invariant (Sections 5 & 26):
   * - A source may ONLY be marked USED_IN_ANALYSIS or PRODUCED_FACT if at least 1 validated ProvenancedFact
   *   has `actual_source_id === source.source_id`.
   * - If a source was selected and parsed (HTTP 200) but produced 0 validated facts, its lifecycle_stage
   *   is set to `NO_FACT` (NEVER `USED` or `USED_IN_ANALYSIS`).
   */
  public static reconcileSourceLifecycle(
    allSources: DiscoveredSource[],
    provenancedFacts: ProvenancedFact[],
    financialAnalysis: FinancialModelOutput
  ): DiscoveredSource[] {
    const validatedFacts = provenancedFacts.filter((f) => f.validation_status === 'VALIDATED');
    const producedFactSourceIds = new Set<string>(
      validatedFacts.map((f) => f.actual_source_id || f.source_id)
    );

    const usedFactIds = new Set<string>();
    for (const ratio of financialAnalysis.keyRatios || []) {
      for (const fid of ratio.provenanceFactIds || []) {
        usedFactIds.add(fid);
      }
    }
    const usedInAnalysisSourceIds = new Set<string>();
    for (const fact of validatedFacts) {
      const sid = fact.actual_source_id || fact.source_id;
      if (
        usedFactIds.has(fact.fact_id) ||
        fact.fact_class === 'PRIMARY_FACT' ||
        fact.fact_class === 'SECONDARY_REPORTING'
      ) {
        usedInAnalysisSourceIds.add(sid);
      }
    }

    return allSources.map((source) => {
      if (!source.selected) {
        return {
          ...source,
          lifecycle_stage: 'REJECTED'
        };
      }

      const producedCount = validatedFacts.filter(
        (f) => (f.actual_source_id || f.source_id) === source.source_id
      ).length;

      if (producedCount > 0 && usedInAnalysisSourceIds.has(source.source_id)) {
        return {
          ...source,
          lifecycle_stage: 'USED_IN_ANALYSIS',
          selection_reason: [
            ...source.selection_reason.filter((r) => !r.startsWith('Produced ')),
            `Produced ${producedCount} validated fact(s) actively used in downstream analysis`
          ]
        };
      }

      if (producedCount > 0 && producedFactSourceIds.has(source.source_id)) {
        return {
          ...source,
          lifecycle_stage: 'PRODUCED_FACT',
          selection_reason: [
            ...source.selection_reason.filter((r) => !r.startsWith('Produced ')),
            `Produced ${producedCount} validated fact(s)`
          ]
        };
      }

      return {
        ...source,
        lifecycle_stage: 'NO_FACT',
        selection_reason: [
          ...source.selection_reason.filter((r) => !r.startsWith('Selected and parsed')),
          'Selected and parsed (HTTP 200), but produced 0 extracted facts (NO_FACT — not marked USED)'
        ]
      };
    });
  }

  private static isCandidateSelectable(
    candidate: DiscoveredSource,
    intent: AnalysisIntent,
    eligiblePrimaryCount: number,
    hasPrimaryFinancialStatementSource: boolean
  ): boolean {
    if (candidate.entity_match_evaluation.isSiblingOrParentContamination) return false;
    if (!candidate.entity_match_evaluation.isExactEntity) return false;
    if (candidate.source_type === 'LOW_VALUE' || candidate.source_type === 'IRRELEVANT') return false;
    if (candidate.http_telemetry && candidate.http_telemetry.httpStatus !== 200) return false;
    if (candidate.raw_extracted_kb <= 0) return false;

    if (candidate.source_type === 'GENERAL_REFERENCE' && intent === 'FINANCIAL_ANALYSIS') {
      // Never select Wikipedia when primary financial statements (SEC XBRL, Screener, or Official PDF) exist!
      if (hasPrimaryFinancialStatementSource || eligiblePrimaryCount >= 2) {
        return false;
      }
      // If no primary financial statements exist (e.g. Private Company or foreign issuer without SEC 20-F),
      // allow Wikipedia ONLY as a secondary reference fallback if its score >= 30
      return candidate.quality_score >= 30;
    }

    if (candidate.quality_score < 45) return false;
    return true;
  }
}
