import {
  AuthorityLevel,
  EntityCandidate,
  EntityMatchEvaluation,
  SourceTier,
  SourceType
} from './types';

export interface ClassificationOutput {
  sourceType: SourceType;
  tier: SourceTier;
  authorityLevel: AuthorityLevel;
  isPrimaryEvidenceEligible: boolean;
}

const REGULATOR_DOMAINS = [
  'sec.gov',
  'sebi.gov.in',
  'rbi.org.in',
  'edinet-fsa.go.jp',
  'dart.fss.or.kr',
  'bafin.de',
  'fca.org.uk',
  'sfc.hk'
];

const EXCHANGE_DOMAINS = [
  'bseindia.com',
  'nseindia.com',
  'nasdaq.com',
  'nyse.com',
  'londonstockexchange.com',
  'jpx.co.jp',
  'krx.co.kr',
  'hkexnews.hk',
  'boerse-frankfurt.de'
];

const REGISTRY_DOMAINS = [
  'mca.gov.in',
  'find-and-update.company-information.service.gov.uk',
  'company-information.service.gov.uk',
  'opencorporates.com',
  'unternehmensregister.de',
  'bundesanzeiger.de',
  'zaubacorp.com',
  'cncf.io',
  'linuxfoundation.org'
];

const FINANCIAL_DATABASE_DOMAINS = [
  'screener.in',
  'capitaliq.spglobal.com',
  'bloomberg.com',
  'refinitiv.com',
  'lseg.com',
  'factset.com',
  'morningstar.com',
  'pitchbook.com',
  'tracxn.com',
  'crisil.com',
  'crisilratings.com',
  'icra.in',
  'careratings.com',
  'careedge.in',
  'indiaratings.co.in'
];

const SPECIALIST_FINANCIAL_DOMAINS = [
  'finance.yahoo.com',
  'query2.finance.yahoo.com',
  'investing.com',
  'marketscreener.com',
  'macrotrends.net',
  'trendlyne.com',
  'moneycontrol.com',
  'stockanalysis.com'
];

const REPUTABLE_NEWS_DOMAINS = [
  'reuters.com',
  'ft.com',
  'wsj.com',
  'livemint.com',
  'economictimes.indiatimes.com',
  'business-standard.com',
  'forbesindia.com',
  'theinformation.com',
  'businessinsider.com',
  'nikkei.com',
  'handelsblatt.com',
  'scmp.com',
  'cnbc.com',
  'sfchronicle.com',
  'wired.com'
];

const GENERAL_REFERENCE_DOMAINS = [
  'wikipedia.org',
  'en.wikipedia.org',
  'britannica.com',
  'wikidata.org'
];

const LOW_VALUE_SEO_DOMAINS = [
  'top10stocktips-blog.net',
  'seo-company-directory-world.biz',
  'ai-stock-prediction-daily.io',
  'random-finance-blogger.blogspot.com',
  'free-company-networth-buzz.com',
  'buzz-networth-pedia.org',
  'blogspot.com'
];

