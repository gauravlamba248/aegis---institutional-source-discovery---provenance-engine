import React, { useState } from 'react';
import {
  DeepWebCrawlNode,
  DiscoveredDocument,
  DiscoveredSource,
  HttpRetrievalTelemetry
} from '../engine/types';
import { FileText, Search, ShieldAlert, CheckCircle2, XCircle, Lock } from 'lucide-react';

interface SourceLedgerViewProps {
  sources: DiscoveredSource[];
  crawlTree: DeepWebCrawlNode[];
  documents: DiscoveredDocument[];
  targetedQueries: {
    category: 'COMPANY_SPECIFIC' | 'JURISDICTION_REGULATORY' | 'DEEP_DOCUMENT_PDF' | 'SPECIALIST_AND_SECONDARY';
    query: string;
    purpose: string;
  }[];
  httpTelemetry?: HttpRetrievalTelemetry[];
}

export const SourceLedgerView: React.FC<SourceLedgerViewProps> = ({
  sources,
  crawlTree,
  documents,
  targetedQueries,
  httpTelemetry = []
}) => {
  const [tierFilter, setTierFilter] = useState<'ALL' | 'SELECTED' | 'PRIMARY' | 'SECONDARY' | 'REJECTED'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [inspectedSourceId, setInspectedSourceId] = useState<string | null>(
    sources[0]?.source_id || null
  );

  const filteredSources = sources.filter((s) => {
    if (tierFilter === 'SELECTED' && !s.selected) return false;
    if (tierFilter === 'PRIMARY' && s.tier !== 'TIER_1_OFFICIAL' && s.tier !== 'TIER_2_REGULATOR_EXCHANGE') return false;
    if (tierFilter === 'SECONDARY' && s.tier !== 'TIER_3_SPECIALIST_FINANCIAL' && s.tier !== 'TIER_4_REPUTABLE_SECONDARY') return false;
    if (tierFilter === 'REJECTED' && s.selected) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.domain.toLowerCase().includes(q) ||
        s.source_type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeSource =
    sources.find((s) => s.source_id === inspectedSourceId) ||
    filteredSources[0] ||
    sources[0];

  return (
    <div className="space-y-8">
      {/* Section 1: Source Ledger Controls & Table */}
      <section className="border border-slate-800 bg-slate-900/60 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Auditable Live Source Ledger & Authority Ranking
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Sources are discovered dynamically and ranked by mathematical quality score and entity verification — never by raw search engine order.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                aria-label="Filter sources by domain or type"
                placeholder="Search domain or classification..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md" role="group" aria-label="Filter source ledger by tier">
              {(
                [
                  { id: 'ALL', label: `All (${sources.length})` },
                  { id: 'SELECTED', label: `Selected (${sources.filter((s) => s.selected).length})` },
                  { id: 'PRIMARY', label: 'Tier 1–2 Primary' },
                  { id: 'SECONDARY', label: 'Tier 3–4 Specialist' },
                  { id: 'REJECTED', label: `Rejected (${sources.filter((s) => !s.selected).length})` }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTierFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    tierFilter === tab.id
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* High-Density Source Table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                <th className="py-3 pr-4">Source & Domain</th>
                <th className="py-3 px-3">Classification & Tier</th>
                <th className="py-3 px-3">Authority</th>
                <th className="py-3 px-3 text-right">Search Rank</th>
                <th className="py-3 px-3 text-right">Entity Match</th>
                <th className="py-3 px-3 text-right">Quality Score</th>
                <th className="py-3 px-3">Decision</th>
                <th className="py-3 pl-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {filteredSources.map((src) => {
                const isInspected = activeSource?.source_id === src.source_id;
                return (
                  <tr
                    key={src.source_id}
                    className={`transition-colors ${
                      isInspected ? 'bg-sky-950/30' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3.5 pr-4 max-w-xs">
                      <div className="font-medium text-slate-100 truncate" title={src.title}>
                        {src.title}
                      </div>
                      <div className="text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                        <span>{src.domain}</span>
                        <span aria-hidden="true">·</span>
                        <span>{src.publication_date}</span>
                        {src.linked_documents.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-sky-400">
                              {src.linked_documents.length} PDF/Filing
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                      <div>{src.source_type}</div>
                      <div className="text-slate-500 text-[11px]">{src.tier.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="py-3.5 px-3 font-mono whitespace-nowrap">
                      <span
                        className={
                          src.authority_level === 'VERY_HIGH'
                            ? 'text-emerald-400 font-medium'
                            : src.authority_level === 'HIGH' || src.authority_level === 'MEDIUM_HIGH'
                            ? 'text-sky-400'
                            : src.authority_level === 'LOW'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }
                      >
                        {src.authority_level}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-400">
                      #{src.search_rank_order}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                      <span
                        className={
                          src.entity_match_evaluation.isSiblingOrParentContamination
                            ? 'text-rose-400 font-semibold'
                            : src.entity_match >= 80
                            ? 'text-emerald-400 font-semibold'
                            : 'text-amber-400'
                        }
                      >
                        {src.entity_match}%
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold">
                      <span
                        className={
                          src.quality_score >= 80
                            ? 'text-emerald-400'
                            : src.quality_score >= 55
                            ? 'text-sky-400'
                            : 'text-rose-400'
                        }
                      >
                        {src.quality_score}/100
                      </span>
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {src.selected ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Selected ({src.raw_extracted_kb} KB)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-rose-400 font-medium">
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Rejected</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pl-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setInspectedSourceId(src.source_id)}
                        className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
                          isInspected
                            ? 'bg-sky-600 border-sky-500 text-white'
                            : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        Why This Source?
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2: "Why This Source?" & Mathematical Quality Breakdown Inspector */}
      {activeSource && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 border border-slate-800 bg-slate-900/60 rounded-lg p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="text-xs font-mono text-slate-400">
                    SOURCE AUDIT TRAIL · {activeSource.source_id} · SEARCH RANK #{activeSource.search_rank_order}
                  </div>
                  <h3 className="text-base font-semibold text-slate-100 mt-1">
                    {activeSource.title}
                  </h3>
                </div>
                <span
                  className={`text-xs font-mono font-semibold whitespace-nowrap shrink-0 ${
                    activeSource.selected ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {activeSource.selected ? 'SELECTED FOR ANALYSIS' : 'REJECTED BY GUARD'}
                </span>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-xs font-medium text-slate-300">
                    {activeSource.selected ? 'Why Was This Source Selected?' : 'Why Was This Source Rejected?'}
                  </div>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                    {(activeSource.selected ? activeSource.selection_reason : activeSource.rejection_reason).map(
                      (reason, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="font-mono text-sky-400 shrink-0">{idx + 1}.</span>
                          <span>{reason}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <div className="text-xs font-medium text-slate-300">
                    Entity Identity Match Verification ({activeSource.entity_match}%)
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {activeSource.entity_match_evaluation.explanation}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
                    <span>Matched Signals:</span>
                    <span>
                      {activeSource.entity_match_evaluation.matchedSignals.join(' · ') || 'None'}
                    </span>
                  </div>
                  {activeSource.entity_match_evaluation.conflictingSignals.length > 0 && (
                    <div className="mt-2 text-xs text-rose-400 font-mono flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>{activeSource.entity_match_evaluation.conflictingSignals.join(' · ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 font-mono">
              <span className="break-all">URL: {activeSource.url}</span>
              <span>Retrieved: {activeSource.retrieval_date}</span>
            </div>
          </div>

          {/* Mathematical Quality Score Formula Breakdown */}
          <div className="lg:col-span-5 border border-slate-800 bg-slate-900/60 rounded-lg p-6">
            <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  SourceQuality Mathematical Model
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Additive authority & provenance scoring vs penalties
                </p>
              </div>
              <div className="text-right font-mono tabular-nums">
                <div className="text-xl font-bold text-sky-400">
                  {activeSource.quality_score}/100
                </div>
                <div className="text-[11px] text-slate-400">Composite Score</div>
              </div>
            </div>

            <dl className="mt-4 space-y-2 text-xs font-mono tabular-nums">
              {[
                { label: '+ Authority Score (max 25)', val: `+${activeSource.quality_breakdown.authority}` },
                { label: '+ Entity Match Score (max 20)', val: `+${activeSource.quality_breakdown.entityMatch}` },
                { label: '+ Intent Relevance (max 15)', val: `+${activeSource.quality_breakdown.relevance}` },
                { label: '+ Information Depth & PDFs (max 12)', val: `+${activeSource.quality_breakdown.dataDepth}` },
                { label: '+ Freshness (max 8)', val: `+${activeSource.quality_breakdown.freshness}` },
                { label: '+ Primary Source Bonus (max 8)', val: `+${activeSource.quality_breakdown.primarySourceBonus}` },
                { label: '+ Jurisdiction Match (max 6)', val: `+${activeSource.quality_breakdown.jurisdictionMatch}` },
                { label: '+ Cross-Verification Bonus (max 6)', val: `+${activeSource.quality_breakdown.crossVerification}` },
                {
                  label: '- Domain Duplication Penalty',
                  val: `-${activeSource.quality_breakdown.duplicationPenalty}`,
                  isPenalty: activeSource.quality_breakdown.duplicationPenalty > 0
                },
                {
                  label: '- SEO / Content Farm Penalty',
                  val: `-${activeSource.quality_breakdown.seoContentFarmPenalty}`,
                  isPenalty: activeSource.quality_breakdown.seoContentFarmPenalty > 0
                },
                {
                  label: '- Low Financial Credibility Penalty',
                  val: `-${activeSource.quality_breakdown.lowCredibilityPenalty}`,
                  isPenalty: activeSource.quality_breakdown.lowCredibilityPenalty > 0
                }
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-1 border-b border-slate-800/50">
                  <dt className="text-slate-300">{row.label}</dt>
                  <dd className={row.isPenalty ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                    {row.val}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* Section 2B: Live HTTPS Retrieval & SSRF Security Telemetry Log (Requirement #8 & #24) */}
      {httpTelemetry.length > 0 && (
        <section className="border border-slate-800 bg-slate-900/60 rounded-lg p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Live HTTPS Retrieval & Security Telemetry ({httpTelemetry.length} Outbound Requests)
                </h3>
                <p className="text-xs text-slate-400">
                  Every outbound request is validated against DNS/IP SSRF guards, content-type filters, size caps, and SHA-256 payload hashing.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-sans font-medium">
                  <th className="py-2.5 pr-3">Target URL</th>
                  <th className="py-2.5 px-3">HTTP Status</th>
                  <th className="py-2.5 px-3">Content-Type</th>
                  <th className="py-2.5 px-3 text-right">Payload Size</th>
                  <th className="py-2.5 px-3 text-right">Latency</th>
                  <th className="py-2.5 px-3">SHA-256 Prefix</th>
                  <th className="py-2.5 pl-3">Parser & Security</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {httpTelemetry.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-2.5 pr-3 max-w-xs truncate text-slate-200" title={t.finalUrl}>
                      {t.finalUrl}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={
                          t.httpStatus === 200
                            ? 'text-emerald-400 font-semibold'
                            : 'text-amber-400'
                        }
                      >
                        HTTP {t.httpStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{t.contentType}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-sky-300">
                      {(t.bytesReceived / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-400">
                      {t.latencyMs} ms
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{t.sha256Hash}</td>
                    <td className="py-2.5 pl-3 text-emerald-400">
                      {t.parserUsed} · SSRF✓
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section 3: Deep Website Link Traversal & PDF Document Discovery */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 border border-slate-800 bg-slate-900/60 rounded-lg p-6">
          <h3 className="text-base font-semibold text-slate-100">
            Deep Official Website Traversal (Homepage → IR → Filings → PDF)
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Aegis traverses internal investor relations and statutory filing links over live HTTPS.
          </p>

          <div className="mt-4 space-y-2.5">
            {crawlTree.map((node, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 py-2 px-3 bg-slate-950 border border-slate-800/80 rounded text-xs"
                style={{ marginLeft: `${node.depth * 14}px` }}
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-200 truncate">
                    <span className="font-mono text-sky-400 mr-2">L{node.depth}</span>
                    {node.label}
                  </div>
                  <div className="text-slate-500 font-mono text-[11px] truncate mt-0.5">
                    {node.url}
                  </div>
                </div>
                <div className="font-mono tabular-nums text-emerald-400 shrink-0">
                  {node.extractedItemsCount} items
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 border border-slate-800 bg-slate-900/60 rounded-lg p-6">
          <h3 className="text-base font-semibold text-slate-100">
            Discovered PDF Filings & Structured Document Extraction
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Extracted financial tables, notes, segments, risk factors, and accounting definitions from live reports.
          </p>

          <div className="mt-4 space-y-4">
            {documents.map((doc) => (
              <div key={doc.documentId} className="p-4 bg-slate-950 border border-slate-800 rounded-md space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <FileText className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-slate-100">{doc.title}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {doc.documentType} · {doc.fiscalPeriod} · {doc.fileSizeKb} KB · {doc.extractedSections.tablesCount} Tables Parsed
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-300 space-y-1 pt-2 border-t border-slate-800/80">
                  <div>
                    <span className="text-slate-400 font-medium">Statements Extracted: </span>
                    <span>{doc.extractedSections.statements.join(' · ')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Units & Basis: </span>
                    <span className="font-mono text-sky-300">{doc.extractedSections.unitsAndDefinitions}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Company-Specific & Jurisdiction-Aware Search Strategy */}
      <section className="border border-slate-800 bg-slate-900/60 rounded-lg p-6">
        <h3 className="text-base font-semibold text-slate-100">
          Targeted Multi-Vector Search Strategy
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {targetedQueries.map((q, idx) => (
            <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded text-xs">
              <div className="text-[11px] font-mono text-sky-400">{q.category.replace(/_/g, ' ')}</div>
              <div className="font-mono text-slate-100 mt-1">{q.query}</div>
              <div className="text-slate-400 mt-1">{q.purpose}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
