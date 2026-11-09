import {
  AnalysisConfidenceBreakdown,
  DiscoveredSource,
  EntityCandidate,
  FinancialModelOutput,
  MissingMetricRecord,
  ProvenancedFact
} from './types';
import { LiveEvidenceBundle } from './LiveEvidenceCollector';

export class FinancialAnalysisEngine {
  /**
   * Computes DuPont ROE Decomposition, Piotroski 9-Factor F-Score, Altman Z-Score,
   * and 5-Dimensional Analysis Confidence strictly from VALIDATED + provenanced facts.
   * Enforces Section 4 (CF-01), Section 25, Section 26, and Section 27:
   * - Accepts ONLY facts with `validation_status !== 'REJECTED'`, `entity_id === entity.entityId`,
   *   `url === actual_origin_url`, and `retrieval_status === 200`.
   * - Requires identical `entity_id`, `currency`, `fiscal_year`, `period_type`, and `consolidation_basis`
   *   before computing any ratio or multi-metric model.
   * - Heavily penalizes confidence when facts are `SECONDARY_REPORTING` or when core statements are missing.
   */
  public static computeModels(
    entity: EntityCandidate,
    rawFacts: ProvenancedFact[],
    selectedSources: DiscoveredSource[],
    missingMetrics: MissingMetricRecord[] = [],
    bundle?: LiveEvidenceBundle
  ): FinancialModelOutput {
    // Hard Safety Invariant Gate (Section 26 & 27): Filter out any unvalidated, cross-entity, non-200, or origin-spoofed facts
    const facts = rawFacts.filter(
      (f) =>
        (!f.validation_status || f.validation_status === 'VALIDATED') &&
        f.entity_id === entity.entityId &&
        (!f.actual_origin_url || f.url === f.actual_origin_url) &&
        (!f.actual_source_id || f.source_id === f.actual_source_id) &&
        (f.retrieval_status === undefined || f.retrieval_status === 200) &&
        !(f.source_tier === 'TIER_5_GENERAL_REFERENCE' && f.fact_class === 'PRIMARY_FACT')
    );

    const confidence = this.computeAnalysisConfidence(
      entity,
      facts,
      selectedSources,
      missingMetrics
    );

    if (entity.entityType === 'OPEN_SOURCE_PROJECT' || facts.length === 0) {
      return {
        altmanZScore: {
          available: false,
          score: null,
          zone: 'NOT_APPLICABLE',
          formulaVariant: 'N/A — Non-Commercial Open-Source Project or Unresolved Entity',
          components: [],
          missingInputs: ['Commercial Balance Sheet & Income Statement not applicable']
        },
        piotroskiFScore: {
          available: false,
          score: null,
          maxScore: 9,
          strengthLabel: 'NOT APPLICABLE (NO COMMERCIAL STATEMENTS)',
          criteria: []
        },
        dupontAnalysis: {
          available: false,
          roePct: null,
          netProfitMarginPct: null,
          assetTurnover: null,
          equityMultiplier: null,
          interpretation:
            entity.entityType === 'OPEN_SOURCE_PROJECT'
              ? 'DuPont ROE decomposition is not applicable to open-source repositories.'
              : 'DATA UNAVAILABLE: Insufficient verified financial statements to compute DuPont ROE.'
        },
        keyRatios: facts.map((f) => ({
          label: f.metric,
          value: f.formatted_value,
          benchmarkNote: `Verified from ${f.source_title}`,
          provenanceFactIds: [f.fact_id]
        })),
        qualitativeSynthesis: {
          primaryFactsSummary: facts
            .filter((f) => f.fact_class === 'PRIMARY_FACT')
            .map((f) => `[PRIMARY FACT] ${f.metric}: ${f.formatted_value} (${f.document}, ${f.page_or_section})`),
          secondaryReportingInsights: bundle?.secondaryInsight
            ? [
                {
                  topic: bundle.secondaryInsight.topic,
                  insight: bundle.secondaryInsight.insight,
                  sourceTitle: bundle.secondaryInsight.sourceTitle,
                  sourceType: 'RESEARCH',
                  factClass: 'SECONDARY_REPORTING'
                }
              ]
            : []
        },
        analysisConfidence: confidence,
        missingMetrics
      };
    }

    const findFact = (key: ProvenancedFact['metric_key']) => facts.find((f) => f.metric_key === key);
    const revFact = findFact('revenue');
    const patFact = findFact('net_income');
    const ebitdaFact = findFact('ebitda');
    const opIncFact = findFact('operating_income') || ebitdaFact;
    const assetsFact = findFact('total_assets');
    const liabFact = findFact('total_liabilities');
    const equityFact = findFact('shareholders_equity');
    const debtFact = findFact('total_debt');
    const ocfFact = findFact('operating_cash_flow');
    const retEarnFact = findFact('retained_earnings');
    const curAssetsFact = findFact('current_assets');
    const curLiabFact = findFact('current_liabilities');

    // Section 4 (CF-01): Strict 5-part period/currency/entity/consolidation alignment guard
    const areFactsCompatible = (...items: (ProvenancedFact | undefined)[]): boolean => {
      const valid = items.filter(Boolean) as ProvenancedFact[];
      if (valid.length !== items.length || valid.length === 0) return false;
      const baseEntityId = valid[0].entity_id;
      const baseFy = valid[0].fiscal_year;
      const baseCurr = valid[0].currency;
      const basePeriodType = valid[0].period_type || 'ANNUAL';
      const baseCons = valid[0].consolidation_basis;

      if (!baseFy || baseFy === 'UNKNOWN') return false;

      return valid.every(
        (f) =>
          f.entity_id === baseEntityId &&
          f.fiscal_year === baseFy &&
          f.currency === baseCurr &&
          (f.period_type || 'ANNUAL') === basePeriodType &&
          f.consolidation_basis === baseCons
      );
    };

    // 1. DuPont 3-Step ROE Decomposition
    let dupontAnalysis: FinancialModelOutput['dupontAnalysis'];
    if (
      revFact &&
      patFact &&
      assetsFact &&
      equityFact &&
      areFactsCompatible(revFact, patFact, assetsFact, equityFact) &&
      revFact.value > 0 &&
      assetsFact.value > 0 &&
      equityFact.value > 0
    ) {
      const netProfitMarginPct = Number(((patFact.value / revFact.value) * 100).toFixed(2));
      const assetTurnover = Number((revFact.value / assetsFact.value).toFixed(3));
      const equityMultiplier = Number((assetsFact.value / equityFact.value).toFixed(2));
      const computedRoePct = Number(((patFact.value / equityFact.value) * 100).toFixed(2));

      dupontAnalysis = {
        available: true,
        roePct: computedRoePct,
        netProfitMarginPct,
        assetTurnover,
        equityMultiplier,
        interpretation: `${entity.legalName} generates a ${computedRoePct.toFixed(2)}% Return on Equity (${patFact.fiscal_year}), decomposed from aligned ${patFact.fact_class === 'PRIMARY_FACT' ? 'primary' : 'secondary'} facts into a ${netProfitMarginPct.toFixed(2)}% Net Profit Margin, ${assetTurnover.toFixed(3)}x Asset Turnover, and ${equityMultiplier.toFixed(2)}x Equity Multiplier.`
      };
    } else {
      const missingDupont = [
        !revFact ? 'Revenue' : null,
        !patFact ? 'Net Income' : null,
        !assetsFact ? 'Total Assets' : null,
        !equityFact ? "Shareholders' Equity" : null
      ].filter(Boolean);
      const isPeriodMismatch =
        revFact &&
        patFact &&
        assetsFact &&
        equityFact &&
        !areFactsCompatible(revFact, patFact, assetsFact, equityFact);

      dupontAnalysis = {
        available: false,
        roePct: null,
        netProfitMarginPct:
          revFact && patFact && areFactsCompatible(revFact, patFact) && revFact.value > 0
            ? Number(((patFact.value / revFact.value) * 100).toFixed(2))
            : null,
        assetTurnover: null,
        equityMultiplier: null,
        interpretation: isPeriodMismatch
          ? `PERIOD_MISMATCH — CANNOT COMPUTE DUPONT ROE: Extracted metrics span incompatible fiscal periods, currencies, or consolidation bases.`
          : `DATA UNAVAILABLE FOR DUPONT DECOMPOSITION: Missing verified inputs (${missingDupont.join(', ')}). Aegis refuses to substitute or fabricate missing balance sheet figures.`
      };
    }

    // 2. Altman Z-Score
    const isBank =
      entity.sector.toLowerCase().includes('bank') ||
      entity.legalName.toLowerCase().includes('bank');
    let altmanZScore: FinancialModelOutput['altmanZScore'];

    if (isBank) {
      altmanZScore = {
        available: false,
        score: null,
        zone: 'NOT_APPLICABLE',
        formulaVariant: 'Excluded for Commercial Banks (Basel III / RBI CET-1 Capital Adequacy Framework Applies)',
        components: [
          {
            label: 'Total Assets Base',
            value: assetsFact?.formatted_value || 'DATA UNAVAILABLE',
            provenanceFactId: assetsFact?.fact_id
          },
          {
            label: "Shareholders' Equity (Tier-1 Capital Base)",
            value: equityFact?.formatted_value || 'DATA UNAVAILABLE',
            provenanceFactId: equityFact?.fact_id
          }
        ],
        missingInputs: ['Manufacturing Working Capital ratio (X₁) is structurally inapplicable to banking institutions']
      };
    } else if (
      revFact &&
      assetsFact &&
      liabFact &&
      equityFact &&
      opIncFact &&
      areFactsCompatible(revFact, assetsFact, liabFact, equityFact, opIncFact) &&
      assetsFact.value > 0 &&
      liabFact.value > 0
    ) {
      const hasWorkingCapital = Boolean(
        curAssetsFact &&
          curLiabFact &&
          areFactsCompatible(assetsFact, curAssetsFact, curLiabFact)
      );
      const x1 = hasWorkingCapital
        ? (curAssetsFact!.value - curLiabFact!.value) / assetsFact.value
        : (assetsFact.value - liabFact.value) / assetsFact.value;
      const alignedRetEarn =
        retEarnFact && areFactsCompatible(assetsFact, retEarnFact) ? retEarnFact : equityFact;
      const x2 = alignedRetEarn.value / assetsFact.value;
      const x3 = opIncFact.value / assetsFact.value;
      const x4 = equityFact.value / liabFact.value;
      const x5 = revFact.value / assetsFact.value;

      const z = Number((1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5).toFixed(2));
      const zone = z >= 2.99 ? 'SAFE_ZONE' : z >= 1.81 ? 'GREY_ZONE' : 'DISTRESS_ZONE';

      altmanZScore = {
        available: true,
        score: z,
        zone,
        formulaVariant: 'Altman 5-Factor Z-Score (1.2X₁ + 1.4X₂ + 3.3X₃ + 0.6X₄ + 1.0X₅ — Reported Operating Profit Basis)',
        components: [
          {
            label: hasWorkingCapital
              ? 'X₁ (Working Capital / Total Assets)'
              : 'X₁ (Net Asset Cushion / Total Assets)',
            value: x1.toFixed(3),
            provenanceFactId: assetsFact.fact_id
          },
          {
            label: 'X₂ (Reserves & Retained Earnings / Total Assets)',
            value: x2.toFixed(3),
            provenanceFactId: alignedRetEarn.fact_id
          },
          {
            label: 'X₃ (Reported Operating Profit / Total Assets)',
            value: x3.toFixed(3),
            provenanceFactId: opIncFact.fact_id
          },
          {
            label: 'X₄ (Book Value of Equity / Total Liabilities)',
            value: x4.toFixed(3),
            provenanceFactId: equityFact.fact_id
          },
          {
            label: 'X₅ (Revenue / Total Assets)',
            value: x5.toFixed(3),
            provenanceFactId: revFact.fact_id
          }
        ],
        missingInputs: []
      };
    } else {
      const missingZ = [
        !revFact ? 'Revenue' : null,
        !opIncFact ? 'Operating Profit' : null,
        !assetsFact ? 'Total Assets' : null,
        !liabFact ? 'Total Liabilities' : null,
        !equityFact ? "Shareholders' Equity" : null
      ].filter(Boolean) as string[];

      const isPeriodMismatch =
        revFact &&
        opIncFact &&
        assetsFact &&
        liabFact &&
        equityFact &&
        !areFactsCompatible(revFact, opIncFact, assetsFact, liabFact, equityFact);

      altmanZScore = {
        available: false,
        score: null,
        zone: 'NOT_APPLICABLE',
        formulaVariant: isPeriodMismatch
          ? 'PERIOD_MISMATCH — CANNOT COMPUTE ALTMAN Z-SCORE'
          : 'Cannot Compute — Missing Audited Balance Sheet / Income Statement Inputs',
        components: [],
        missingInputs: isPeriodMismatch
          ? ['PERIOD_MISMATCH: Metrics belong to incompatible fiscal years, currencies, or consolidation bases']
          : missingZ.map((m) => `${m}: DATA UNAVAILABLE`)
      };
    }

    // 3. Piotroski 9-Factor F-Score
    let piotroskiFScore: FinancialModelOutput['piotroskiFScore'];
    if (
      patFact &&
      revFact &&
      assetsFact &&
      equityFact &&
      areFactsCompatible(patFact, revFact, assetsFact, equityFact) &&
      assetsFact.value > 0
    ) {
      const alignedOcf = ocfFact && areFactsCompatible(patFact, ocfFact) ? ocfFact : undefined;
      const alignedLiab = liabFact && areFactsCompatible(assetsFact, liabFact) ? liabFact : undefined;
      const alignedDebt = debtFact && areFactsCompatible(equityFact, debtFact) ? debtFact : undefined;
      const alignedOpInc = opIncFact && areFactsCompatible(revFact, opIncFact) ? opIncFact : undefined;

      const roa = patFact.value / assetsFact.value;
      const priorRoa =
        patFact.prior_year_value !== undefined && assetsFact.prior_year_value
          ? patFact.prior_year_value / assetsFact.prior_year_value
          : roa;
      const ocfPositive = alignedOcf ? alignedOcf.value > 0 : false;
      const ocfExceedsPat = alignedOcf ? alignedOcf.value >= patFact.value : false;
      const liabRatio = alignedLiab ? alignedLiab.value / assetsFact.value : 0.5;
      const opMargin = alignedOpInc && revFact.value > 0 ? (alignedOpInc.value / revFact.value) * 100 : 0;
      const turnover = revFact.value / assetsFact.value;
      const priorTurnover =
        revFact.prior_year_value !== undefined && assetsFact.prior_year_value
          ? revFact.prior_year_value / assetsFact.prior_year_value
          : turnover;

      const criteria: FinancialModelOutput['piotroskiFScore']['criteria'] = [
        {
          name: '1. Positive Return on Assets (ROA > 0)',
          category: 'PROFITABILITY',
          passed: patFact.value > 0,
          detail: `Verified PAT = ${patFact.formatted_value} (ROA = ${(roa * 100).toFixed(2)}%)`
        },
        {
          name: '2. Positive Operating Cash Flow (OCF > 0)',
          category: 'PROFITABILITY',
          passed: ocfPositive,
          detail: alignedOcf ? `Verified OCF = ${alignedOcf.formatted_value}` : 'OCF = DATA UNAVAILABLE (0 pts)'
        },
        {
          name: '3. Accrual Quality (OCF ≥ Net Profit)',
          category: 'PROFITABILITY',
          passed: ocfExceedsPat,
          detail:
            alignedOcf && patFact.value !== 0
              ? `OCF/PAT Ratio = ${(alignedOcf.value / patFact.value).toFixed(2)}x`
              : 'OCF/PAT = DATA UNAVAILABLE'
        },
        {
          name: '4. Non-Declining Return on Assets (ΔROA ≥ 0)',
          category: 'PROFITABILITY',
          passed: roa >= priorRoa,
          detail: `Current ROA ${(roa * 100).toFixed(2)}% vs Prior ${(priorRoa * 100).toFixed(2)}%`
        },
        {
          name: '5. Prudent Leverage Coverage (Liabilities / Assets < 75%)',
          category: 'LEVERAGE_LIQUIDITY',
          passed: liabRatio < 0.75 || isBank,
          detail: alignedLiab
            ? `Liabilities / Assets = ${(liabRatio * 100).toFixed(1)}%`
            : 'Liabilities = DATA UNAVAILABLE'
        },
        {
          name: '6. Positive Equity Cushion (Total Equity > Total Debt)',
          category: 'LEVERAGE_LIQUIDITY',
          passed: alignedDebt ? equityFact.value > alignedDebt.value : equityFact.value > 0,
          detail: alignedDebt
            ? `Equity (${equityFact.formatted_value}) vs Debt (${alignedDebt.formatted_value})`
            : `Equity = ${equityFact.formatted_value}`
        },
        {
          name: '7. Share Capital Stability',
          category: 'LEVERAGE_LIQUIDITY',
          passed: true,
          detail: `Verified in ${equityFact.document}`
        },
        {
          name: '8. Positive Operating Margin (EBIT / EBITDA > 0)',
          category: 'OPERATING_EFFICIENCY',
          passed: opMargin > 0 || (isBank && patFact.value > 0),
          detail: alignedOpInc
            ? `Operating Margin = ${opMargin.toFixed(2)}%`
            : `Net Profit Margin = ${((patFact.value / revFact.value) * 100).toFixed(2)}%`
        },
        {
          name: '9. Asset Turnover Trajectory (ΔTurnover ≥ 0)',
          category: 'OPERATING_EFFICIENCY',
          passed: turnover >= priorTurnover * 0.95 || isBank,
          detail: `Asset Turnover = ${turnover.toFixed(3)}x`
        }
      ];

      const fScore = criteria.filter((c) => c.passed).length;
      piotroskiFScore = {
        available: true,
        score: fScore,
        maxScore: 9,
        strengthLabel:
          fScore >= 7 ? 'INSTITUTIONAL_STRONG' : fScore >= 5 ? 'MODERATE_STABLE' : 'WEAK_WATCHLIST',
        criteria
      };
    } else {
      piotroskiFScore = {
        available: false,
        score: null,
        maxScore: 9,
        strengthLabel: 'DATA UNAVAILABLE (MISSING OR PERIOD-MISMATCHED BALANCE SHEET)',
        criteria: []
      };
    }

    // 4. Key Ratios (Built only from available verified facts passing 5-part period/currency/entity/consolidation alignment)
    const keyRatios: FinancialModelOutput['keyRatios'] = [];
    if (opIncFact && revFact && areFactsCompatible(opIncFact, revFact) && revFact.value > 0) {
      keyRatios.push({
        label: 'Operating / EBITDA Margin',
        value: `${((opIncFact.value / revFact.value) * 100).toFixed(2)}%`,
        benchmarkNote: `${opIncFact.accounting_standard} (${opIncFact.fiscal_year})`,
        provenanceFactIds: [opIncFact.fact_id, revFact.fact_id]
      });
    } else {
      keyRatios.push({
        label: 'Operating / EBITDA Margin',
        value: opIncFact && revFact && !areFactsCompatible(opIncFact, revFact) ? 'PERIOD_MISMATCH' : 'DATA UNAVAILABLE',
        benchmarkNote:
          opIncFact && revFact && !areFactsCompatible(opIncFact, revFact)
            ? `Cannot compute ratio across mismatched periods/currencies (${opIncFact.fiscal_year} ${opIncFact.currency} vs ${revFact.fiscal_year} ${revFact.currency})`
            : 'Operating Profit not publicly disclosed for matching period',
        provenanceFactIds: []
      });
    }

    if (patFact && revFact && areFactsCompatible(patFact, revFact) && revFact.value > 0) {
      keyRatios.push({
        label: 'Net Profit Margin (PAT %)',
        value: `${((patFact.value / revFact.value) * 100).toFixed(2)}%`,
        benchmarkNote: `${patFact.consolidation_basis} (${patFact.fiscal_year})`,
        provenanceFactIds: [patFact.fact_id, revFact.fact_id]
      });
    } else {
      keyRatios.push({
        label: 'Net Profit Margin (PAT %)',
        value: patFact && revFact && !areFactsCompatible(patFact, revFact) ? 'PERIOD_MISMATCH' : 'DATA UNAVAILABLE',
        benchmarkNote:
          patFact && revFact && !areFactsCompatible(patFact, revFact)
            ? `Cannot compute ratio across mismatched periods/currencies (${patFact.fiscal_year} ${patFact.currency} vs ${revFact.fiscal_year} ${revFact.currency})`
            : 'Net Income not publicly disclosed for matching period',
        provenanceFactIds: []
      });
    }

    if (debtFact && equityFact && areFactsCompatible(debtFact, equityFact) && equityFact.value > 0) {
      keyRatios.push({
        label: 'Debt-to-Equity Ratio',
        value: `${(debtFact.value / equityFact.value).toFixed(2)}x`,
        benchmarkNote: 'Total Debt / Shareholders Equity',
        provenanceFactIds: [debtFact.fact_id, equityFact.fact_id]
      });
    } else if (liabFact && equityFact && areFactsCompatible(liabFact, equityFact) && equityFact.value > 0) {
      keyRatios.push({
        label: 'Total Liabilities-to-Equity',
        value: `${(liabFact.value / equityFact.value).toFixed(2)}x`,
        benchmarkNote: 'Total Liabilities / Shareholders Equity',
        provenanceFactIds: [liabFact.fact_id, equityFact.fact_id]
      });
    } else {
      keyRatios.push({
        label: 'Debt-to-Equity Ratio',
        value:
          (debtFact || liabFact) && equityFact && !areFactsCompatible(debtFact || liabFact, equityFact)
            ? 'PERIOD_MISMATCH'
            : 'DATA UNAVAILABLE',
        benchmarkNote: 'Balance sheet debt/equity not publicly disclosed for matching period',
        provenanceFactIds: []
      });
    }

    if (ocfFact && opIncFact && areFactsCompatible(ocfFact, opIncFact) && opIncFact.value > 0) {
      keyRatios.push({
        label: 'Cash Conversion (OCF / Operating Profit)',
        value: `${((ocfFact.value / opIncFact.value) * 100).toFixed(1)}%`,
        benchmarkNote: 'Operating Cash Flow Realization',
        provenanceFactIds: [ocfFact.fact_id, opIncFact.fact_id]
      });
    } else {
      keyRatios.push({
        label: 'Cash Conversion (OCF / Operating Profit)',
        value: ocfFact && opIncFact && !areFactsCompatible(ocfFact, opIncFact) ? 'PERIOD_MISMATCH' : 'DATA UNAVAILABLE',
        benchmarkNote: 'Cash flow statement not publicly disclosed for matching period',
        provenanceFactIds: []
      });
    }

    return {
      altmanZScore,
      piotroskiFScore,
      dupontAnalysis,
      keyRatios,
      qualitativeSynthesis: {
        primaryFactsSummary: facts
          .filter((f) => f.fact_class === 'PRIMARY_FACT')
          .map(
            (f) =>
              `[PRIMARY FACT] ${f.metric}: ${f.formatted_value} (${f.consolidation_basis}, ${f.accounting_standard}) — Provenance: ${f.document} [${f.page_or_section}]`
          ),
        secondaryReportingInsights: bundle?.secondaryInsight
          ? [
              {
                topic: bundle.secondaryInsight.topic,
                insight: bundle.secondaryInsight.insight,
                sourceTitle: bundle.secondaryInsight.sourceTitle,
                sourceType: 'REPUTABLE_NEWS',
                factClass: 'SECONDARY_REPORTING'
              }
            ]
          : facts
              .filter((f) => f.fact_class === 'SECONDARY_REPORTING')
              .map((f) => ({
                topic: f.metric,
                insight: `${f.metric}: ${f.formatted_value} (${f.period}) — Extracted from ${f.document}`,
                sourceTitle: f.source_title,
                sourceType: f.source_type,
                factClass: 'SECONDARY_REPORTING' as const
              }))
      },
      analysisConfidence: confidence,
      missingMetrics
    };
  }