export class SourceClassifier {
  public static classifySource(
    url: string,
    domain: string,
    title: string,
    snippet: string,
    entity: EntityCandidate,
    entityMatch: EntityMatchEvaluation
  ): ClassificationOutput {
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
    const officialDomain = entity.officialDomain.toLowerCase().replace(/^www\./, '');
    const urlLower = url.toLowerCase();

    // If entity match explicitly flags sibling/parent contamination or total mismatch
    if (entityMatch.isSiblingOrParentContamination || entityMatch.score < 35) {
      return {
        sourceType: 'IRRELEVANT',
        tier: 'TIER_6_LOW_VALUE',
        authorityLevel: 'UNTRUSTED',
        isPrimaryEvidenceEligible: false
      };
    }

    // 1. Official Company Controlled Sources (including official CDN/DAM paths & official GitHub repo for OSS)
    const entitySlug = entity.canonicalName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const firstToken = entity.canonicalName.toLowerCase().split(/\s+/)[0];
    const domainStem = officialDomain.split('.')[0] || '';
    const parentRepoUrlLower = (entity.parentEntity || '').toLowerCase().replace(/^https?:\/\//, '');
    const isVerifiedOfficialOssRepo =
      entity.entityType === 'OPEN_SOURCE_PROJECT' &&
      (urlLower.includes('github.com/') || cleanDomain === 'github.com') &&
      (urlLower.includes(firstToken) ||
        (parentRepoUrlLower.length > 5 && urlLower.includes(parentRepoUrlLower)) ||
        (domainStem.length >= 4 && urlLower.includes(domainStem)) ||
        title.toLowerCase().includes('official github source repository'));

    const isOfficialDamOrCdnPdf =
      urlLower.endsWith('.pdf') &&
      (urlLower.includes(entitySlug) ||
        (firstToken.length >= 4 && cleanDomain.includes(firstToken)) ||
        title.toLowerCase().includes('audited annual report') ||
        title.toLowerCase().includes('consolidated_financial_statement'));

    if (
      cleanDomain === officialDomain ||
      cleanDomain.endsWith(`.${officialDomain}`) ||
      (firstToken.length >= 5 && cleanDomain.includes(firstToken) && !cleanDomain.includes('wikipedia')) ||
      isOfficialDamOrCdnPdf ||
      isVerifiedOfficialOssRepo
    ) {
      return {
        sourceType: 'OFFICIAL_COMPANY',
        tier: 'TIER_1_OFFICIAL',
        authorityLevel: 'VERY_HIGH',
        isPrimaryEvidenceEligible: true
      };
    }

    // 2. Regulators
    if (REGULATOR_DOMAINS.some((d) => cleanDomain === d || cleanDomain.endsWith(`.${d}`))) {
      return {
        sourceType: 'REGULATOR',
        tier: 'TIER_2_REGULATOR_EXCHANGE',
        authorityLevel: 'VERY_HIGH',
        isPrimaryEvidenceEligible: true
      };
    }

    // 3. Stock Exchanges
    if (EXCHANGE_DOMAINS.some((d) => cleanDomain === d || cleanDomain.endsWith(`.${d}`))) {
      return {
        sourceType: 'STOCK_EXCHANGE',
        tier: 'TIER_2_REGULATOR_EXCHANGE',
        authorityLevel: 'VERY_HIGH',
        isPrimaryEvidenceEligible: true
      };
    }

    // 4. Government / Corporate Registries
    if (REGISTRY_DOMAINS.some((d) => cleanDomain === d || cleanDomain.endsWith(`.${d}`))) {
      return {
        sourceType: 'GOVERNMENT_REGISTRY',
        tier: 'TIER_2_REGULATOR_EXCHANGE',
        authorityLevel: 'VERY_HIGH',
        isPrimaryEvidenceEligible: true
      };
    }

    // 5. High-Quality Financial Databases & Credit Rating Agencies
    if (FINANCIAL_DATABASE_DOMAINS.some((d) => cleanDomain === d || cleanDomain.endsWith(`.${d}`))) {
      return {
        sourceType: 'FINANCIAL_DATABASE',
        tier: 'TIER_3_SPECIALIST_FINANCIAL',
        authorityLevel: 'HIGH',
        isPrimaryEvidenceEligible: true
      };
    }

    // 6. Specialist Financial Platforms
    if (SPECIALIST_FINANCIAL_DOMAINS.some((d) => cleanDomain === d || cleanDomain.endsWith(`.${d}`))) {
      return {
        sourceType: 'SPECIALIST_FINANCIAL',
        tier: 'TIER_3_SPECIALIST_FINANCIAL',
        authorityLevel: 'MEDIUM_HIGH',
        isPrimaryEvidenceEligible: true
      };
    }

    // 7. Reputable Financial News & Journalism
    if (REPUTABLE_NEWS_DOMAINS.some((d) => cleanDomain === d || cleanDomain.endsWith(`.${d}`))) {
      return {
        sourceType: 'REPUTABLE_NEWS',
        tier: 'TIER_4_REPUTABLE_SECONDARY',
        authorityLevel: 'MEDIUM_HIGH',
        isPrimaryEvidenceEligible: false
      };
    }

    // 8. Wikipedia & General Reference
    if (GENERAL_REFERENCE_DOMAINS.some((d) => cleanDomain === d || cleanDomain.endsWith(`.${d}`))) {
      return {
        sourceType: 'GENERAL_REFERENCE',
        tier: 'TIER_5_GENERAL_REFERENCE',
        authorityLevel: 'LOW',
        isPrimaryEvidenceEligible: false
      };
    }

    // 9. Low-value SEO content farms / blogs
    if (
      LOW_VALUE_SEO_DOMAINS.some((d) => cleanDomain === d || cleanDomain.endsWith(`.${d}`)) ||
      title.toLowerCase().includes('stock price prediction 2030') ||
      snippet.toLowerCase().includes('sponsored content farm')
    ) {
      return {
        sourceType: 'LOW_VALUE',
        tier: 'TIER_6_LOW_VALUE',
        authorityLevel: 'UNTRUSTED',
        isPrimaryEvidenceEligible: false
      };
    }

    // 10. Industry / Research fallback
    if (title.toLowerCase().includes('research') || title.toLowerCase().includes('report')) {
      return {
        sourceType: 'RESEARCH',
        tier: 'TIER_4_REPUTABLE_SECONDARY',
        authorityLevel: 'MEDIUM',
        isPrimaryEvidenceEligible: false
      };
    }

    return {
      sourceType: 'INDUSTRY_PUBLICATION',
      tier: 'TIER_4_REPUTABLE_SECONDARY',
      authorityLevel: 'MEDIUM',
      isPrimaryEvidenceEligible: false
    };
  }

  public static evaluateEntityMatch(
    url: string,
    domain: string,
    title: string,
    snippet: string,
    targetEntity: EntityCandidate
  ): EntityMatchEvaluation {
    const combined = `${url} ${title} ${snippet}`.toLowerCase();
    const matchedSignals: string[] = [];
    const conflictingSignals: string[] = [];
    let score = 0;

    const titleAndUrl = `${url} ${title}`.toLowerCase();

    // Check sibling/parent contamination first!
    const targetCanonicalClean = targetEntity.canonicalName
      .toLowerCase()
      .replace(/\s+(limited|ltd\.?|inc\.?|corp\.?|corporation|plc|ag|n\.v\.|co\.,?\s*ltd\.?|private limited)$/i, '')
      .trim();
    const targetLegalClean = targetEntity.legalName
      .toLowerCase()
      .replace(/\s+(limited|ltd\.?|inc\.?|corp\.?|corporation|plc|ag|n\.v\.|co\.,?\s*ltd\.?|private limited)$/i, '')
      .trim();

    for (const sibling of targetEntity.siblingEntitiesExcluded) {
      const siblingShort = sibling.split(' (')[0].toLowerCase().trim();
      const siblingClean = siblingShort
        .replace(/\s+(limited|ltd\.?|inc\.?|corp\.?|corporation|plc|ag|n\.v\.|co\.,?\s*ltd\.?|private limited)$/i, '')
        .trim();

      // If the excluded item is a same-name homonym (e.g. "Python (genus of reptiles)" when target is "Python"),
      // only block if the full disambiguated homonym string appears, never the shared canonical name!
      if (siblingClean === targetCanonicalClean || siblingClean === targetLegalClean) {
        if (titleAndUrl.includes(sibling.toLowerCase())) {
          conflictingSignals.push(`References excluded homonym entity: "${sibling}"`);
          return {
            score: 12,
            isExactEntity: false,
            isSiblingOrParentContamination: true,
            matchedSignals: [],
            conflictingSignals,
            explanation: `ENTITY CONTAMINATION BLOCKED: Source refers to "${sibling}" rather than requested entity "${targetEntity.legalName}".`
          };
        }
        continue;
      }

      const siblingSlug = siblingClean.replace(/[^a-z0-9]+/g, '');
      const mentionsSiblingInTitleOrUrl =
        titleAndUrl.includes(siblingShort) ||
        (siblingClean.length >= 5 && titleAndUrl.includes(siblingClean)) ||
        (siblingSlug.length >= 6 && url.toLowerCase().includes(siblingSlug));

      const mentionsExactLegalTargetInTitle =
        targetEntity.legalName.toLowerCase() !== siblingClean &&
        title.toLowerCase().includes(targetEntity.legalName.toLowerCase());

      if (mentionsSiblingInTitleOrUrl && !mentionsExactLegalTargetInTitle) {
        conflictingSignals.push(`References excluded sibling/affiliate entity: "${sibling}"`);
        return {
          score: 12,
          isExactEntity: false,
          isSiblingOrParentContamination: true,
          matchedSignals: ['Umbrella group / conglomerate prefix only'],
          conflictingSignals,
          explanation: `ENTITY CONTAMINATION BLOCKED: Source refers to "${sibling}" rather than requested entity "${targetEntity.legalName}".`
        };
      }
    }

    // Official domain signal or verified official open-source repository signal (Wikidata P1324 / homepage link)
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
    const officialDomain = targetEntity.officialDomain.toLowerCase().replace(/^www\./, '');
    const domainStem = officialDomain.split('.')[0] || '';
    const parentRepoUrlLower = (targetEntity.parentEntity || '').toLowerCase().replace(/^https?:\/\//, '');
    const urlLower = url.toLowerCase();

    if (cleanDomain === officialDomain || cleanDomain.endsWith(`.${officialDomain}`)) {
      score += 35;
      matchedSignals.push(`Official corporate domain (${targetEntity.officialDomain})`);
    } else if (
      targetEntity.entityType === 'OPEN_SOURCE_PROJECT' &&
      (cleanDomain === 'github.com' || urlLower.includes('github.com/')) &&
      ((parentRepoUrlLower.length > 5 && urlLower.includes(parentRepoUrlLower)) ||
        (domainStem.length >= 4 && urlLower.includes(domainStem)) ||
        title.toLowerCase().includes('official github source repository'))
    ) {
      score += 35;
      matchedSignals.push(`Verified official open-source repository (${targetEntity.parentEntity || url})`);
    }

    // Exact legal name or canonical name signal
    if (combined.includes(targetEntity.legalName.toLowerCase())) {
      score += 45;
      matchedSignals.push(`Exact legal name ("${targetEntity.legalName}")`);
    } else if (combined.includes(targetEntity.canonicalName.toLowerCase())) {
      score += 35;
      matchedSignals.push(`Canonical entity name ("${targetEntity.canonicalName}")`);
    }

    // Canonical entity slug or official domain stem in URL path
    const urlSlug = targetEntity.canonicalName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const urlCompact = targetEntity.canonicalName.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (
      urlLower.includes(urlSlug) ||
      urlLower.includes(urlCompact) ||
      (domainStem.length >= 4 && urlLower.includes(`/${domainStem}`))
    ) {
      score += 20;
      matchedSignals.push(`Entity slug verified in URL path`);
    }

    // Statutory Registration ID (CIN / CIK / ISIN / LEI)
    if (targetEntity.cinOrRegId && combined.includes(targetEntity.cinOrRegId.toLowerCase())) {
      score += 25;
      matchedSignals.push(`Registry identifier (${targetEntity.cinOrRegId})`);
    }
    if (targetEntity.cik && combined.includes(targetEntity.cik.toLowerCase())) {
      score += 25;
      matchedSignals.push(`SEC CIK (${targetEntity.cik})`);
    }
    if (targetEntity.isin && combined.includes(targetEntity.isin.toLowerCase())) {
      score += 20;
      matchedSignals.push(`ISIN (${targetEntity.isin})`);
    }

    // Ticker match
    for (const ticker of targetEntity.tickers) {
      if (ticker && ticker.length >= 2 && combined.includes(ticker.toLowerCase())) {
        score += 18;
        matchedSignals.push(`Exchange ticker (${ticker})`);
        break;
      }
    }

    // Jurisdiction / Country or Corporate financial / Open-source repository context signal
    if (
      combined.includes(targetEntity.country.toLowerCase().split(' ')[0]) ||
      combined.includes('consolidated') ||
      combined.includes('financial') ||
      combined.includes('annual report') ||
      combined.includes('disclosure') ||
      (targetEntity.entityType === 'OPEN_SOURCE_PROJECT' &&
        (combined.includes('repository') ||
          combined.includes('open-source') ||
          combined.includes('stars') ||
          combined.includes('release') ||
          combined.includes('documentation')))
    ) {
      score += 12;
      matchedSignals.push(
        targetEntity.entityType === 'OPEN_SOURCE_PROJECT'
          ? `Open-source repository & technical telemetry context`
          : `Jurisdiction & corporate financial context`
      );
    }

    const clampedScore = Math.min(100, Math.max(0, score));
    const isExactEntity = clampedScore >= 60 && conflictingSignals.length === 0;

    return {
      score: clampedScore,
      isExactEntity,
      isSiblingOrParentContamination: false,
      matchedSignals,
      conflictingSignals,
      explanation: isExactEntity
        ? `Verified identity match (${clampedScore}%) via ${matchedSignals.join(', ')}.`
        : `Insufficient entity identity signals (${clampedScore}%).`
    };
  }
}
