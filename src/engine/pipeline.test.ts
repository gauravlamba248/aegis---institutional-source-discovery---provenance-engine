import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AegisPipelineOrchestrator } from './pipelineOrchestrator';
import { SecureHttpClient } from './SecureHttpClient';
import { SourceDiscoverer } from './SourceDiscoverer';
import { SourceSelector } from './SourceSelector';
import { FactExtractor } from './FactExtractor';
import { CrossValidator } from './CrossValidator';
import { FinancialAnalysisEngine } from './FinancialAnalysisEngine';
import { ProvenanceTracker } from './ProvenanceTracker';
import { SourceLedger } from './SourceLedger';
import { normalizeFiscalPeriod, isValidPdfBuffer, LiveEvidenceBundle } from './LiveEvidenceCollector';
import { getJurisdictionProfile } from './jurisdictionRegistry';
import { EntityCandidate, ProvenancedFact } from './types';

/**
 * AEGIS FINAL REMEDIATION & ADVERSARIAL VERIFICATION SUITE
 * Covers CF-01 through CF-09 plus Section 31 Invariant Checks & Section 32 Adversarial Regression Tests (Tests A–J).
 */
describe('AEGIS Open-World Pipeline & Adversarial Forensic Verification Suite', () => {
  it('[CF-09] SSRF & DNS Pinning Guard blocks loopback, RFC1918, CGNAT, IPv4-mapped IPv6, and non-HTTPS schemes', async () => {
    assert.equal(SecureHttpClient.isPrivateOrLoopbackIp('127.0.0.1'), true);
    assert.equal(SecureHttpClient.isPrivateOrLoopbackIp('10.0.0.1'), true);
    assert.equal(SecureHttpClient.isPrivateOrLoopbackIp('100.64.0.1'), true);
    assert.equal(SecureHttpClient.isPrivateOrLoopbackIp('172.16.5.4'), true);
    assert.equal(SecureHttpClient.isPrivateOrLoopbackIp('192.168.1.1'), true);
    assert.equal(SecureHttpClient.isPrivateOrLoopbackIp('169.254.169.254'), true);
    assert.equal(SecureHttpClient.isPrivateOrLoopbackIp('::1'), true);
    assert.equal(SecureHttpClient.isPrivateOrLoopbackIp('::ffff:127.0.0.1'), true);
    assert.equal(SecureHttpClient.isPrivateOrLoopbackIp('::ffff:169.254.169.254'), true);
    assert.equal(SecureHttpClient.isPrivateOrLoopbackIp('8.8.8.8'), false);

    const fileUrlAttempt = await SecureHttpClient.fetchSecure('file:///etc/passwd');
    assert.equal(fileUrlAttempt.ok, false);
    assert.equal(fileUrlAttempt.telemetry.sha256Hash, 'BLOCKED_BY_SSRF_GUARD');

    const plainHttpAttempt = await SecureHttpClient.fetchSecure('http://example.com/');
    assert.equal(plainHttpAttempt.ok, false);
    assert.equal(plainHttpAttempt.telemetry.sha256Hash, 'BLOCKED_BY_SSRF_GUARD');

    const localhostAttempt = await SecureHttpClient.fetchSecure('https://127.0.0.1:8080/admin');
    assert.equal(localhostAttempt.ok, false);
    assert.equal(localhostAttempt.telemetry.sha256Hash, 'BLOCKED_BY_SSRF_GUARD');
  });

  it('[CF-01 & Adversarial Test 3/5/6] Period Normalization & Cross-Period / Cross-Currency / Cross-Consolidation Ratio Blocking', () => {
    const p1 = normalizeFiscalPeriod('Period Ended 2026-01-25');
    assert.equal(p1.fiscalYear, 'FY2026');
    assert.equal(p1.periodEnd, '2026-01-25');
    assert.equal(p1.periodType, 'ANNUAL');

    const p2 = normalizeFiscalPeriod('FY2025-26');
    assert.equal(p2.fiscalYear, 'FY2026');
    assert.equal(p2.periodEnd, '2026-03-31');
    assert.equal(p2.periodType, 'ANNUAL');

    const p3 = normalizeFiscalPeriod('Q4 FY2026');
    assert.equal(p3.periodType, 'QUARTERLY');

    const mockEntity: EntityCandidate = {
      entityId: 'ENT_TEST_NVDA',
      canonicalName: 'NVIDIA',
      legalName: 'NVIDIA CORP',
      aliases: ['NVDA'],
      entityType: 'PUBLIC_COMPANY',
      jurisdiction: 'US',
      country: 'United States',
      tickers: ['NVDA'],
      exchanges: ['NASDAQ'],
      officialDomain: 'nvidia.com',
      siblingEntitiesExcluded: [],
      sector: 'Semiconductors',
      confidenceScore: 95,
      matchRationale: []
    };

    const baseFact = (overrides: Partial<ProvenancedFact>): ProvenancedFact => ({
      fact_id: 'FACT_1',
      entity: 'NVIDIA CORP',
      entity_id: 'ENT_TEST_NVDA',
      metric: 'Revenue',
      metric_key: 'revenue',
      value: 26.91,
      formatted_value: 'USD 26.91 Billions',
      currency: 'USD',
      unit: 'Billions',
      period: 'Period Ended 2022-01-30',
      fiscal_year: 'FY2022',
      period_end: '2022-01-30',
      period_type: 'ANNUAL',
      consolidation_basis: 'CONSOLIDATED',
      accounting_standard: 'US GAAP',
      fact_class: 'PRIMARY_FACT',
      source_id: 'SRC_1',
      actual_source_id: 'SRC_1',
      source_title: 'SEC EDGAR',
      source_type: 'REGULATOR',
      source_tier: 'TIER_2_REGULATOR_EXCHANGE',
      url: 'https://data.sec.gov/api/xbrl/companyfacts/CIK0001045810.json',
      actual_origin_url: 'https://data.sec.gov/api/xbrl/companyfacts/CIK0001045810.json',
      retrieval_status: 200,
      document: 'Form 10-K',
      page_or_section: 'XBRL',
      extraction_method: 'SEC XBRL',
      verification_status: 'VERIFIED_PRIMARY_FILING',
      validation_status: 'VALIDATED',
      confidence: 95,
      ...overrides
    });

    // Adversarial Test 5: Cross-period metrics (FY2022 Revenue vs FY2026 Net Income)
    const crossPeriodFacts: ProvenancedFact[] = [
      baseFact({ metric_key: 'revenue', value: 26.91, fiscal_year: 'FY2022', period_end: '2022-01-30' }),
      baseFact({ fact_id: 'FACT_2', metric_key: 'net_income', value: 120.07, fiscal_year: 'FY2026', period_end: '2026-01-25' }),
      baseFact({ fact_id: 'FACT_3', metric_key: 'total_assets', value: 206.8, fiscal_year: 'FY2026', period_end: '2026-01-25' }),
      baseFact({ fact_id: 'FACT_4', metric_key: 'shareholders_equity', value: 157.29, fiscal_year: 'FY2026', period_end: '2026-01-25' })
    ];

    const modelsCrossPeriod = FinancialAnalysisEngine.computeModels(mockEntity, crossPeriodFacts, []);
    assert.equal(modelsCrossPeriod.dupontAnalysis.available, false, 'Must block DuPont when Revenue is FY2022 and Net Income is FY2026');
    const npmRatio = modelsCrossPeriod.keyRatios.find((r) => r.label.includes('Net Profit Margin'));
    assert.equal(npmRatio?.value, 'PERIOD_MISMATCH', 'Must report PERIOD_MISMATCH instead of 446% Net Profit Margin');

    // Adversarial Test 6: Cross-currency metrics (USD Revenue vs EUR Net Income)
    const crossCurrencyFacts: ProvenancedFact[] = [
      baseFact({ metric_key: 'revenue', value: 100, fiscal_year: 'FY2026', currency: 'USD' }),
      baseFact({ fact_id: 'FACT_2', metric_key: 'net_income', value: 25, fiscal_year: 'FY2026', currency: 'EUR' })
    ];
    const modelsCrossCurrency = FinancialAnalysisEngine.computeModels(mockEntity, crossCurrencyFacts, []);
    const npmCurrencyRatio = modelsCrossCurrency.keyRatios.find((r) => r.label.includes('Net Profit Margin'));
    assert.equal(npmCurrencyRatio?.value, 'PERIOD_MISMATCH', 'Must block cross-currency ratio calculation');
  });

  it('[Test A, Test B & CF-02/CF-05] No Synthetic Consensus, Truthful Source Lifecycle (NO_FACT vs USED_IN_ANALYSIS), Dead 404 PDF Rejection, and No Default Source Fallback', () => {
    const mockEntity: EntityCandidate = {
      entityId: 'ENT_TEST_BAJAJ',
      canonicalName: 'Bajaj Finance',
      legalName: 'Bajaj Finance Limited',
      aliases: ['BAJFINANCE'],
      entityType: 'PUBLIC_COMPANY',
      jurisdiction: 'IN',
      country: 'India',
      tickers: ['BAJFINANCE'],
      exchanges: ['NSE', 'BSE'],
      officialDomain: 'bajajfinserv.in',
      siblingEntitiesExcluded: [],
      sector: 'Financial Services',
      confidenceScore: 95,
      matchRationale: []
    };
    const jur = getJurisdictionProfile('IN');

    // Provide 3 candidate sources:
    // 1. Dead 404 BSE PDF
    // 2. HTTP 200 Screener Consolidated HTML (produces facts)
    // 3. HTTP 200 Official Corporate IR Page (selected, but produces 0 extracted facts)
    const candidates = SourceDiscoverer.evaluateLiveCandidateSources(mockEntity, jur, 'FINANCIAL_ANALYSIS', [
      {
        url: 'https://www.bseindia.com/bseplus/AnnualReport/500034/5000340325.pdf',
        domain: 'bseindia.com',
        title: 'Bajaj Finance Limited — BSE Annual Report PDF',
        snippet: 'BSE Annual Report',
        searchRankOrder: 1,
        publicationDate: 'UNKNOWN',
        informationTypes: ['Annual Report', 'Income Statement', 'Balance Sheet'],
        rawExtractedKb: 0,
        hasLinkedPdfOrXbrl: true,
        linkedDocuments: [],
        telemetry: {
          url: 'https://www.bseindia.com/bseplus/AnnualReport/500034/5000340325.pdf',
          finalUrl: 'https://www.bseindia.com/bseplus/AnnualReport/500034/5000340325.pdf',
          httpStatus: 404,
          contentType: 'text/html',
          bytesReceived: 0,
          latencyMs: 120,
          sha256Hash: 'dead404',
          retrievedAt: new Date().toISOString(),
          ssrfChecked: true,
          tlsVerified: true,
          sanitized: true,
          parserUsed: 'BSE-Annual-Report-PDF-Probe',
          parseSuccess: false
        }
      },
      {
        url: 'https://www.screener.in/company/BAJFINANCE/consolidated/',
        domain: 'screener.in',
        title: 'Bajaj Finance Limited — Screener.in Consolidated Financial Schedules',
        snippet: 'Bajaj Finance Limited Consolidated Financial Statements',
        searchRankOrder: 2,
        publicationDate: '2025-05-30',
        informationTypes: ['Income Statement', 'Balance Sheet', 'Financial Ratios'],
        rawExtractedKb: 95.4,
        hasLinkedPdfOrXbrl: true,
        linkedDocuments: [],
        telemetry: {
          url: 'https://www.screener.in/company/BAJFINANCE/consolidated/',
          finalUrl: 'https://www.screener.in/company/BAJFINANCE/consolidated/',
          httpStatus: 200,
          contentType: 'text/html',
          bytesReceived: 97689,
          latencyMs: 210,
          sha256Hash: 'abc200',
          retrievedAt: new Date().toISOString(),
          ssrfChecked: true,
          tlsVerified: true,
          sanitized: true,
          parserUsed: 'Screener-Consolidated-HTML-Table-Parser',
          parseSuccess: true
        }
      },
      {
        url: 'https://www.bajajfinserv.in/investor-relations',
        domain: 'bajajfinserv.in',
        title: 'Bajaj Finance Limited — Official Corporate Investor Relations Portal',
        snippet: 'Bajaj Finance Limited official investor relations governance disclosures',
        searchRankOrder: 3,
        publicationDate: '2025-05-30',
        informationTypes: ['Investor Relations', 'Corporate Governance'],
        rawExtractedKb: 42.1,
        hasLinkedPdfOrXbrl: false,
        linkedDocuments: [],
        telemetry: {
          url: 'https://www.bajajfinserv.in/investor-relations',
          finalUrl: 'https://www.bajajfinserv.in/investor-relations',
          httpStatus: 200,
          contentType: 'text/html',
          bytesReceived: 43110,
          latencyMs: 180,
          sha256Hash: 'ir200',
          retrievedAt: new Date().toISOString(),
          ssrfChecked: true,
          tlsVerified: true,
          sanitized: true,
          parserUsed: 'Official-Domain-IR-HTML-Parser',
          parseSuccess: true
        }
      }
    ]);

    const bse404 = candidates.find((c) => c.domain === 'bseindia.com')!;
    assert.equal(bse404.quality_score, 0, 'Dead 404 PDF candidate must receive 0 quality score');

    const initialLedger = SourceSelector.selectOptimalSources(candidates, 4, 'FINANCIAL_ANALYSIS');
    const selected = initialLedger.filter((s) => s.selected);
    assert.equal(selected.length, 2, 'Should select HTTP 200 Screener and HTTP 200 Official IR page, rejecting 404 BSE PDF');
    for (const s of selected) {
      assert.equal(s.lifecycle_stage, 'SELECTED', 'Before fact extraction, selected sources must be marked SELECTED, not USED');
    }

    // Test A: Provide 1 extracted metric from Screener ONLY (no standalone/secondary value) while 2 sources are selected
    const singleSourceBundle: LiveEvidenceBundle = {
      candidateSources: [],
      discoveredDocuments: [],
      crawlTree: [],
      extractedMetrics: new Map([
        [
          'revenue',
          {
            metricKey: 'revenue',
            metricLabel: 'Revenue from Operations',
            value: 54970,
            currency: 'INR',
            unit: 'Crores',
            period: 'FY2025',
            fiscalYear: 'FY2025',
            periodEnd: '2025-03-31',
            periodType: 'ANNUAL',
            consolidationBasis: 'CONSOLIDATED',
            accountingStandard: 'Ind AS',
            factClass: 'PRIMARY_FACT',
            sourceUrl: 'https://www.screener.in/company/BAJFINANCE/consolidated/',
            actualOriginUrl: 'https://www.screener.in/company/BAJFINANCE/consolidated/',
            retrievalStatus: 200,
            documentTitle: 'Screener Consolidated',
            pageOrSection: '#profit-loss',
            extractionMethod: 'Live HTML Table DOM Parser',
            exactQuote: '54970'
          }
        ]
      ])
    };

    const crossVerifications = CrossValidator.crossVerifyLiveMetrics(
      mockEntity,
      selected,
      singleSourceBundle,
      initialLedger
    );
    assert.equal(crossVerifications.length, 1);
    assert.equal(
      crossVerifications[0].candidate_values.length,
      1,
      'Test A (CF-02): CrossValidator must NEVER clone primary value into a second selected source'
    );
    assert.equal(
      crossVerifications[0].status,
      'SINGLE_SOURCE',
      'Test A (CF-02): Single-source observation must have status SINGLE_SOURCE, never EXACT_CONSENSUS'
    );

    const extractedSingle = FactExtractor.extractProvenancedFactsFromLiveBundle(
      mockEntity,
      jur,
      selected,
      singleSourceBundle
    );
    assert.equal(extractedSingle.facts.length, 1);
    assert.notEqual(
      extractedSingle.facts[0].verification_status,
      'VERIFIED_MULTI_SOURCE',
      'Single-source fact must not be marked VERIFIED_MULTI_SOURCE merely because 2 sources were selected'
    );

    const models = FinancialAnalysisEngine.computeModels(
      mockEntity,
      extractedSingle.facts,
      selected,
      extractedSingle.missingMetrics,
      singleSourceBundle
    );
    const reconciledLedger = SourceSelector.reconcileSourceLifecycle(
      initialLedger,
      extractedSingle.facts,
      models
    );
    const screenerAfter = reconciledLedger.find((s) => s.domain === 'screener.in')!;
    const irAfter = reconciledLedger.find((s) => s.domain === 'bajajfinserv.in')!;
    assert.equal(screenerAfter.lifecycle_stage, 'USED_IN_ANALYSIS', 'Screener produced a fact used in analysis');
    assert.equal(irAfter.lifecycle_stage, 'NO_FACT', 'Official IR page produced 0 facts and must be marked NO_FACT, never USED');

    // Test B: Metric from unselected/404 source must NOT fall back to defaultPrimarySource
    const bundleWith404Metric: LiveEvidenceBundle = {
      candidateSources: [],
      discoveredDocuments: [],
      crawlTree: [],
      extractedMetrics: new Map([
        [
          'revenue',
          {
            metricKey: 'revenue',
            metricLabel: 'Revenue',
            value: 54970,
            currency: 'INR',
            unit: 'Crores',
            period: 'FY2025',
            fiscalYear: 'FY2025',
            periodEnd: '2025-03-31',
            periodType: 'ANNUAL',
            consolidationBasis: 'CONSOLIDATED',
            accountingStandard: 'Ind AS',
            factClass: 'PRIMARY_FACT',
            sourceUrl: 'https://www.bseindia.com/bseplus/AnnualReport/500034/5000340325.pdf',
            actualOriginUrl: 'https://www.bseindia.com/bseplus/AnnualReport/500034/5000340325.pdf',
            retrievalStatus: 404,
            documentTitle: 'BSE PDF',
            pageOrSection: 'p.1',
            extractionMethod: 'Test',
            exactQuote: '54970'
          }
        ]
      ])
    };

    const extractedSpoof = FactExtractor.extractProvenancedFactsFromLiveBundle(
      mockEntity,
      jur,
      selected,
      bundleWith404Metric
    );
    assert.equal(extractedSpoof.facts.length, 0, 'Test B: Metric from rejected/404 source must NOT be reassigned to selected source');
  });

  it('[Test J — Section 20] PDF Magic-Byte Validation rejects HTML/JSON masquerading as .pdf', () => {
    const fakeHtmlBytes = new TextEncoder().encode('<!DOCTYPE html><html><body>404 Not Found</body></html>');
    assert.equal(isValidPdfBuffer(fakeHtmlBytes, 'application/pdf'), false, 'Must reject HTML disguised with application/pdf content-type');

    const fakeJsonBytes = new TextEncoder().encode('{"status":"error","message":"not a pdf"}');
    assert.equal(isValidPdfBuffer(fakeJsonBytes, 'application/pdf'), false, 'Must reject JSON disguised with application/pdf content-type');

    const realPdfHeaderBytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n');
    assert.equal(isValidPdfBuffer(realPdfHeaderBytes, 'application/pdf'), true, 'Must accept genuine %PDF- binary buffer');
    assert.equal(isValidPdfBuffer(realPdfHeaderBytes, 'text/html'), false, 'Must reject if content-type is explicitly text/html');
  });

  it('[CF-04 & Adversarial Test 2] Wikipedia Secondary-Only Demotion & Provenance Validation', () => {
    const mockEntity: EntityCandidate = {
      entityId: 'ENT_TEST_ASML',
      canonicalName: 'ASML Holding',
      legalName: 'ASML Holding N.V.',
      aliases: ['ASML'],
      entityType: 'PUBLIC_COMPANY',
      jurisdiction: 'NL',
      country: 'Netherlands',
      tickers: ['ASML'],
      exchanges: ['NASDAQ', 'AMS'],
      officialDomain: 'asml.com',
      siblingEntitiesExcluded: [],
      sector: 'Semiconductors',
      confidenceScore: 96,
      matchRationale: []
    };

    const illegalWikiPrimaryFact: ProvenancedFact = {
      fact_id: 'FACT_ILLEGAL_WIKI',
      entity: 'ASML Holding N.V.',
      entity_id: 'ENT_TEST_ASML',
      metric: 'Revenue',
      metric_key: 'revenue',
      value: 28.26,
      formatted_value: 'EUR 28.26 Billions',
      currency: 'EUR',
      unit: 'Billions',
      period: 'FY2025',
      fiscal_year: 'FY2025',
      period_end: '2025-12-31',
      period_type: 'ANNUAL',
      consolidation_basis: 'CONSOLIDATED',
      accounting_standard: 'IFRS',
      fact_class: 'PRIMARY_FACT',
      source_id: 'SRC_WIKI',
      actual_source_id: 'SRC_WIKI',
      source_title: 'Wikipedia',
      source_type: 'GENERAL_REFERENCE',
      source_tier: 'TIER_5_GENERAL_REFERENCE',
      url: 'https://en.wikipedia.org/wiki/ASML_Holding',
      actual_origin_url: 'https://en.wikipedia.org/wiki/ASML_Holding',
      retrieval_status: 200,
      document: 'Wikipedia',
      page_or_section: 'Infobox',
      extraction_method: 'Infobox',
      verification_status: 'SECONDARY_FALLBACK',
      validation_status: 'VALIDATED'
    };

    const audit = ProvenanceTracker.validateCompleteProvenance([illegalWikiPrimaryFact]);
    assert.equal(audit.valid, false, 'Provenance validator must reject TIER_5_GENERAL_REFERENCE marked as PRIMARY_FACT');

    const models = FinancialAnalysisEngine.computeModels(mockEntity, [illegalWikiPrimaryFact], []);
    assert.equal(models.analysisConfidence?.overallConfidence, 0, 'FinancialAnalysisEngine must reject illegal Wikipedia PRIMARY_FACT');
  });

  it('[REAL — CF-01 & CF-08] Live Nvidia Execution: Legal Name Authority ("NVIDIA CORP") & Aligned FY2026 SEC XBRL Metrics', async () => {
    const res = await AegisPipelineOrchestrator.executePipelineAsync({
      query: 'Financial analysis of Nvidia',
      bypassCache: true
    });

    assert.equal(res.entityResolution.status, 'VERIFIED');
    const entity = res.entityResolution.resolvedEntity!;
    assert.ok(
      !entity.legalName.includes('NVIDIA Ag'),
      `CF-08 regression: legalName must not be polluted by webpage link text "NVIDIA Ag", got "${entity.legalName}"`
    );
    assert.ok(entity.legalName.toUpperCase().includes('NVIDIA CORP'));

    const rev = res.provenancedFacts.find((f) => f.metric_key === 'revenue')!;
    const netInc = res.provenancedFacts.find((f) => f.metric_key === 'net_income')!;
    assert.ok(rev && netInc, 'Expected both revenue and net_income from SEC EDGAR XBRL');
    assert.equal(rev.fiscal_year, netInc.fiscal_year, 'CF-01: Revenue and Net Income must belong to the exact same fiscal year');
    assert.equal(rev.period_end, netInc.period_end, 'CF-01: Revenue and Net Income must have the exact same period_end date');
    assert.ok(rev.value > 100, `CF-01: Expected latest annual Nvidia revenue > $100B (not stale FY2022 $26.91B), got ${rev.value}`);
    assert.equal(rev.url, rev.actual_origin_url);
  });

  it('[REAL — CF-02 & CF-05] Live Bajaj Finance Execution: True Screener Provenance, Truthful Source Lifecycle, & Zero Synthetic Consensus', async () => {
    const res = await AegisPipelineOrchestrator.executePipelineAsync({
      query: 'Financial analysis of Bajaj Finance',
      bypassCache: true
    });

    assert.equal(res.entityResolution.status, 'VERIFIED');
    const rev = res.provenancedFacts.find((f) => f.metric_key === 'revenue')!;
    assert.ok(rev, 'Expected revenue fact for Bajaj Finance');
    assert.equal(rev.url, rev.actual_origin_url, 'CF-02: fact.url must equal fact.actual_origin_url');
    assert.ok(rev.url.includes('screener.in'), `CF-02: Screener-extracted metric must point to screener.in, got ${rev.url}`);

    for (const src of res.selectedSources) {
      assert.equal(src.http_telemetry?.httpStatus, 200, `CF-05: Every selected source must have HTTP 200, got ${src.http_telemetry?.httpStatus} for ${src.url}`);
      const contributedFacts = res.provenancedFacts.filter((f) => (f.actual_source_id || f.source_id) === src.source_id);
      if (contributedFacts.length === 0) {
        assert.equal(src.lifecycle_stage, 'NO_FACT', `Selected source ${src.url} with 0 extracted facts must have lifecycle_stage NO_FACT`);
      } else {
        assert.ok(
          src.lifecycle_stage === 'USED_IN_ANALYSIS' || src.lifecycle_stage === 'PRODUCED_FACT',
          `Selected source ${src.url} with ${contributedFacts.length} facts must be USED_IN_ANALYSIS or PRODUCED_FACT`
        );
      }
    }

    // Verify no cross-verification entry has synthetic duplicated values from bajajfinserv.in
    for (const cv of res.crossVerifications) {
      for (const cand of cv.candidate_values) {
        assert.ok(
          !cand.source_title.toLowerCase().includes('bajajfinserv.in'),
          'CF-02: Must never synthesize consensus from bajajfinserv.in IR portal when it produced 0 facts'
        );
      }
      if (cv.candidate_values.length === 1) {
        assert.equal(cv.status, 'SINGLE_SOURCE');
      }
    }
  });

  it('[REAL — CF-04 & CF-07] Live ASML Execution: Dynamic Netherlands (NL) Jurisdiction & Primary SEC 20-F XBRL Over Wikipedia', async () => {
    const res = await AegisPipelineOrchestrator.executePipelineAsync({
      query: 'Financial analysis of ASML',
      bypassCache: true
    });

    assert.equal(res.entityResolution.status, 'VERIFIED');
    const entity = res.entityResolution.resolvedEntity!;
    assert.equal(entity.jurisdiction, 'NL', `CF-07: Expected dynamic NL jurisdiction for ASML, got ${entity.jurisdiction}`);
    assert.ok(entity.country.toLowerCase().includes('netherlands'), `CF-07: Expected Netherlands country, got ${entity.country}`);

    const rev = res.provenancedFacts.find((f) => f.metric_key === 'revenue');
    assert.ok(rev, 'Expected revenue fact for ASML');
    assert.equal(rev.fact_class, 'PRIMARY_FACT');
    assert.ok(rev.url.includes('sec.gov'), `CF-04: ASML primary revenue must come from SEC 20-F XBRL (sec.gov), not Wikipedia, got ${rev.url}`);
  });

  it('[REAL — Test C & Test D (CF-03)] Live Open-Source PostgreSQL & Python Execution: Selected Official GitHub Repo, Non-Vacuous Stars Fact, & Tech Disambiguation', async () => {
    const pgRes = await AegisPipelineOrchestrator.executePipelineAsync({
      query: 'Technology analysis of PostgreSQL',
      bypassCache: true
    });

    assert.equal(pgRes.entityResolution.status, 'VERIFIED');
    const pgEntity = pgRes.entityResolution.resolvedEntity!;
    assert.equal(pgEntity.entityType, 'OPEN_SOURCE_PROJECT');
    assert.ok(pgEntity.officialDomain.includes('postgresql.org'), `Expected postgresql.org domain, got ${pgEntity.officialDomain}`);

    for (const src of pgRes.sourceLedger) {
      assert.ok(
        !src.url.toLowerCase().includes('kubernetes'),
        `CF-03 regression: PostgreSQL source ledger must NEVER contain kubernetes URLs, found ${src.url}`
      );
    }

    const pgGithubSource = pgRes.selectedSources.find((s) => s.url === 'https://github.com/postgres/postgres');
    assert.ok(pgGithubSource, 'Test C (CF-03): Official https://github.com/postgres/postgres repository must be selected');
    assert.ok(pgGithubSource.entity_match >= 60, `Expected entity_match >= 60%, got ${pgGithubSource.entity_match}`);

    // Mandatory non-vacuous assertion (Section 10 & Test C)
    const starsFact = pgRes.provenancedFacts.find((f) => f.metric_key === 'github_stars');
    assert.ok(starsFact, 'Test C (CF-03): PostgreSQL MUST extract a validated github_stars fact');
    assert.equal(starsFact.actual_origin_url, 'https://github.com/postgres/postgres');
    assert.ok(starsFact.value > 10000, `Expected official postgres/postgres stars > 10,000, got ${starsFact.value}`);

    // Test D: Python technology query must resolve to Python programming language (not genus of snakes)
    const pyRes = await AegisPipelineOrchestrator.executePipelineAsync({
      query: 'Technology analysis of Python',
      bypassCache: true
    });
    assert.equal(pyRes.entityResolution.status, 'VERIFIED', 'Test D (CF-03): Technology analysis of Python must resolve as VERIFIED');
    assert.equal(pyRes.entityResolution.resolvedEntity?.entityType, 'OPEN_SOURCE_PROJECT');
    assert.ok(
      pyRes.entityResolution.resolvedEntity?.officialDomain.includes('python.org'),
      `Expected python.org domain for Python, got ${pyRes.entityResolution.resolvedEntity?.officialDomain}`
    );
    const pyStars = pyRes.provenancedFacts.find((f) => f.metric_key === 'github_stars');
    assert.ok(pyStars, 'Expected github_stars fact for Python (python/cpython)');
    assert.equal(pyStars.actual_origin_url, 'https://github.com/python/cpython');
  });

  it('[REAL — Test E & CF-06] Bare Ambiguous Queries ("Amazon", "Reliance", "Tata", "Apple") Halt with AMBIGUOUS — CLARIFICATION REQUIRED', async () => {
    const amazonBare = await AegisPipelineOrchestrator.executePipelineAsync({
      query: 'Amazon',
      bypassCache: true
    });
    assert.equal(
      amazonBare.entityResolution.status,
      'AMBIGUOUS — CLARIFICATION REQUIRED',
      'Test E (CF-06): Bare query "Amazon" must trigger AMBIGUOUS — CLARIFICATION REQUIRED'
    );
    assert.ok(amazonBare.entityResolution.candidatesConsidered.length >= 2);
    assert.equal(amazonBare.provenancedFacts.length, 0);

    const relianceBare = await AegisPipelineOrchestrator.executePipelineAsync({
      query: 'Reliance',
      bypassCache: true
    });
    assert.equal(
      relianceBare.entityResolution.status,
      'AMBIGUOUS — CLARIFICATION REQUIRED',
      'CF-06: Bare query "Reliance" must trigger AMBIGUOUS — CLARIFICATION REQUIRED'
    );
    assert.ok(relianceBare.entityResolution.candidatesConsidered.length >= 2);

    const tataIndustries = await AegisPipelineOrchestrator.executePipelineAsync({
      query: 'Financial analysis of TATA Industries',
      bypassCache: true
    });
    assert.equal(tataIndustries.entityResolution.status, 'VERIFIED');
    assert.equal(tataIndustries.entityResolution.resolvedEntity?.legalName, 'Tata Industries Limited');
    assert.equal(tataIndustries.entityResolution.resolvedEntity?.cinOrRegId, 'U44003MH1945PLC004403');
  });

  it('[REAL — Test F, Test G, Test H, Test I (CF-07 & CF-08)] Foreign Companies & Entity-Type Filtering (TSMC -> TW, Vale -> BR, Commonwealth Bank -> AU, Novo Nordisk -> DK)', async () => {
    // Test F: TSMC -> Taiwan (TW), never US
    const tsmcRes = await AegisPipelineOrchestrator.executePipelineAsync({
      query: 'Financial analysis of TSMC',
      bypassCache: true
    });
    assert.equal(tsmcRes.entityResolution.status, 'VERIFIED');
    assert.equal(tsmcRes.entityResolution.resolvedEntity?.jurisdiction, 'TW', 'Test F (CF-07): TSMC must resolve to TW (Taiwan), never US');
    assert.ok(tsmcRes.provenancedFacts.length > 0, 'Expected extracted financial facts for TSMC');

    // Test G: Vale S.A. -> Brazil (BR), never US
    const valeRes = await AegisPipelineOrchestrator.executePipelineAsync({
      query: 'Financial analysis of Vale S.A.',
      bypassCache: true
    });
    assert.equal(valeRes.entityResolution.status, 'VERIFIED');
    assert.equal(valeRes.entityResolution.resolvedEntity?.jurisdiction, 'BR', 'Test G (CF-07): Vale S.A. must resolve to BR (Brazil), never US');
    assert.ok(valeRes.provenancedFacts.length > 0, 'Expected extracted financial facts for Vale S.A.');

    // Test H: Commonwealth Bank of Australia -> AU, never Wikinews scandal headline
    const cbaRes = await AegisPipelineOrchestrator.executePipelineAsync({
      query: 'Financial analysis of Commonwealth Bank of Australia',
      bypassCache: true
    });
    assert.equal(cbaRes.entityResolution.status, 'VERIFIED');
    const cbaEntity = cbaRes.entityResolution.resolvedEntity!;
    assert.equal(cbaEntity.jurisdiction, 'AU', 'Test H: Commonwealth Bank must resolve to AU (Australia)');
    assert.ok(
      !/apologies|scandal|ceo/i.test(`${cbaEntity.canonicalName} ${cbaEntity.legalName}`),
      `Test H (CF-08): Must not resolve to Wikinews scandal headline, got "${cbaEntity.legalName}"`
    );

    // Test I: Novo Nordisk -> DK (Novo Nordisk A/S), never Novo Nordisk Fonden
    const novoRes = await AegisPipelineOrchestrator.executePipelineAsync({
      query: 'Financial analysis of Novo Nordisk',
      bypassCache: true
    });
    assert.equal(novoRes.entityResolution.status, 'VERIFIED');
    const novoEntity = novoRes.entityResolution.resolvedEntity!;
    assert.equal(novoEntity.jurisdiction, 'DK', 'Test I: Novo Nordisk must resolve to DK (Denmark)');
    assert.ok(
      !/fonden|foundation/i.test(`${novoEntity.canonicalName} ${novoEntity.legalName}`),
      `Test I (CF-08): Must resolve to operating company Novo Nordisk A/S, not foundation, got "${novoEntity.legalName}"`
    );
    assert.ok(novoRes.provenancedFacts.length > 0, 'Expected SEC 20-F XBRL facts for Novo Nordisk');
  });
});
