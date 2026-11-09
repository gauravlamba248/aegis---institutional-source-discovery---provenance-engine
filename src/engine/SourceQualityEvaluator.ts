import {
  AnalysisIntent,
  AuthorityLevel,
  EntityCandidate,
  EntityMatchEvaluation,
  JurisdictionCode,
  SourceQualityBreakdown,
  SourceType
} from './types';

export class SourceQualityEvaluator {
  public static evaluateQuality(params: {
    sourceType: SourceType;
    authorityLevel: AuthorityLevel;
    sourceJurisdiction: JurisdictionCode;
    entity: EntityCandidate;
    entityMatch: EntityMatchEvaluation;
    intent: AnalysisIntent;
    informationTypes: string[];
    publicationDate: string;
    hasLinkedPdfOrXbrl: boolean;
    isCrossVerified: boolean;
    isDuplicateDomainContent: boolean;
    title: string;
    snippet: string;
    httpStatus?: number;
    rawExtractedKb?: number;
  }): SourceQualityBreakdown {
    const {
      sourceType,
      authorityLevel,
      sourceJurisdiction,
      entity,
      entityMatch,
      intent,
      informationTypes,
      publicationDate,
      hasLinkedPdfOrXbrl,
      isCrossVerified,
      isDuplicateDomainContent,
      httpStatus,
      rawExtractedKb
    } = params;

    // Requirement #17 (CF-05): Un-retrieved or failed HTTP sources (404, 403, 500, 0) cannot score as high-quality sources
    if (
      (httpStatus !== undefined && httpStatus !== 200) ||
      (rawExtractedKb !== undefined && rawExtractedKb <= 0)
    ) {
      return {
        authority: 0,
        entityMatch: Math.round((entityMatch.score / 100) * 20),
        relevance: 0,
        dataDepth: 0,
        freshness: 0,
        primarySourceBonus: 0,
        jurisdictionMatch: 0,
        crossVerification: 0,
        duplicationPenalty: 0,
        seoContentFarmPenalty: 0,
        lowCredibilityPenalty: 100,
        totalScore: 0
      };
    }

    // 1. Authority (0 - 25)
    const authorityMap: Record<AuthorityLevel, number> = {
      VERY_HIGH: 23,
      HIGH: 19,
      MEDIUM_HIGH: 15,
      MEDIUM: 11,
      LOW: 5,
      UNTRUSTED: 0
    };
    let authority = authorityMap[authorityLevel];

    if (intent === 'FINANCIAL_ANALYSIS') {
      if (sourceType === 'OFFICIAL_COMPANY') {
        authority = 25;
      } else if (sourceType === 'REGULATOR' || sourceType === 'GOVERNMENT_REGISTRY') {
        authority = 24;
      } else if (sourceType === 'STOCK_EXCHANGE') {
        authority = 23;
      } else if (sourceType === 'GENERAL_REFERENCE') {
        authority = 4;
      }
    } else if (intent === 'TECHNOLOGY_ANALYSIS') {
      if (sourceType === 'OFFICIAL_COMPANY' || sourceType === 'RESEARCH') {
        authority = 25;
      }
    } else if (intent === 'COMPETITIVE_ANALYSIS') {
      if (sourceType === 'INDUSTRY_PUBLICATION' || sourceType === 'RESEARCH' || sourceType === 'REPUTABLE_NEWS') {
        authority = Math.min(25, authority + 4);
      }
    }

    // 2. EntityMatch (0 - 20)
    const entityMatchPoints = Math.round((entityMatch.score / 100) * 20);

    // 3. Relevance to Intent (0 - 15)
    let relevance = 8;
    const infoLower = informationTypes.map((i) => i.toLowerCase()).join(' ');
    if (intent === 'FINANCIAL_ANALYSIS') {
      if (
        infoLower.includes('income statement') ||
        infoLower.includes('balance sheet') ||
        infoLower.includes('cash flow') ||
        infoLower.includes('annual report') ||
        infoLower.includes('xbrl') ||
        infoLower.includes('aoc-4')
      ) {
        relevance = 15;
      } else if (infoLower.includes('ratios') || infoLower.includes('valuation') || infoLower.includes('exchange filing')) {
        relevance = 13;
      } else if (sourceType === 'GENERAL_REFERENCE') {
        relevance = 5;
      }
    } else if (intent === 'TECHNOLOGY_ANALYSIS') {
      if (infoLower.includes('architecture') || infoLower.includes('github') || infoLower.includes('specification')) {
        relevance = 15;
      }
    } else {
      relevance = 12;
    }

    // 4. DataDepth (0 - 12)
    let dataDepth = Math.min(9, informationTypes.length * 2);
    if (hasLinkedPdfOrXbrl) {
      dataDepth = 12;
    }
    if (sourceType === 'LOW_VALUE' || sourceType === 'IRRELEVANT') {
      dataDepth = 1;
    }

    // 5. Freshness (0 - 8) — handles 'UNKNOWN' cleanly without synthetic dates (Requirement #16)
    let freshness = 5;
    if (!publicationDate || publicationDate === 'UNKNOWN') {
      freshness = 5;
    } else if (publicationDate.startsWith('2026') || publicationDate.startsWith('2025')) {
      freshness = 8;
    } else if (publicationDate.startsWith('2024')) {
      freshness = 6;
    } else if (publicationDate.startsWith('2023')) {
      freshness = 4;
    } else {
      freshness = 2;
    }

    // 6. PrimarySourceBonus (0 - 8)
    const isPrimary =
      sourceType === 'OFFICIAL_COMPANY' ||
      sourceType === 'REGULATOR' ||
      sourceType === 'STOCK_EXCHANGE' ||
      sourceType === 'GOVERNMENT_REGISTRY';
    const primarySourceBonus = sourceType === 'OFFICIAL_COMPANY' ? 8 : isPrimary ? 6 : 0;

    // 7. JurisdictionMatch (0 - 6)
    const jurisdictionMatch =
      sourceJurisdiction === entity.jurisdiction || sourceJurisdiction === 'GLOBAL_OSS'
        ? 6
        : 3;

    // 8. CrossVerification (0 - 6)
    const crossVerification = isCrossVerified ? 6 : 0;

    // 9. Penalties
    const duplicationPenalty = isDuplicateDomainContent ? 18 : 0;
    const seoContentFarmPenalty = sourceType === 'LOW_VALUE' ? 35 : 0;
    let lowCredibilityPenalty = 0;
    if (sourceType === 'LOW_VALUE' || sourceType === 'IRRELEVANT') {
      lowCredibilityPenalty = 30;
    } else if (sourceType === 'GENERAL_REFERENCE' && intent === 'FINANCIAL_ANALYSIS') {
      lowCredibilityPenalty = 14;
    }

    const rawScore =
      authority +
      entityMatchPoints +
      relevance +
      dataDepth +
      freshness +
      primarySourceBonus +
      jurisdictionMatch +
      crossVerification -
      duplicationPenalty -
      seoContentFarmPenalty -
      lowCredibilityPenalty;

    const totalScore = Math.max(0, Math.min(100, rawScore));

    return {
      authority,
      entityMatch: entityMatchPoints,
      relevance,
      dataDepth,
      freshness,
      primarySourceBonus,
      jurisdictionMatch,
      crossVerification,
      duplicationPenalty,
      seoContentFarmPenalty,
      lowCredibilityPenalty,
      totalScore
    };
  }
}
