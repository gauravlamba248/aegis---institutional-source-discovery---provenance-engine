import React from 'react';
import { AegisPipelineRun } from '../engine/types';
import {
  AlertOctagon,
  Building2,
  FileCheck2,
  Gauge,
  Globe2,
  ShieldAlert,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';

interface IntelligenceOverviewViewProps {
  pipelineRun: AegisPipelineRun;
  onSelectClarifiedEntity: (legalName: string) => void;
  onSwitchTab: (tab: 'OVERVIEW' | 'LEDGER' | 'PROVENANCE' | 'MATRIX') => void;
}

export const IntelligenceOverviewView: React.FC<IntelligenceOverviewViewProps> = ({
  pipelineRun,
  onSelectClarifiedEntity,
  onSwitchTab
}) => {
  const {
    entityResolution,
    jurisdictionProfile,
    selectedSources,
    financialAnalysis,
    ledgerStats,
    provenancedFacts,
    missingMetrics = [],
    analysisConfidence
  } = pipelineRun;

  const entity = entityResolution.resolvedEntity;
  const diag = ledgerStats.zeroSourceDiagnostic;

  return (
    <div className="space-y-8">
      {/* If Diagnostic Halt / Zero-Source Result */}
      {diag.code !== 'NONE' && (
        <section className="border border-amber-500/40 bg-amber-950/20 rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertOctagon className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-mono text-amber-400">
                  ZERO-SOURCE DIAGNOSTIC MODE · {diag.code}
                </div>
                <h2 className="text-lg font-semibold text-slate-100 mt-0.5">
                  {diag.headline}
                </h2>
                <p className="text-sm text-slate-300 mt-1">
                  {diag.detailedExplanation}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-amber-300 whitespace-nowrap shrink-0">
              Websites Selected: {ledgerStats.selectedSourcesCount} · Extracted: {ledgerStats.rawExtractedKb.toFixed(1)} KB
            </span>
          </div>

          {entityResolution.liveProbesAttempted && entityResolution.liveProbesAttempted.length > 0 && (
            <div className="pt-3 border-t border-amber-500/20 text-xs font-mono text-slate-300 space-y-1">
              <div className="text-amber-300 font-semibold">Live Discovery Probes Executed:</div>
              <ul className="list-disc pl-5 space-y-0.5 text-slate-400">
                {entityResolution.liveProbesAttempted.map((probe, idx) => (
                  <li key={idx}>{probe}</li>
                ))}
              </ul>
            </div>
          )}

          {/* If Ambiguous Entity, allow one-click disambiguation */}
          {entityResolution.status === 'AMBIGUOUS — CLARIFICATION REQUIRED' &&
            entityResolution.candidatesConsidered.length > 0 && (
              <div className="pt-4 border-t border-amber-500/30">
                <div className="text-xs font-semibold text-slate-200 mb-2.5">
                  Candidate Legal Entities Identified Live — Select Exact Intended Entity:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {entityResolution.candidatesConsidered.map((cand) => (
                    <button
                      key={cand.entityId}
                      type="button"
                      onClick={() => onSelectClarifiedEntity(`Financial analysis of ${cand.canonicalName}`)}
                      className="p-3 text-left bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-sky-500 rounded-md transition-colors"
                    >
                      <div className="text-xs font-semibold text-sky-400">{cand.canonicalName}</div>
                      <div className="text-xs text-slate-200 font-medium mt-0.5">{cand.legalName}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-1">
                        {cand.cinOrRegId || cand.cik || cand.isin || cand.tickers[0] || cand.country}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

          {diag.remediationSteps.length > 0 && (
            <div className="pt-3 border-t border-amber-500/20 text-xs text-slate-300">
              <span className="font-semibold text-amber-300">Diagnostic Remediation: </span>
              <span>{diag.remediationSteps.join(' · ')}</span>
            </div>
          )}
        </section>
      )}

      {/* Section 1: Entity Resolution & Absolute Non-Substitution Guard */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 border border-slate-800 bg-slate-900/60 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-sky-400 shrink-0" />
                <div>
                  <div className="text-xs font-mono text-slate-400">
                    STAGE 1–2 · OPEN-WORLD ENTITY RESOLUTION & JURISDICTION ROUTING
                  </div>
                  <h2 className="text-lg font-semibold text-slate-100">
                    {entity ? entity.legalName : entityResolution.extractedTarget}
                  </h2>
                </div>
              </div>

              <span
                className={`text-xs font-mono font-semibold whitespace-nowrap shrink-0 ${
                  entityResolution.status === 'VERIFIED'
                    ? 'text-emerald-400'
                    : entityResolution.status.includes('AMBIGUOUS')
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {entityResolution.status}
              </span>
            </div>

            {entity && jurisdictionProfile ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="text-slate-400">Entity Classification</div>
                    <div className="font-mono text-slate-100 mt-0.5">{entity.entityType.replace(/_/g, ' ')}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Registry / CIN / CIK</div>
                    <div className="font-mono text-sky-300 mt-0.5">{entity.cinOrRegId || entity.cik || entity.wikidataId || 'Live Verified'}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">ISIN / Tickers</div>
                    <div className="font-mono text-slate-200 mt-0.5">{entity.isin || entity.tickers.join(', ') || 'Unlisted / Private'}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Sovereign Jurisdiction</div>
                    <div className="font-medium text-slate-100 mt-0.5 flex items-center gap-1.5">
                      <Globe2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>{jurisdictionProfile.countryName} ({jurisdictionProfile.defaultCurrency})</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Primary Regulators</div>
                    <div className="text-slate-200 mt-0.5">{jurisdictionProfile.primaryRegulators.slice(0, 2).join(', ')}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Official Domain</div>
                    <div className="font-mono text-emerald-400 mt-0.5">{entity.officialDomain}</div>
                  </div>
                </div>

                {entity.discoveryChannelsUsed && entity.discoveryChannelsUsed.length > 0 && (
                  <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-300">
                    <span className="text-slate-400 font-medium">Live Discovery Channels Verified: </span>
                    <span className="font-mono text-sky-300">{entity.discoveryChannelsUsed.join(' · ')}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-300">
                  <span className="text-slate-400 font-medium">Sector & Mandate: </span>
                  <span>{entity.sector}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-4">
                No verified legal entity bound. Pipeline halted prior to financial model execution to prevent hallucination or entity substitution.
              </p>
            )}
          </div>

          {entity && (
            <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-mono">
              <span>Identity Confidence: {entity.confidenceScore}%</span>
              <span>Accounting Standard: {jurisdictionProfile?.accountingStandards[0]}</span>
            </div>
          )}
        </div>

        {/* Absolute Non-Substitution Guard Panel */}
        <div className="lg:col-span-5 border border-slate-800 bg-slate-900/60 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-base font-semibold text-slate-100">
                    Absolute Non-Substitution Guard
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sibling, parent & namesake entities explicitly isolated
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {entityResolution.rejectedSubstitutions.length === 0 ? (
                <div className="p-3 bg-slate-950 border border-slate-800/90 rounded text-xs text-slate-400">
                  Zero conflicting sibling or namesake entities detected during live registry resolution.
                </div>
              ) : (
                entityResolution.rejectedSubstitutions.map((sub, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950 border border-slate-800/90 rounded text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-200">{sub.legalName}</span>
                      <span className="font-mono text-[11px] text-rose-400 shrink-0">
                        BLOCKED FROM SUBSTITUTION
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">{sub.reason}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Lineage Lock: Entity → Source → Fact → Analysis</span>
            <button
              type="button"
              onClick={() => onSwitchTab('LEDGER')}
              className="text-sky-400 hover:text-sky-300 font-medium underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Inspect Source Ledger →
            </button>
          </div>
        </div>
      </section>

      {/* Section 1B: 5-Dimensional Analysis Confidence Breakdown (Requirement #19) */}
      {analysisConfidence && entity && (
        <section className="border border-slate-800 bg-slate-900/60 rounded-lg p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-sky-400 shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  5-Dimensional Evidence & Calculation Confidence Audit
                </h2>
                <p className="text-xs text-slate-400">
                  Confidence is governed by actual evidence completeness and primary source authority — never assumed from formula completion.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              Grade: {analysisConfidence.confidenceGrade} ({analysisConfidence.overallConfidence}%)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
            {[
              { label: 'Entity Confidence', val: analysisConfidence.entityConfidence },
              { label: 'Source Confidence', val: analysisConfidence.sourceConfidence },
              { label: 'Data Completeness', val: analysisConfidence.dataConfidence },
              { label: 'Calculation Confidence', val: analysisConfidence.calculationConfidence },
              { label: 'Overall Confidence', val: analysisConfidence.overallConfidence }
            ].map((item) => (
              <div key={item.label} className="p-3 bg-slate-950 border border-slate-800 rounded">
                <div className="text-slate-400 text-[11px]">{item.label}</div>
                <div
                  className={`text-base font-bold mt-1 ${
                    item.val >= 80
                      ? 'text-emerald-400'
                      : item.val >= 50
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {item.val}%
                </div>
              </div>
            ))}
          </div>

          {analysisConfidence.limitingFactors.length > 0 && (
            <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded text-xs text-amber-200 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Confidence Limiting Factors: </span>
                <span>{analysisConfidence.limitingFactors.join(' · ')}</span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Section 2: Diversified Selected Sources Summary */}
      {selectedSources.length > 0 && (
        <section className="border border-slate-800 bg-slate-900/60 rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                Selected Authoritative Sources ({selectedSources.length} of {pipelineRun.sourceLedger.length} Candidates)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Diversified across Tier 1 Official Filings, Tier 2 Sovereign Regulators/Exchanges, Tier 3 Specialist Databases, and Tier 4 Reputable Coverage.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('LEDGER')}
              className="px-3 py-1.5 text-xs font-medium bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              View All {pipelineRun.sourceLedger.length} Candidates & HTTP Telemetry
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {selectedSources.map((src, i) => (
              <div
                key={src.source_id}
                className="p-4 bg-slate-950 border border-slate-800 rounded-md flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="text-sky-400 font-semibold">
                      SLOT #{i + 1} · {src.source_type}
                    </span>
                    <span className="text-emerald-400 tabular-nums font-bold">
                      {src.quality_score}/100
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-100 mt-1.5 line-clamp-2" title={src.title}>
                    {src.title}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    {src.domain} · Search Rank #{src.search_rank_order} · Match {src.entity_match}%
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-300 space-y-1">
                  <div className="text-slate-400 font-medium">Why Selected:</div>
                  <div>{src.selection_reason[0]}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Provenanced Financial Metrics Summary Strip */}
      {(provenancedFacts.length > 0 || missingMetrics.length > 0) && (
        <section className="border border-slate-800 bg-slate-900/60 rounded-lg p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  Live Extracted Financial Dataset ({provenancedFacts.length} Verified Facts · {missingMetrics.length} Missing/Unavailable)
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every value below was extracted from live retrieved HTML/PDF/XBRL documents. Missing metrics are explicitly marked DATA UNAVAILABLE — never invented.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('PROVENANCE')}
              className="px-3 py-1.5 text-xs font-medium bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              Inspect Full Provenance & Missing Data Log →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {provenancedFacts.slice(0, 8).map((fact) => (
              <div
                key={fact.fact_id}
                className="p-4 bg-slate-950 border border-slate-800 rounded-md flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span
                      className={
                        fact.fact_class === 'PRIMARY_FACT'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }
                    >
                      {fact.fact_class}
                    </span>
                    <span className="text-slate-400">{fact.fiscal_year}</span>
                  </div>
                  <div className="text-xs text-slate-300 font-medium mt-1">
                    {fact.metric}
                  </div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-100 mt-1">
                    {fact.formatted_value}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 truncate" title={`${fact.document} — ${fact.page_or_section}`}>
                  {fact.source_type} · {fact.page_or_section}
                </div>
              </div>
            ))}

            {missingMetrics.slice(0, 4).map((mm) => (
              <div
                key={mm.metricKey}
                className="p-4 bg-rose-950/15 border border-rose-500/30 rounded-md flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-rose-400">
                    <span>MISSING DATA GUARD</span>
                    <span>NO FABRICATION</span>
                  </div>
                  <div className="text-xs text-slate-200 font-medium mt-1">
                    {mm.metricLabel}
                  </div>
                  <div className="text-sm font-bold font-mono text-rose-400 mt-1">
                    DATA UNAVAILABLE
                  </div>
                </div>
                <div className="pt-2 border-t border-rose-500/20 text-[11px] text-slate-400 line-clamp-2" title={mm.reason}>
                  {mm.reason}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 4: Institutional Mathematical Analysis & Primary vs Secondary Separation */}
      {entity && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Altman Z-Score & DuPont 3-Step ROE */}
          <div className="lg:col-span-6 border border-slate-800 bg-slate-900/60 rounded-lg p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-semibold text-slate-100">
                    Altman Z-Score Solvency Model
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {financialAnalysis.altmanZScore.formulaVariant}
                  </p>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="text-lg font-bold text-sky-400">
                    {financialAnalysis.altmanZScore.available
                      ? financialAnalysis.altmanZScore.score?.toFixed(2)
                      : 'DATA UNAVAILABLE'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {financialAnalysis.altmanZScore.zone.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>

              {financialAnalysis.altmanZScore.components.length > 0 && (
                <dl className="mt-3 space-y-1.5 text-xs font-mono tabular-nums">
                  {financialAnalysis.altmanZScore.components.map((c) => (
                    <div key={c.label} className="flex items-center justify-between py-1 border-b border-slate-800/50">
                      <dt className="text-slate-300">{c.label}</dt>
                      <dd className="text-slate-100 font-semibold">{c.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {financialAnalysis.altmanZScore.missingInputs.length > 0 && (
                <div className="mt-3 p-2.5 bg-slate-950 border border-slate-800 rounded text-xs font-mono text-amber-300">
                  {financialAnalysis.altmanZScore.missingInputs.join(' · ')}
                </div>
              )}
            </div>

            {/* DuPont 3-Step ROE Decomposition */}
            <div className="pt-2">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-semibold text-slate-100">
                    DuPont 3-Step ROE Decomposition
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ROE = Net Profit Margin × Asset Turnover × Equity Multiplier
                  </p>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="text-lg font-bold text-emerald-400">
                    {financialAnalysis.dupontAnalysis.available
                      ? `${financialAnalysis.dupontAnalysis.roePct?.toFixed(2)}%`
                      : 'DATA UNAVAILABLE'}
                  </div>
                  <div className="text-[11px] text-slate-400">Consolidated ROE</div>
                </div>
              </div>

              {financialAnalysis.dupontAnalysis.available && (
                <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded">
                    <div className="text-[11px] text-slate-400">Net Profit Margin</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-100 mt-1">
                      {financialAnalysis.dupontAnalysis.netProfitMarginPct?.toFixed(2)}%
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded">
                    <div className="text-[11px] text-slate-400">Asset Turnover</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-100 mt-1">
                      {financialAnalysis.dupontAnalysis.assetTurnover?.toFixed(3)}x
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded">
                    <div className="text-[11px] text-slate-400">Equity Multiplier</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-100 mt-1">
                      {financialAnalysis.dupontAnalysis.equityMultiplier?.toFixed(2)}x
                    </div>
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                {financialAnalysis.dupontAnalysis.interpretation}
              </p>
            </div>
          </div>

          {/* Piotroski 9-Factor F-Score & Primary Fact vs Secondary Reporting Separation */}
          <div className="lg:col-span-6 border border-slate-800 bg-slate-900/60 rounded-lg p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-semibold text-slate-100">
                    Piotroski 9-Factor F-Score
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Profitability, Leverage/Liquidity & Operating Efficiency Audit
                  </p>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="text-lg font-bold text-emerald-400">
                    {financialAnalysis.piotroskiFScore.available
                      ? `${financialAnalysis.piotroskiFScore.score} / ${financialAnalysis.piotroskiFScore.maxScore}`
                      : 'DATA UNAVAILABLE'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {financialAnalysis.piotroskiFScore.strengthLabel}
                  </div>
                </div>
              </div>

              {financialAnalysis.piotroskiFScore.criteria.length > 0 && (
                <div className="mt-3 space-y-1.5 max-h-52 overflow-y-auto pr-1 text-xs">
                  {financialAnalysis.piotroskiFScore.criteria.map((c) => (
                    <div
                      key={c.name}
                      className="flex items-center justify-between gap-2 py-1.5 px-2.5 bg-slate-950 border border-slate-800/70 rounded"
                    >
                      <span className="text-slate-200">{c.name}</span>
                      <span
                        className={`font-mono tabular-nums shrink-0 ${
                          c.passed ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {c.passed ? 'PASS' : 'WATCH'} · {c.detail}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Explicit Distinction: PRIMARY FACT vs SECONDARY REPORTING */}
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Strict Separation: Primary Facts vs Secondary Reporting</span>
              </div>

              {financialAnalysis.qualitativeSynthesis.primaryFactsSummary.length > 0 && (
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded text-xs space-y-1.5">
                  <div className="font-mono text-emerald-400 font-semibold">
                    PRIMARY FACT (Audited Statutory / Exchange Disclosures)
                  </div>
                  <ul className="space-y-1 text-slate-300 list-disc pl-4">
                    {financialAnalysis.qualitativeSynthesis.primaryFactsSummary.slice(0, 3).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              {financialAnalysis.qualitativeSynthesis.secondaryReportingInsights.map((sec, idx) => (
                <div key={idx} className="p-3.5 bg-slate-950 border border-slate-800 rounded text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2 font-mono text-amber-400 font-semibold">
                    <span>SECONDARY REPORTING · {sec.sourceType}</span>
                    <span>{sec.topic}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{sec.insight}</p>
                  <div className="text-[11px] font-mono text-slate-400 pt-1">
                    Source Attribution: {sec.sourceTitle}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
