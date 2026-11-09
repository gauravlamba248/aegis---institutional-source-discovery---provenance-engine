import {
  AnalysisIntent,
  DiscoveredSource,
  EntityCandidate,
  JurisdictionProfile
} from './types';
import { RawCandidateSourceItem } from './LiveEvidenceCollector';
import { SourceClassifier } from './SourceClassifier';
import { SourceQualityEvaluator } from './SourceQualityEvaluator';

export class SourceDiscoverer {
  public static generateTargetedSearches(
    entity: EntityCandidate,
    jurisdiction: JurisdictionProfile,
    intent: AnalysisIntent
  ): {
    category: 'COMPANY_SPECIFIC' | 'JURISDICTION_REGULATORY' | 'DEEP_DOCUMENT_PDF' | 'SPECIALIST_AND_SECONDARY';
    query: string;
    purpose: string;
  }[] {
    const regName = jurisdiction.primaryRegulators[0] || 'Regulator';
    const exchName = jurisdiction.exchanges[0] || 'Exchange';
    const regIdClause = entity.cinOrRegId
      ? ` "${entity.cinOrRegId}"`
      : entity.cik
      ? ` "CIK ${entity.cik}"`
      : entity.isin
      ? ` "${entity.isin}"`
      : '';

    return [
      {
        category: 'COMPANY_SPECIFIC',
        query: `site:${entity.officialDomain} "${entity.legalName}" ("Investor Relations" OR "Annual Report" OR "Financial Statements")`,
        purpose: `Direct crawl of ${entity.officialDomain} for primary company-controlled disclosures`
      },
      {
        category: 'JURISDICTION_REGULATORY',
        query: `"${entity.legalName}"${regIdClause} (${regName} OR ${exchName}) (${jurisdiction.filingTypes.slice(0, 2).join(' OR ')})`,
        purpose: `Jurisdiction-aware statutory filing lookup in ${jurisdiction.countryName} (${jurisdiction.code})`
      },
      {
        category: 'DEEP_DOCUMENT_PDF',
        query: `"${entity.legalName}" filetype:pdf ("Consolidated Balance Sheet" OR "Statement of Profit and Loss")`,
        purpose: `Deep binary PDF discovery for audited financial schedules (${intent})`
      },
      {
        category: 'SPECIALIST_AND_SECONDARY',
        query: `"${entity.legalName}" consolidated vs standalone financial ratios credit rating rationale`,
        purpose: 'Cross-verification against institutional financial databases and credit rating agencies'
      }
    ];
  }

  /**
   * Classifies and scores candidate sources discovered dynamically by LiveEvidenceCollector.
   * Contains ZERO company-specific branches or hardcoded candidate URLs.
   */
  public static evaluateLiveCandidateSources(
    entity: EntityCandidate,
    jurisdictionProfile: JurisdictionProfile,
    intent: AnalysisIntent,
    rawCandidates: RawCandidateSourceItem[]
  ): DiscoveredSource[] {
    const seenDomains = new Set<string>();

    return rawCandidates.map((raw, idx) => {
      const entityMatch = SourceClassifier.evaluateEntityMatch(
        raw.url,
        raw.domain,
        raw.title,
        raw.snippet,
        entity
      );

      const classification = SourceClassifier.classifySource(
        raw.url,
        raw.domain,
        raw.title,
        raw.snippet,
        entity,
        entityMatch
      );

      const isDuplicateDomainContent =
        seenDomains.has(raw.domain) &&
        classification.tier !== 'TIER_1_OFFICIAL' &&
        classification.tier !== 'TIER_2_REGULATOR_EXCHANGE';
      seenDomains.add(raw.domain);

      const qualityBreakdown = SourceQualityEvaluator.evaluateQuality({
        sourceType: classification.sourceType,
        authorityLevel: classification.authorityLevel,
        sourceJurisdiction: entity.jurisdiction,
        entity,
        entityMatch,
        intent,
        informationTypes: raw.informationTypes,
        publicationDate: raw.publicationDate,
        hasLinkedPdfOrXbrl: raw.hasLinkedPdfOrXbrl,
        isCrossVerified: classification.isPrimaryEvidenceEligible && entityMatch.isExactEntity,
        isDuplicateDomainContent,
        title: raw.title,
        snippet: raw.snippet,
        httpStatus: raw.telemetry?.httpStatus,
        rawExtractedKb: raw.rawExtractedKb
      });

      return {
        source_id: `SRC_${entity.entityId}_${String(idx + 1).padStart(2, '0')}`,
        url: raw.url,
        domain: raw.domain,
        title: raw.title,
        snippet: raw.snippet,
        search_rank_order: raw.searchRankOrder,
        source_type: classification.sourceType,
        tier: classification.tier,
        authority_level: classification.authorityLevel,
        jurisdiction: entity.jurisdiction,
        entity_match: entityMatch.score,
        entity_match_evaluation: entityMatch,
        information_types: raw.informationTypes,
        publication_date: raw.publicationDate,
        retrieval_date: raw.telemetry?.retrievedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        quality_score: qualityBreakdown.totalScore,
        quality_breakdown: qualityBreakdown,
        selected: false,
        lifecycle_stage: 'CANDIDATE',
        selection_reason: [],
        rejection_reason: [],
        linked_documents: raw.linkedDocuments,
        raw_extracted_kb: raw.rawExtractedKb,
        http_telemetry: raw.telemetry
      };
    });
  }
}
