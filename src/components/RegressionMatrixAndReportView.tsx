import React, { useState } from 'react';
import {
  RegressionTestResult,
  ZeroSourceDiagnosticCode
} from '../engine/types';
import { CheckCircle2, Play, ShieldCheck, AlertTriangle, FileSpreadsheet } from 'lucide-react';

interface RegressionMatrixAndReportViewProps {
  regressionResults: RegressionTestResult[];
  onSelectQueryAndRun: (query: string, diagnosticMode?: ZeroSourceDiagnosticCode) => void;
}

export const RegressionMatrixAndReportView: React.FC<RegressionMatrixAndReportViewProps> = ({
  regressionResults,
  onSelectQueryAndRun
}) => {
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>('ALL');

  const filteredMatrix = regressionResults.filter((r) => {
    if (jurisdictionFilter === 'ALL') return true;
    if (jurisdictionFilter === 'INDIA') return r.jurisdiction.includes('India');
    if (jurisdictionFilter === 'US') return r.jurisdiction.includes('United States');
    if (jurisdictionFilter === 'GLOBAL') return !r.jurisdiction.includes('India') && !r.jurisdiction.includes('United States');
    return true;
  });

  const passedCount = regressionResults.filter((r) => r.passedAllInvariants).length;

  return (
    <div className="space-y-8">
      {/* Section 1: Open-World Multi-Jurisdiction Regression Matrix */}
      <section className="border border-slate-800 bg-slate-900/60 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-sky-400 shrink-0" />
              <span>Open-World Multi-Jurisdiction Live Regression Matrix ({regressionResults.length} Entities)</span>
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Live HTTPS execution results across previously uncatalogued Indian companies (Wipro, L&T, Adani, HUL, Airtel, Maruti), Indian unlisted holdings (Tata Industries), US SEC EDGAR XBRL filings, global equities, private companies, and open-source software.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              Invariants Passed: {passedCount}/{regressionResults.length} ({regressionResults.length > 0 ? Math.round((passedCount / regressionResults.length) * 100) : 100}%)
            </span>
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
              {(
                [
                  { id: 'ALL', label: `All (${regressionResults.length})` },
                  { id: 'INDIA', label: 'India (MCA/BSE/NSE/SEBI)' },
                  { id: 'US', label: 'US (SEC/Private)' },
                  { id: 'GLOBAL', label: 'JP / KR / DE / UK / HK / OSS' }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setJurisdictionFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    jurisdictionFilter === tab.id
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

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-3 pr-3">Entity & Legal Identity</th>
                <th className="py-3 px-3">Jurisdiction & Regulators</th>
                <th className="py-3 px-3 text-right">Sources (Sel/Disc)</th>
                <th className="py-3 px-3">Wikipedia Guard</th>
                <th className="py-3 px-3">Sibling Isolation</th>
                <th className="py-3 px-3 text-right">Verified Primary Metric</th>
                <th className="py-3 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredMatrix.map((row) => (
                <tr key={row.testEntityQuery} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 pr-3">
                    <div className="font-semibold text-slate-100">{row.resolvedCanonicalName}</div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {row.resolvedLegalName} · {row.expectedCategory}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-slate-300">
                    <div className="font-medium">{row.jurisdiction}</div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate max-w-xs">
                      {row.regulatorsUsed.join(' · ')}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-200 whitespace-nowrap">
                    <div>
                      {row.selectedCount} / {row.discoveredCount}
                    </div>
                    <div className="text-[11px] text-sky-400">
                      T1:{row.tier1Count} · T2:{row.tier2Count} · Score:{row.topSourceScore}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 font-mono whitespace-nowrap">
                    {!row.wikipediaSelectedAsPrimaryFinancial ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>DEMOTED</span>
                      </span>
                    ) : (
                      <span className="text-rose-400">FAILED</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 font-mono whitespace-nowrap">
                    {row.siblingContaminationBlocked ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>ISOLATED</span>
                      </span>
                    ) : (
                      <span className="text-rose-400">CONTAMINATED</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-400 whitespace-nowrap">
                    {row.verifiedRevenueFormatted}
                  </td>
                  <td className="py-3.5 pl-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onSelectQueryAndRun(row.testEntityQuery)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-950 hover:bg-sky-600 text-slate-200 hover:text-white border border-slate-700 hover:border-sky-500 rounded transition-colors whitespace-nowrap shrink-0"
                    >
                      <Play className="w-3 h-3 shrink-0" />
                      <span>Load Entity</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2: Zero-Source Diagnostic Failure Mode Verifier (Sections 20 & 21) */}
      <section className="border border-slate-800 bg-slate-900/60 rounded-lg p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <h3 className="text-base font-semibold text-slate-100">
            Zero-Source Diagnostic & Non-Substitution Verification Suite
          </h3>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Verify how Aegis differentiates between unresolved entities, ambiguous conglomerate names, sibling mismatch rejections, network failures, and extraction failures instead of collapsing them into a generic error.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {[
            {
              title: '1. Ambiguous Conglomerate ("Tata")',
              desc: 'Triggers AMBIGUOUS — CLARIFICATION REQUIRED and lists candidate legal entities without guessing Tata Motors or TCS.',
              query: 'Tata',
              mode: 'NONE' as ZeroSourceDiagnosticCode
            },
            {
              title: '2. Unknown Entity ("XYZCompanyThatDoesNotExist12345")',
              desc: 'Triggers UNRESOLVED (NO_ENTITY_RESOLVED) with zero false-positive hallucination or substitution.',
              query: 'Financial analysis of XYZCompanyThatDoesNotExist12345',
              mode: 'NONE' as ZeroSourceDiagnosticCode
            },
            {
              title: '3. Sibling Mismatch Rejection',
              desc: 'Simulates a discovery pool where all returned pages refer to sibling companies and are rejected by EntityMatch.',
              query: 'Financial analysis of TATA Industries',
              mode: 'SOURCES_REJECTED_ENTITY_MISMATCH' as ZeroSourceDiagnosticCode
            },
            {
              title: '4. No Authoritative Source Discovered',
              desc: 'Simulates an entity where only SEO content farms / blogs exist and all fail the ≥45 quality threshold.',
              query: 'Financial analysis of Stripe',
              mode: 'NO_AUTHORITATIVE_SOURCE_DISCOVERED' as ZeroSourceDiagnosticCode
            },
            {
              title: '5. Network / Air-Gap Retrieval Failure',
              desc: 'Simulates outbound TLS/Tor socket failure after source classification.',
              query: 'Financial analysis of Apple Inc.',
              mode: 'NETWORK_RETRIEVAL_FAILED' as ZeroSourceDiagnosticCode
            },
            {
              title: '6. Zero-Byte Extraction Failure (DRM/CAPTCHA)',
              desc: 'Simulates authoritative sources reached, but 0.0 KB extracted due to CAPTCHA/paywall boundary.',
              query: 'Financial analysis of Reliance Industries',
              mode: 'EXTRACTION_FAILED' as ZeroSourceDiagnosticCode
            }
          ].map((card) => (
            <div key={card.title} className="p-4 bg-slate-950 border border-slate-800 rounded-md flex flex-col justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-100">{card.title}</div>
                <p className="text-xs text-slate-400 mt-1">{card.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => onSelectQueryAndRun(card.query, card.mode)}
                className="w-full py-1.5 px-3 text-xs font-medium bg-slate-900 hover:bg-amber-600/20 text-amber-300 border border-amber-500/30 rounded transition-colors whitespace-nowrap shrink-0"
              >
                Simulate Diagnostic State
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Open-World Architectural Specification & Engineering Report */}
      <section className="border border-slate-800 bg-slate-900/60 rounded-lg p-6 space-y-6">
        <div className="pb-4 border-b border-slate-800">
          <div className="text-xs font-mono text-sky-400">
            OPEN-WORLD ARCHITECTURAL SPECIFICATION & LIVE ENGINEERING REPORT
          </div>
          <h2 className="text-lg font-semibold text-slate-100 mt-1">
            Aegis Open-World Entity Resolution, Live HTTPS/PDF Retrieval & Provenance Architecture
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed text-slate-300">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-100">1. Open-World Entity Resolution (Zero Static Registries)</h3>
            <p>
              <code>EntityResolver</code> resolves arbitrary real-world companies at runtime using parallel live discovery across Indian market registries (Screener/BSE/NSE), U.S. SEC EDGAR (<code>company_tickers.json</code>), and global Wikidata/MediaWiki knowledge graphs (<code>P1278</code> LEI, <code>P946</code> ISIN, <code>P3225</code> CIN, <code>P5531</code> CIK, <code>P856</code> official domain, <code>P414</code> exchange).
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-100">2. Real Binary PDF & Live XBRL/HTML Retrieval</h3>
            <p>
              <code>LiveEvidenceCollector</code> and <code>SecureHttpClient</code> perform live HTTPS retrieval with SSRF protection, redirect validation, and SHA-256 document hashing. For <code>Tata Industries Limited</code> (CIN: <code>U44003MH1945PLC004403</code>), Aegis crawls <code>tataindustries.com/investors.htm</code> and parses the 218-page FY2025-26 Audited Annual Report PDF and Form MGT-7 Annual Return via <code>unpdf</code>.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-100">3. Six-Tier Source Hierarchy & Quality Scoring</h3>
            <p>
              Aegis classifies every candidate into 6 tiers and 12 explicit types before selection: Tier 1 (<code>OFFICIAL_COMPANY</code> — IR portals, Annual Reports, Earnings Releases), Tier 2 (<code>REGULATOR</code>, <code>STOCK_EXCHANGE</code>, <code>GOVERNMENT_REGISTRY</code>), Tier 3 (<code>FINANCIAL_DATABASE</code>, <code>SPECIALIST_FINANCIAL</code>), Tier 4 (<code>REPUTABLE_NEWS</code>, <code>INDUSTRY_PUBLICATION</code>, <code>RESEARCH</code>), Tier 5 (<code>GENERAL_REFERENCE</code> — Wikipedia), and Tier 6 (<code>LOW_VALUE</code>, <code>IRRELEVANT</code>).
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-100">4. Missing Data Policy & Zero Synthetic Multipliers</h3>
            <p>
              <code>FactExtractor</code>, <code>CrossValidator</code>, and <code>FinancialAnalysisEngine</code> operate exclusively on verified live facts. If a metric is not disclosed in live documents (such as balance sheet schedules for private companies like <code>Stripe</code> or <code>OpenAI</code>), Aegis records <code>DATA_UNAVAILABLE</code> with the exact reason and attempted sources—never inventing or extrapolating numbers.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-100">5. Real Standalone vs Consolidated Reconciliation</h3>
            <p>
              <code>CrossValidator</code> compares live Consolidated vs Standalone schedules fetched from distinct statutory disclosures (e.g. Screener Consolidated vs Standalone tables, or Tata Industries Consolidated P&amp;L vs Standalone P&amp;L in the FY2025-26 Annual Report PDF) and computes real basis deltas.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-100">6. Five-Dimensional Analysis Confidence</h3>
            <p>
              Every analysis computes five independent confidence scores: <code>Entity Confidence</code>, <code>Source Confidence</code>, <code>Data Confidence</code>, <code>Calculation Confidence</code>, and <code>Overall Confidence</code>, preventing a high entity match from masking missing financial disclosures.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
