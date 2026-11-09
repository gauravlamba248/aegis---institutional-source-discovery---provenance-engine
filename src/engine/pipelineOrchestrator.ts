import {
  AegisPipelineRun,
  AnalysisIntent,
  HttpRetrievalTelemetry,
  RegressionTestResult,
  ZeroSourceDiagnosticCode
} from './types';
import { EntityResolver } from './EntityResolver';
import { getJurisdictionProfile } from './jurisdictionRegistry';
import { LiveEvidenceCollector } from './LiveEvidenceCollector';
import { DocumentDiscoverer } from './DocumentDiscoverer';
import { SourceDiscoverer } from './SourceDiscoverer';
import { SourceSelector } from './SourceSelector';
import { FactExtractor } from './FactExtractor';
import { CrossValidator } from './CrossValidator';
import { FinancialAnalysisEngine } from './FinancialAnalysisEngine';
import { SourceLedger } from './SourceLedger';

export const REGRESSION_MATRIX_ENTITIES: { query: string; category: string }[] = [
  // Mandatory Previously Uncatalogued Real-World Companies (Requirement #20)
  { query: 'Financial analysis of Wipro', category: 'Open-World India IT Services (NSE/BSE/SEC 20-F)' },
  { query: 'Financial analysis of Larsen & Toubro', category: 'Open-World India Engineering Conglomerate (NSE/BSE)' },
  { query: 'Financial analysis of Adani Enterprises', category: 'Open-World India Infrastructure Incubator (NSE/BSE)' },
  { query: 'Financial analysis of Hindustan Unilever', category: 'Open-World India FMCG Leader (NSE/BSE)' },
  { query: 'Financial analysis of Bharti Airtel', category: 'Open-World India Telecommunications (NSE/BSE)' },
  { query: 'Financial analysis of Maruti Suzuki', category: 'Open-World India Automotive Leader (NSE/BSE)' },
  // Tata Group Sibling Isolation Matrix (Requirement #17)
  { query: 'Financial analysis of TATA Industries', category: 'India Unlisted RBI CIC (Live PDF Annual Report)' },
  { query: 'Financial analysis of Tata Motors', category: 'India Public Equity (NSE/BSE Sibling Isolation)' },
  { query: 'Financial analysis of Tata Steel', category: 'India Public Equity (NSE/BSE Sibling Isolation)' },
  { query: 'Financial analysis of TCS', category: 'India Public Equity (NSE/BSE Sibling Isolation)' },
  { query: 'Financial analysis of Tata Sons', category: 'India Unlisted Holding Company (Live PDF / Citation)' },
  // Additional Indian Corporate & Banking Entities
  { query: 'Financial analysis of Reliance Industries', category: 'India Conglomerate (NSE/BSE)' },
  { query: 'Financial analysis of Infosys', category: 'India / US Dual Listed (NSE/NYSE)' },
  { query: 'Financial analysis of HDFC Bank', category: 'India Banking (RBI / NSE / BSE)' },
  { query: 'Financial analysis of ICICI Bank', category: 'India Banking (RBI / NSE / BSE)' },
  // Global Multi-Jurisdiction Public Equities (Requirement #20)
  { query: 'Financial analysis of Apple Inc.', category: 'US Public Equity (SEC EDGAR XBRL 10-K)' },
  { query: 'Financial analysis of Microsoft', category: 'US Public Equity (SEC EDGAR XBRL 10-K)' },
  { query: 'Financial analysis of Toyota', category: 'Japan Public Equity (TSE / EDINET / SEC 20-F)' },
  { query: 'Financial analysis of Samsung Electronics', category: 'South Korea Public Equity (DART / KRX)' },
  { query: 'Financial analysis of Siemens', category: 'Germany / EU Public Equity (BaFin / XETRA)' },
  { query: 'Financial analysis of Shell', category: 'UK / Europe Public Equity (Companies House / LSE)' },
  { query: 'Financial analysis of Alibaba', category: 'China / HK Dual Primary (HKEX / SEC 20-F)' },
  // Private Companies & Open-Source Projects (Requirement #21)
  { query: 'Financial analysis of Stripe', category: 'Private Corporation (Missing Balance Sheet Guard)' },
  { query: 'Financial analysis of OpenAI', category: 'Private AI Research Entity (Missing Balance Sheet Guard)' },
  { query: 'Technology analysis of Kubernetes', category: 'Global Open-Source Project (Live GitHub API / CNCF)' }
];

const pipelineRunCache = new Map<string, AegisPipelineRun>();

