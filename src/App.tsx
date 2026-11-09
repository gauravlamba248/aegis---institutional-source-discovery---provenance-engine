import React, { useEffect, useState } from 'react';
import {
  AegisPipelineRun,
  AnalysisIntent,
  RegressionTestResult,
  ZeroSourceDiagnosticCode
} from './engine/types';
import { REGRESSION_MATRIX_ENTITIES } from './engine/pipelineOrchestrator';
import { IntelligenceOverviewView } from './components/IntelligenceOverviewView';
import { SourceLedgerView } from './components/SourceLedgerView';
import { ProvenanceAndCrossVerifyView } from './components/ProvenanceAndCrossVerifyView';
import { RegressionMatrixAndReportView } from './components/RegressionMatrixAndReportView';
import { Download, Loader2, RefreshCw, Search } from 'lucide-react';

type ActiveWorkspaceTab = 'OVERVIEW' | 'LEDGER' | 'PROVENANCE' | 'MATRIX';

export default function App() {
  const [queryInput, setQueryInput] = useState<string>('Financial analysis of Wipro');
  const [committedQuery, setCommittedQuery] = useState<string>('Financial analysis of Wipro');
  const [explicitIntent, setExplicitIntent] = useState<AnalysisIntent | undefined>(undefined);
  const [maxSources, setMaxSources] = useState<number>(4);
  const [diagnosticMode, setDiagnosticMode] = useState<ZeroSourceDiagnosticCode>('NONE');
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('OVERVIEW');
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  const [pipelineRun, setPipelineRun] = useState<AegisPipelineRun | null>(null);
  const [isLoadingRun, setIsLoadingRun] = useState<boolean>(true);
  const [runError, setRunError] = useState<string | null>(null);

  const [regressionResults, setRegressionResults] = useState<RegressionTestResult[]>([]);
  const [isLoadingMatrix, setIsLoadingMatrix] = useState<boolean>(false);

  const executeLiveAnalysis = async (
    targetQuery: string,
    intentOverride: AnalysisIntent | undefined,
    sourcesCap: number,
    diagOverride: ZeroSourceDiagnosticCode,
    bypassCache = false
  ) => {
    setIsLoadingRun(true);
    setRunError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: targetQuery,
          explicitIntent: intentOverride,
          maxSources: sourcesCap,
          forcedDiagnosticMode: diagOverride,
          bypassCache
        })
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from /api/analyze`);
      }
      const data: AegisPipelineRun = await res.json();
      setPipelineRun(data);
    } catch (err: any) {
      setRunError(err?.message || 'Live pipeline retrieval failed');
    } finally {
      setIsLoadingRun(false);
    }
  };

  useEffect(() => {
    executeLiveAnalysis(committedQuery, explicitIntent, maxSources, diagnosticMode);
  }, [committedQuery, explicitIntent, maxSources, diagnosticMode]);

  useEffect(() => {
    if (activeTab === 'MATRIX' && regressionResults.length === 0 && !isLoadingMatrix) {
      setIsLoadingMatrix(true);
      fetch(`/api/regression-matrix?maxSources=${maxSources}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data?.results)) {
            setRegressionResults(data.results);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingMatrix(false));
    }
  }, [activeTab, maxSources, regressionResults.length, isLoadingMatrix]);

  const handleRunQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim()) return;
    setDiagnosticMode('NONE');
    if (committedQuery === queryInput.trim()) {
      executeLiveAnalysis(queryInput.trim(), explicitIntent, maxSources, 'NONE', true);
    } else {
      setCommittedQuery(queryInput.trim());
    }
  };

  const handleQuickEntitySelect = (targetQuery: string, mode: ZeroSourceDiagnosticCode = 'NONE') => {
    setQueryInput(targetQuery);
    setCommittedQuery(targetQuery);
    setDiagnosticMode(mode);
    if (activeTab === 'MATRIX' && mode === 'NONE') {
      setActiveTab('OVERVIEW');
    } else if (mode !== 'NONE') {
      setActiveTab('OVERVIEW');
    }
  };

  const handleExportAuditJson = () => {
    if (!pipelineRun) return;
    const payload = JSON.stringify(pipelineRun, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aegis-live-audit-${(pipelineRun.entityResolution.resolvedEntity?.canonicalName || 'diagnostic').toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportSuccessMessage(`Exported ${a.download}`);
    setTimeout(() => setExportSuccessMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-slate-950/90 sticky top-0 z-30 backdrop-blur">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('OVERVIEW');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          Aegis
        </a>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-400 overflow-x-auto" aria-label="Primary Workspace Navigation">
          {(
            [
              { id: 'OVERVIEW', label: 'Pipeline Overview' },
              { id: 'LEDGER', label: 'Source Ledger & HTTP Telemetry' },
              { id: 'PROVENANCE', label: 'Provenance & Missing Data Guard' },
              { id: 'MATRIX', label: 'Open-World Regression Matrix' }
            ] as const
          ).map((nav) => (
            <button
              key={nav.id}
              type="button"
              onClick={() => setActiveTab(nav.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === nav.id
                  ? 'text-slate-100 border-sky-400 font-semibold'
                  : 'border-transparent hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {nav.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleExportAuditJson}
            disabled={!pipelineRun}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-500 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>{exportSuccessMessage ? 'Exported Audit' : 'Export Live Audit JSON'}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-6 py-8 space-y-8">
        {/* Workspace Command & Intent Bar */}
        <section className="border border-slate-800 bg-slate-900/70 rounded-lg p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-mono text-emerald-400">
                OPEN-WORLD LIVE HTTPS RETRIEVAL · SSRF PROTECTED · ZERO STATIC DATASETS
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mt-1 tracking-tight" style={{ textWrap: 'balance' }}>
                Open-World Entity Discovery, Live Document Extraction & Provenance Engine
              </h1>
            </div>
            <div className="text-xs text-slate-400 font-mono whitespace-nowrap shrink-0">
              Mode: {pipelineRun?.executionMode || 'LIVE_NETWORK'} · HTTP Requests: {pipelineRun?.httpTelemetry?.length || 0} · Cap: {maxSources} Sources
            </div>
          </div>

          <form onSubmit={handleRunQuery} className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-6 relative">
              <label htmlFor="aegis-query-input" className="sr-only">
                Company or Topic Research Query
              </label>
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="aegis-query-input"
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Enter ANY company (e.g., Wipro, Larsen & Toubro, Adani Enterprises, TATA Industries, Apple Inc., Stripe...)"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="lg:col-span-3">
              <label htmlFor="aegis-intent-select" className="sr-only">
                Analysis Intent Strategy
              </label>
              <select
                id="aegis-intent-select"
                value={explicitIntent || 'AUTO'}
                onChange={(e) =>
                  setExplicitIntent(
                    e.target.value === 'AUTO' ? undefined : (e.target.value as AnalysisIntent)
                  )
                }
                className="w-full px-3 py-2.5 text-xs font-medium bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="AUTO">Intent: Auto-Detect from Query</option>
                <option value="FINANCIAL_ANALYSIS">Intent: Financial Analysis (Tier 1–3 Priority)</option>
                <option value="COMPANY_OVERVIEW">Intent: Company Overview</option>
                <option value="COMPETITIVE_ANALYSIS">Intent: Competitive Analysis</option>
                <option value="TECHNOLOGY_ANALYSIS">Intent: Technology Analysis (Docs/GitHub)</option>
                <option value="MARKET_ANALYSIS">Intent: Market Analysis</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label htmlFor="aegis-max-sources" className="sr-only">
                Collect From Maximum Websites
              </label>
              <select
                id="aegis-max-sources"
                value={maxSources}
                onChange={(e) => setMaxSources(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-xs font-medium bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value={2}>Collect: Up to 2 Websites</option>
                <option value={4}>Collect: Up to 4 Websites</option>
                <option value={6}>Collect: Up to 6 Websites</option>
              </select>
            </div>

            <div className="lg:col-span-1">
              <button
                type="submit"
                disabled={isLoadingRun}
                className="w-full h-full py-2.5 px-4 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5"
              >
                {isLoadingRun ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{isLoadingRun ? 'Fetching' : 'Analyze'}</span>
              </button>
            </div>
          </form>

          {/* Regression Matrix Quick-Switch Strip */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-1 font-medium">
              Live Open-World Entities:
            </span>
            {REGRESSION_MATRIX_ENTITIES.map((item) => {
              const shortLabel = item.query
                .replace(/^Financial analysis of /i, '')
                .replace(/^Technology analysis of /i, '');
              const isCurrent =
                committedQuery.toLowerCase() === item.query.toLowerCase() &&
                diagnosticMode === 'NONE';
              return (
                <button
                  key={item.query}
                  type="button"
                  onClick={() => handleQuickEntitySelect(item.query, 'NONE')}
                  className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 ${
                    isCurrent
                      ? 'bg-sky-600 text-white font-medium'
                      : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {shortLabel}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => handleQuickEntitySelect('Tata', 'NONE')}
              className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 ${
                committedQuery === 'Tata'
                  ? 'bg-amber-600 text-white font-medium'
                  : 'bg-slate-950 text-amber-300 border border-amber-500/30 hover:border-amber-400'
              }`}
            >
              Tata (Ambiguity Test)
            </button>
            <button
              type="button"
              onClick={() => handleQuickEntitySelect('Apple', 'NONE')}
              className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 ${
                committedQuery === 'Apple'
                  ? 'bg-amber-600 text-white font-medium'
                  : 'bg-slate-950 text-amber-300 border border-amber-500/30 hover:border-amber-400'
              }`}
            >
              Apple (Bare Ambiguity Test)
            </button>
            <button
              type="button"
              onClick={() => handleQuickEntitySelect('XYZCompanyThatDoesNotExist12345', 'NONE')}
              className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 ${
                committedQuery.includes('XYZCompanyThatDoesNotExist12345')
                  ? 'bg-rose-600 text-white font-medium'
                  : 'bg-slate-950 text-rose-300 border border-rose-500/30 hover:border-rose-400'
              }`}
            >
              Invalid Entity Test
            </button>
          </div>
        </section>

        {isLoadingRun && (
          <div className="border border-sky-500/40 bg-sky-950/20 rounded-lg p-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-sky-400 animate-spin shrink-0" />
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  Executing Live Open-World Discovery & HTTPS Document Extraction for "{committedQuery}"...
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  Probing Screener.in, Wikidata Graph, SEC EDGAR XBRL, Official Corporate Domains & Parsing PDFs/HTML with SSRF Protection
                </div>
              </div>
            </div>
          </div>
        )}

        {runError && (
          <div className="border border-rose-500/40 bg-rose-950/20 rounded-lg p-4 text-xs text-rose-300 font-mono">
            Live Retrieval Error: {runError}
          </div>
        )}

        {pipelineRun && (
          <>
            {/* Full-Width 5-Column KPI / Pipeline Telemetry Strip */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" aria-label="Pipeline Execution Telemetry">
              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-lg">
                <div className="text-xs text-slate-400">Resolved Legal Entity</div>
                <div className="text-base font-bold text-slate-100 mt-1 truncate" title={pipelineRun.entityResolution.resolvedEntity?.legalName || pipelineRun.entityResolution.status}>
                  {pipelineRun.entityResolution.resolvedEntity?.legalName || pipelineRun.entityResolution.status}
                </div>
                <div className="text-xs font-mono text-sky-400 mt-1 truncate">
                  {pipelineRun.entityResolution.resolvedEntity
                    ? `${pipelineRun.jurisdictionProfile?.countryName} · ${pipelineRun.entityResolution.resolvedEntity.cinOrRegId || pipelineRun.entityResolution.resolvedEntity.cik || pipelineRun.entityResolution.resolvedEntity.isin || 'Live Verified'}`
                    : 'Non-Substitution Guard Active'}
                </div>
              </div>

              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-lg">
                <div className="text-xs text-slate-400">Authoritative Websites Selected</div>
                <div className="text-xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                  Websites: {pipelineRun.ledgerStats.selectedSourcesCount}
                </div>
                <div className="text-xs font-mono text-slate-400 mt-1">
                  Discovered: {pipelineRun.ledgerStats.totalDiscoveredCandidates} · Verified: {pipelineRun.ledgerStats.entityVerifiedCount ?? pipelineRun.ledgerStats.selectedSourcesCount}
                </div>
              </div>

              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-lg">
                <div className="text-xs text-slate-400">Live Payload Extracted</div>
                <div className="text-xl font-bold font-mono tabular-nums text-sky-400 mt-1">
                  Raw Extracted: {pipelineRun.ledgerStats.rawExtractedKb.toFixed(1)} KB
                </div>
                <div className="text-xs font-mono text-slate-400 mt-1">
                  {pipelineRun.httpTelemetry?.length || 0} Live HTTP Calls · {pipelineRun.provenancedFacts.length} Facts
                </div>
              </div>

              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-lg">
                <div className="text-xs text-slate-400">Pipeline Evidence Quality</div>
                <div
                  className={`text-lg font-bold font-mono mt-1 truncate ${
                    pipelineRun.ledgerStats.overallDataQuality === 'INSTITUTIONAL_GRADE' ||
                    pipelineRun.ledgerStats.overallDataQuality === 'HIGH_VERIFIED'
                      ? 'text-emerald-400'
                      : pipelineRun.ledgerStats.overallDataQuality === 'PARTIAL_SECONDARY'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  Quality: {pipelineRun.ledgerStats.overallDataQuality}
                </div>
                <div className="text-xs font-mono text-slate-400 mt-1">
                  Missing Metrics: {pipelineRun.missingMetrics?.length || 0}
                </div>
              </div>

              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-lg">
                <div className="text-xs text-slate-400">Overall Analysis Confidence</div>
                <div
                  className={`text-xl font-bold font-mono tabular-nums mt-1 ${
                    (pipelineRun.analysisConfidence?.overallConfidence || 0) >= 80
                      ? 'text-emerald-400'
                      : (pipelineRun.analysisConfidence?.overallConfidence || 0) >= 50
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {pipelineRun.analysisConfidence?.overallConfidence ?? 0}% ({pipelineRun.analysisConfidence?.confidenceGrade || 'N/A'})
                </div>
                <div className="text-xs font-mono text-slate-400 mt-1">
                  Data: {pipelineRun.analysisConfidence?.dataConfidence ?? 0}% · Calc: {pipelineRun.analysisConfidence?.calculationConfidence ?? 0}%
                </div>
              </div>
            </section>

            {/* Active View Content */}
            {activeTab === 'OVERVIEW' && (
              <IntelligenceOverviewView
                pipelineRun={pipelineRun}
                onSelectClarifiedEntity={(q) => handleQuickEntitySelect(q, 'NONE')}
                onSwitchTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'LEDGER' && (
              <SourceLedgerView
                sources={pipelineRun.sourceLedger}
                crawlTree={pipelineRun.deepWebCrawlTree}
                documents={pipelineRun.discoveredDocuments}
                targetedQueries={pipelineRun.targetedSearchQueries}
                httpTelemetry={pipelineRun.httpTelemetry || []}
              />
            )}

            {activeTab === 'PROVENANCE' && (
              <ProvenanceAndCrossVerifyView
                facts={pipelineRun.provenancedFacts}
                missingMetrics={pipelineRun.missingMetrics || []}
                crossVerifications={pipelineRun.crossVerifications}
                fallbacks={pipelineRun.fallbackRecords}
              />
            )}

            {activeTab === 'MATRIX' && (
              <div className="space-y-4">
                {isLoadingMatrix && (
                  <div className="p-5 border border-sky-500/40 bg-sky-950/20 rounded-lg flex items-center gap-3 text-sm text-slate-200">
                    <Loader2 className="w-5 h-5 text-sky-400 animate-spin shrink-0" />
                    <span>Running Live HTTPS Regression Matrix across {REGRESSION_MATRIX_ENTITIES.length} companies...</span>
                  </div>
                )}
                <RegressionMatrixAndReportView
                  regressionResults={regressionResults}
                  onSelectQueryAndRun={(q, mode) => handleQuickEntitySelect(q, mode || 'NONE')}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 py-5 px-6 text-xs text-slate-500 max-w-[1380px] w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          Aegis Open-World Financial Intelligence · Live HTTPS Retrieval, Binary PDF Parsing & Provenance Engine
        </div>
        <div className="font-mono">
          Zero Static Entity Lists · Zero Synthetic Multipliers · Explicit Missing-Data Guard
        </div>
      </footer>
    </div>
  );
}