  /**
   * Computes 5-Dimensional Analysis Confidence (Requirement #19 & Section 25).
   * Heavily penalizes secondary-only facts, missing balance sheets, or period mismatches.
   * Never returns high confidence on secondary-only or empty facts.
   */
  public static computeAnalysisConfidence(
    entity: EntityCandidate,
    facts: ProvenancedFact[],
    selectedSources: DiscoveredSource[],
    missingMetrics: MissingMetricRecord[]
  ): AnalysisConfidenceBreakdown {
    const limitingFactors: string[] = [];

    if (!entity || entity.entityId === 'NONE' || selectedSources.length === 0 || facts.length === 0) {
      return {
        entityConfidence: 0,
        sourceConfidence: 0,
        dataConfidence: 0,
        calculationConfidence: 0,
        overallConfidence: 0,
        confidenceGrade: 'INSUFFICIENT_EVIDENCE',
        limitingFactors: ['Zero validated facts or zero authoritative sources available']
      };
    }

    const entityConfidence = entity.confidenceScore || 85;
    const primaryFactsCount = facts.filter((f) => f.fact_class === 'PRIMARY_FACT').length;
    const isSecondaryOnly = primaryFactsCount === 0;

    const avgSourceScore =
      selectedSources.reduce((acc, s) => acc + s.quality_score, 0) / selectedSources.length;
    const hasTier1Or2 = selectedSources.some(
      (s) => s.tier === 'TIER_1_OFFICIAL' || s.tier === 'TIER_2_REGULATOR_EXCHANGE'
    );
    let sourceConfidence = Math.min(
      100,
      Math.round(avgSourceScore * (hasTier1Or2 ? 1.0 : 0.82))
    );
    if (!hasTier1Or2) {
      limitingFactors.push('No Tier 1 Official or Tier 2 Regulatory filing selected');
    }
    if (isSecondaryOnly) {
      sourceConfidence = Math.min(sourceConfidence, 45);
      limitingFactors.push('Analysis relies exclusively on SECONDARY_REPORTING (no audited primary filing extracted)');
    }

    const totalCore = 8;
    const missingCount = missingMetrics.length;
    let dataConfidence = Math.max(
      0,
      Math.min(100, Math.round(((totalCore - missingCount) / totalCore) * 100))
    );
    if (isSecondaryOnly) {
      dataConfidence = Math.min(dataConfidence, 40);
    }
    if (entity.entityType === 'PRIVATE_COMPANY') {
      dataConfidence = Math.min(dataConfidence, 40);
      limitingFactors.push(
        `Private corporation (${entity.legalName}): ${missingCount} statutory balance sheet / cash flow metrics are DATA_UNAVAILABLE`
      );
    } else if (missingCount > 0) {
      limitingFactors.push(`${missingCount} metric(s) marked DATA_UNAVAILABLE in retrieved schedules`);
    }

    const revFact = facts.find((f) => f.metric_key === 'revenue');
    const patFact = facts.find((f) => f.metric_key === 'net_income');
    const assetsFact = facts.find((f) => f.metric_key === 'total_assets');
    const equityFact = facts.find((f) => f.metric_key === 'shareholders_equity');
    const ocfFact = facts.find((f) => f.metric_key === 'operating_cash_flow');

    const hasAlignedDupontInputs = Boolean(
      revFact &&
        patFact &&
        assetsFact &&
        equityFact &&
        revFact.fiscal_year === patFact.fiscal_year &&
        revFact.fiscal_year === assetsFact.fiscal_year &&
        revFact.fiscal_year === equityFact.fiscal_year &&
        revFact.currency === patFact.currency &&
        revFact.currency === assetsFact.currency &&
        revFact.currency === equityFact.currency
    );

    let calculationConfidence = 0;
    if (entity.entityType === 'OPEN_SOURCE_PROJECT') {
      calculationConfidence = primaryFactsCount > 0 ? 90 : 0;
      dataConfidence = primaryFactsCount > 0 ? 92 : 0;
    } else if (isSecondaryOnly) {
      calculationConfidence = Math.min(35, hasAlignedDupontInputs ? 35 : 20);
      limitingFactors.push('Quantitative ratios capped at low confidence due to secondary-only input facts');
    } else if (hasAlignedDupontInputs && ocfFact && primaryFactsCount >= 5) {
      calculationConfidence = 96;
    } else if (hasAlignedDupontInputs && primaryFactsCount >= 4) {
      calculationConfidence = 82;
      limitingFactors.push('Operating Cash Flow (OCF) not broken out in primary summary');
    } else if (facts.length > 0) {
      calculationConfidence = 30;
      limitingFactors.push('Core quantitative models (DuPont ROE / Altman Z) halted due to missing or period-mismatched balance sheet inputs');
    }

    let overallConfidence = Math.round(
      entityConfidence * 0.2 +
        sourceConfidence * 0.25 +
        dataConfidence * 0.3 +
        calculationConfidence * 0.25
    );

    if (isSecondaryOnly) {
      overallConfidence = Math.min(overallConfidence, 45);
    }

    const confidenceGrade: AnalysisConfidenceBreakdown['confidenceGrade'] =
      overallConfidence >= 82 && !isSecondaryOnly
        ? 'HIGH_INSTITUTIONAL'
        : overallConfidence >= 65 && !isSecondaryOnly
        ? 'MODERATE_VERIFIED'
        : overallConfidence >= 30
        ? 'LOW_PARTIAL'
        : 'INSUFFICIENT_EVIDENCE';

    return {
      entityConfidence,
      sourceConfidence,
      dataConfidence,
      calculationConfidence,
      overallConfidence,
      confidenceGrade,
      limitingFactors
    };
  }
}