export class AegisPipelineOrchestrator {
  /**
   * Executes the complete live Open-World Aegis Pipeline asynchronously over real HTTPS.
   * Contains ZERO static entity registries, ZERO hardcoded URLs, ZERO static financial datasets,
   * and ZERO synthetic fallback multipliers.
   */
  public static async executePipelineAsync(params: {
    query: string;
    explicitIntent?: AnalysisIntent;
    maxSources?: number;
    forcedDiagnosticMode?: ZeroSourceDiagnosticCode;
    bypassCache?: boolean;
  }): Promise<AegisPipelineRun> {
    const {
      query,
      explicitIntent,
      maxSources = 4,
      forcedDiagnosticMode = 'NONE',
      bypassCache = false
    } = params;

    const cacheKey = `${query.trim().toLowerCase()}|${explicitIntent || 'AUTO'}|${maxSources}|${forcedDiagnosticMode}`;
    if (!bypassCache && pipelineRunCache.has(cacheKey)) {
      return pipelineRunCache.get(cacheKey)!;
    }

    const httpTelemetry: HttpRetrievalTelemetry[] = [];

    // Stage 1 & 2: Live Open-World Entity Resolution & Sibling Disambiguation
    const entityResolution = await EntityResolver.resolveAsync(
      query,
      explicitIntent,
      httpTelemetry
    );
    const intent = entityResolution.detectedIntent;
    const resolvedEntity = entityResolution.resolvedEntity;

    if (!resolvedEntity || forcedDiagnosticMode !== 'NONE') {
      const jurisdictionProfile = resolvedEntity
        ? getJurisdictionProfile(resolvedEntity.jurisdiction, resolvedEntity.country)
        : null;

      const ledgerStats = SourceLedger.compileLedgerSummary({
        maxSourcesRequested: maxSources,
        entityResolution,
        allCandidates: [],
        selectedSources: [],
        provenancedFacts: [],
        forcedDiagnosticMode
      });

      const emptyModels = FinancialAnalysisEngine.computeModels(
        resolvedEntity || ({ entityId: 'NONE', entityType: 'PUBLIC_COMPANY', sector: '' } as any),
        [],
        [],
        []
      );

      const haltedRun: AegisPipelineRun = {
        runId: `AEGIS_LIVE_${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        executionMode: 'LIVE_NETWORK',
        query,
        intent,
        maxSourcesRequested: maxSources,
        entityResolution,
        jurisdictionProfile,
        targetedSearchQueries: [],
        deepWebCrawlTree: [],
        discoveredDocuments: [],
        sourceLedger: [],
        selectedSources: [],
        provenancedFacts: [],
        missingMetrics: [],
        crossVerifications: [],
        fallbackRecords: [],
        financialAnalysis: emptyModels,
        analysisConfidence: emptyModels.analysisConfidence,
        httpTelemetry,
        ledgerStats
      };
      return haltedRun;
    }

    // Stage 3: Jurisdiction Detection
    const jurisdictionProfile = getJurisdictionProfile(
      resolvedEntity.jurisdiction,
      resolvedEntity.country
    );

    // Stage 4: Live HTTPS Retrieval, Deep IR/PDF Crawl, Screener HTML & SEC XBRL Extraction
    const liveBundle = await LiveEvidenceCollector.collectEvidenceForEntity(
      resolvedEntity,
      jurisdictionProfile,
      intent,
      httpTelemetry
    );

    if (liveBundle.discoveredCinOrRegId && !resolvedEntity.cinOrRegId) {
      resolvedEntity.cinOrRegId = liveBundle.discoveredCinOrRegId;
    }
    if (liveBundle.discoveredIsin && !resolvedEntity.isin) {
      resolvedEntity.isin = liveBundle.discoveredIsin;
    }

    const deepWebCrawlTree = DocumentDiscoverer.getLiveCrawlTree(liveBundle);
    const discoveredDocuments = DocumentDiscoverer.getLiveDocuments(liveBundle);

    // Stage 5: Targeted Search Queries & Live Candidate Source Classification + Scoring
    const targetedSearchQueries = SourceDiscoverer.generateTargetedSearches(
      resolvedEntity,
      jurisdictionProfile,
      intent
    );

    const evaluatedCandidates = SourceDiscoverer.evaluateLiveCandidateSources(
      resolvedEntity,
      jurisdictionProfile,
      intent,
      liveBundle.candidateSources
    );

    // Stage 6 & 7: Quality-Driven Source Selection (Search-Rank Independent)
    const initialLedger = SourceSelector.selectOptimalSources(
      evaluatedCandidates,
      maxSources,
      intent
    );
    const initialSelectedSources = initialLedger.filter((s) => s.selected);

    // Stage 8 & 9: Live Fact Extraction, Missing Data Policy & Provenance Binding
    const {
      facts: provenancedFacts,
      fallbacks: fallbackRecords,
      missingMetrics
    } = FactExtractor.extractProvenancedFactsFromLiveBundle(
      resolvedEntity,
      jurisdictionProfile,
      initialSelectedSources,
      liveBundle
    );

    // Stage 10: Multi-Source Cross-Verification (Zero Synthetic Multipliers)
    const crossVerifications = CrossValidator.crossVerifyLiveMetrics(
      resolvedEntity,
      initialSelectedSources,
      liveBundle,
      initialLedger
    );

    // Stage 11: Quantitative Financial Models & 5-Dimensional Confidence
    const financialAnalysis = FinancialAnalysisEngine.computeModels(
      resolvedEntity,
      provenancedFacts,
      initialSelectedSources,
      missingMetrics,
      liveBundle
    );

    // Reconcile truthful source lifecycle stages AFTER fact extraction & model computation (Sections 5 & 26)
    const evaluatedLedger = SourceSelector.reconcileSourceLifecycle(
      initialLedger,
      provenancedFacts,
      financialAnalysis
    );
    const selectedSources = evaluatedLedger.filter((s) => s.selected);

    // Stage 12: Auditable Source Ledger Summary
    const ledgerStats = SourceLedger.compileLedgerSummary({
      maxSourcesRequested: maxSources,
      entityResolution,
      allCandidates: evaluatedLedger,
      selectedSources,
      provenancedFacts
    });

    const completedRun: AegisPipelineRun = {
      runId: `AEGIS_LIVE_${resolvedEntity.entityId}_${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      executionMode: 'LIVE_NETWORK',
      query,
      intent,
      maxSourcesRequested: maxSources,
      entityResolution,
      jurisdictionProfile,
      targetedSearchQueries,
      deepWebCrawlTree,
      discoveredDocuments,
      sourceLedger: evaluatedLedger,
      selectedSources,
      provenancedFacts,
      missingMetrics,
      crossVerifications,
      fallbackRecords,
      financialAnalysis,
      analysisConfidence: financialAnalysis.analysisConfidence,
      httpTelemetry,
      ledgerStats
    };

    pipelineRunCache.set(cacheKey, completedRun);
    return completedRun;
  }

  /**
   * Executes the full open-world regression matrix over live HTTPS.
   */
  public static async runFullRegressionMatrixAsync(maxSources = 4): Promise<RegressionTestResult[]> {
    const results: RegressionTestResult[] = [];
    for (const item of REGRESSION_MATRIX_ENTITIES) {
      const run = await this.executePipelineAsync({ query: item.query, maxSources });
      const entity = run.entityResolution.resolvedEntity;
      const tier1Count = run.selectedSources.filter((s) => s.tier === 'TIER_1_OFFICIAL').length;
      const tier2Count = run.selectedSources.filter((s) => s.tier === 'TIER_2_REGULATOR_EXCHANGE').length;
      const wikipediaSelected = run.selectedSources.some((s) => s.source_type === 'GENERAL_REFERENCE');
      const siblingBlocked =
        entity && entity.siblingEntitiesExcluded.length > 0
          ? run.sourceLedger.some(
              (s) => s.entity_match_evaluation.isSiblingOrParentContamination && !s.selected
            )
          : true;
      const revFact =
        run.provenancedFacts.find((f) => f.metric_key === 'revenue') ||
        run.provenancedFacts[0];
      const topSource = run.selectedSources[0];

      const passedAllInvariants =
        run.entityResolution.status === 'VERIFIED' &&
        run.selectedSources.length > 0 &&
        !wikipediaSelected &&
        siblingBlocked &&
        run.provenancedFacts.length > 0;

      results.push({
        testEntityQuery: item.query,
        expectedCategory: item.category,
        executionMode: 'LIVE',
        resolvedStatus: run.entityResolution.status,
        resolvedCanonicalName: entity?.canonicalName || 'UNRESOLVED',
        resolvedLegalName: entity?.legalName || 'UNRESOLVED',
        jurisdiction: run.jurisdictionProfile?.countryName || 'N/A',
        regulatorsUsed: run.jurisdictionProfile?.primaryRegulators.slice(0, 2) || [],
        discoveredCount: run.sourceLedger.length,
        selectedCount: run.selectedSources.length,
        tier1Count,
        tier2Count,
        wikipediaSelectedAsPrimaryFinancial: wikipediaSelected,
        siblingContaminationBlocked: siblingBlocked,
        topSourceTitle: topSource?.title || 'None',
        topSourceScore: topSource?.quality_score || 0,
        verifiedRevenueFormatted: revFact?.formatted_value || 'DATA UNAVAILABLE',
        qualityGrade: run.ledgerStats.overallDataQuality,
        passedAllInvariants
      });
    }
    return results;
  }
}
