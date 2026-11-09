import React, { useState } from 'react';
import {
  CrossVerificationAudit,
  FallbackRecord,
  MissingMetricRecord,
  ProvenancedFact
} from '../engine/types';
import { AlertTriangle, CheckCircle2, GitCompare, Layers, Scale } from 'lucide-react';

interface ProvenanceAndCrossVerifyViewProps {
  facts: ProvenancedFact[];
  missingMetrics?: MissingMetricRecord[];
  crossVerifications: CrossVerificationAudit[];
  fallbacks: FallbackRecord[];
}

export const ProvenanceAndCrossVerifyView: React.FC<ProvenanceAndCrossVerifyViewProps> = ({
  facts,
  missingMetrics = [],
  crossVerifications,
  fallbacks
}) => {
  const [factClassFilter, setFactClassFilter] = useState<'ALL' | 'PRIMARY_FACT' | 'SECONDARY_REPORTING'>('ALL');
  const [selectedFactId, setSelectedFactId] = useState<string | null>(facts[0]?.fact_id || null);

  const visibleFacts = facts.filter((f) => {
    if (factClassFilter === 'ALL') return true;
    return f.fact_class === factClassFilter;
  });

  const activeFact =
    facts.find((f) => f.fact_id === selectedFactId) ||
    visibleFacts[0] ||
    facts[0];

  return (
    <div className="space-y-8">
      {/* Section 1: Cross-Verification & Discrepancy Investigation */}
      <section className="border border-slate-800 bg-slate-900/60 rounded-lg p-6">
        <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-sky-400 shrink-0" />
              <span>Multi-Source Cross-Verification & Discrepancy Reconciliation</span>
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Compares only actual live-extracted Consolidated vs. Standalone and Primary vs. Secondary figures — zero synthetic multipliers.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Audited Metrics: {crossVerifications.length}
          </div>
        </div>

        {crossVerifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            No multi-source commercial accounting statements to cross-verify for this entity type.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 mt-5">
            {crossVerifications.map((audit) => (
              <div
                key={audit.metric_key}
                className="p-5 bg-slate-950 border border-slate-800 rounded-lg space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
                  <div>
                    <div className="text-xs font-mono text-sky-400">
                      CROSS-VERIFICATION AUDIT · {audit.period} · {audit.currency} ({audit.unit})
                    </div>
                    <h3 className="text-base font-semibold text-slate-100 mt-0.5">
                      {audit.metric_label}
                    </h3>
                  </div>

                  <div className="text-right font-mono tabular-nums">
                    <div className="text-xs text-slate-400">Reconciled Canonical Value</div>
                    <div className="text-lg font-bold text-emerald-400">
                      {audit.final_formatted}
                    </div>
                  </div>
                </div>

                {/* Candidate Values Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-medium">
                        <th className="py-2 pr-4">Candidate Source</th>
                        <th className="py-2 px-3">Source Type & Tier</th>
                        <th className="py-2 px-3">Consolidation Basis</th>
                        <th className="py-2 px-3">Metric Basis & Standard</th>
                        <th className="py-2 pl-3 text-right">Reported Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                      {audit.candidate_values.map((cand, i) => (
                        <tr key={i} className="hover:bg-slate-900/50">
                          <td className="py-2.5 pr-4 font-sans text-slate-200 max-w-xs truncate" title={cand.source_title}>
                            {cand.source_title}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {cand.source_type} ({cand.tier.replace(/_/g, ' ')})
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={
                                cand.consolidation_basis === 'CONSOLIDATED'
                                  ? 'text-emerald-400'
                                  : 'text-amber-400'
                              }
                            >
                              {cand.consolidation_basis}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {cand.metric_basis} · {cand.accounting_standard}
                          </td>
                          <td className="py-2.5 pl-3 text-right font-semibold text-slate-100">
                            {cand.formatted_value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Discrepancy Root-Cause & Resolution Box */}
                <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded text-xs space-y-1.5">
                  <div className="font-semibold text-slate-200 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>
                      Discrepancy Investigation Status: {audit.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <ul className="text-slate-300 space-y-1 pl-6 list-disc">
                    {audit.discrepancy_investigation.root_causes.map((rc, idx) => (
                      <li key={idx}>{rc}</li>
                    ))}
                  </ul>
                  <p className="text-emerald-400 pt-1 font-medium">
                    Resolution: {audit.discrepancy_investigation.reconciliation_explanation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Financial Data Provenance Ledger (12-Field Lineage) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 border border-slate-800 bg-slate-900/60 rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                Provenanced Facts Ledger (Zero Unprovenanced Numbers)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every metric retains its exact Entity, Currency, Unit, Period, Source, Document, Page/Section, and Verbatim Quote.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
              {(
                [
                  { id: 'ALL', label: `All Facts (${facts.length})` },
                  {
                    id: 'PRIMARY_FACT',
                    label: `Primary Facts (${facts.filter((f) => f.fact_class === 'PRIMARY_FACT').length})`
                  },
                  {
                    id: 'SECONDARY_REPORTING',
                    label: `Secondary Reporting (${facts.filter((f) => f.fact_class === 'SECONDARY_REPORTING').length})`
                  }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFactClassFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    factClassFilter === tab.id
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-3 pr-3">Metric</th>
                  <th className="py-3 px-3 text-right">Verified Value</th>
                  <th className="py-3 px-3">Period & Basis</th>
                  <th className="py-3 px-3">Fact Class</th>
                  <th className="py-3 px-3">Source Document & Page</th>
                  <th className="py-3 pl-3 text-right">Lineage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {visibleFacts.map((fact) => {
                  const isSelected = activeFact?.fact_id === fact.fact_id;
                  return (
                    <tr
                      key={fact.fact_id}
                      className={`transition-colors ${
                        isSelected ? 'bg-sky-950/30' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3 pr-3 font-medium text-slate-100">
                        <div>{fact.metric}</div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {fact.entity}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-emerald-400 whitespace-nowrap">
                        {fact.formatted_value}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">
                        <div>{fact.period}</div>
                        <div className="text-[11px] text-slate-500">{fact.consolidation_basis}</div>
                      </td>
                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        <span
                          className={
                            fact.fact_class === 'PRIMARY_FACT'
                              ? 'text-emerald-400 font-medium'
                              : 'text-amber-400 font-medium'
                          }
                        >
                          {fact.fact_class}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs">
                        <div className="truncate" title={fact.document}>
                          {fact.document}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                          {fact.page_or_section}
                        </div>
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedFactId(fact.fact_id)}
                          className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
                            isSelected
                              ? 'bg-sky-600 border-sky-500 text-white'
                              : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          Inspect Card
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 12-Field Provenance Certificate Card */}
        <div className="lg:col-span-4 border border-slate-800 bg-slate-900/60 rounded-lg p-6">
          <div className="pb-4 border-b border-slate-800">
            <div className="text-xs font-mono text-sky-400">
              BACKWARD LINEAGE CERTIFICATE
            </div>
            <h3 className="text-base font-semibold text-slate-100 mt-1">
              {activeFact ? activeFact.metric : 'Select a Fact'}
            </h3>
          </div>

          {activeFact ? (
            <dl className="mt-4 space-y-2.5 text-xs">
              {[
                { k: 'Entity (Legal Name)', v: activeFact.entity },
                { k: 'Metric', v: activeFact.metric },
                { k: 'Value', v: activeFact.formatted_value, mono: true },
                { k: 'Currency & Unit', v: `${activeFact.currency} · ${activeFact.unit}`, mono: true },
                { k: 'Period / Fiscal Year', v: `${activeFact.period} (${activeFact.consolidation_basis})`, mono: true },
                { k: 'Accounting Standard', v: activeFact.accounting_standard },
                { k: 'Evidence Class', v: activeFact.fact_class, mono: true },
                { k: 'Source Classification', v: `${activeFact.source_type} (${activeFact.source_tier})`, mono: true },
                { k: 'Source URL', v: activeFact.url, mono: true },
                { k: 'Document Title', v: activeFact.document },
                { k: 'Page / Section Reference', v: activeFact.page_or_section, mono: true },
                { k: 'Verbatim Extracted Quote', v: activeFact.exact_quote || 'Verified table cell', mono: true },
                { k: 'Extraction Method', v: activeFact.extraction_method },
                { k: 'Verification Status', v: activeFact.verification_status, mono: true }
              ].map((row) => (
                <div key={row.k} className="pb-2 border-b border-slate-800/60">
                  <dt className="text-slate-400">{row.k}</dt>
                  <dd className={`text-slate-100 mt-0.5 break-all ${row.mono ? 'font-mono tabular-nums text-sky-300' : 'font-medium'}`}>
                    {row.v}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-slate-400 mt-4">No provenanced facts extracted.</p>
          )}
        </div>
      </section>

      {/* Section 2B: Missing Data Policy Log (Requirement #12: Never Invent Missing Data) */}
      {missingMetrics.length > 0 && (
        <section className="border border-rose-500/40 bg-rose-950/15 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Missing Data Guard (`DATA_UNAVAILABLE` — Zero Fabrication Policy)
              </h3>
              <p className="text-xs text-slate-300">
                The following metrics were not attested in any retrieved statutory or primary source. Aegis strictly refuses to invent, extrapolate, or substitute missing figures.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {missingMetrics.map((m) => (
              <div key={m.metricKey} className="p-4 bg-slate-950 border border-rose-500/30 rounded-md text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-100">{m.metricLabel}</span>
                  <span className="font-mono font-bold text-rose-400">{m.status}</span>
                </div>
                <p className="text-slate-300">{m.reason}</p>
                <div className="text-[11px] font-mono text-slate-500 truncate">
                  Attempted Sources: {m.attemptedSources.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Explicit Source Tier Fallback Strategy Log */}
      <section className="border border-slate-800 bg-slate-900/60 rounded-lg p-6">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-sky-400 shrink-0" />
          <h3 className="text-base font-semibold text-slate-100">
            Explicit Source Tier Fallback Log (Tier 1 → Tier 2 → Tier 3 → Tier 4)
          </h3>
        </div>
        {fallbacks.length === 0 ? (
          <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>100% of metrics satisfied directly from Primary/Institutional Filings. Zero secondary fallbacks required.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {fallbacks.map((fb, idx) => (
              <div key={idx} className="p-4 bg-slate-950 border border-slate-800 rounded-md text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-100">{fb.metric}</span>
                  <span className="font-mono text-amber-400">
                    Confidence: {fb.confidenceScore}%
                  </span>
                </div>
                <p className="text-slate-300">{fb.reason}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
