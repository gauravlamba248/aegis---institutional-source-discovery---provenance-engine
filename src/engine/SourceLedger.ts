import {
  DiscoveredSource,
  EntityResolutionResult,
  LedgerSummaryStats,
  ProvenancedFact,
  ZeroSourceDiagnosticCode
} from './types';

export class SourceLedger {
  public static compileLedgerSummary(params: {
    maxSourcesRequested: number;
    entityResolution: EntityResolutionResult;
    allCandidates: DiscoveredSource[];
    selectedSources: DiscoveredSource[];
    provenancedFacts?: ProvenancedFact[];
    forcedDiagnosticMode?: ZeroSourceDiagnosticCode;
  }): LedgerSummaryStats {
    const {
      maxSourcesRequested,
      entityResolution,
      allCandidates,
      selectedSources,
      provenancedFacts = [],
      forcedDiagnosticMode
    } = params;

    if (forcedDiagnosticMode && forcedDiagnosticMode !== 'NONE') {
      return this.buildDiagnosticSummary(
        maxSourcesRequested,
        allCandidates.length,
        forcedDiagnosticMode,
        entityResolution
      );
    }

    if (entityResolution.status === 'UNRESOLVED') {
      return this.buildDiagnosticSummary(
        maxSourcesRequested,
        0,
        'NO_ENTITY_RESOLVED',
        entityResolution
      );
    }

    if (entityResolution.status === 'AMBIGUOUS — CLARIFICATION REQUIRED') {
      return this.buildDiagnosticSummary(
        maxSourcesRequested,
        0,
        'AMBIGUOUS_ENTITY_CLARIFICATION_REQUIRED',
        entityResolution
      );
    }

    if (allCandidates.length === 0) {
      return this.buildDiagnosticSummary(
        maxSourcesRequested,
        0,
        'NO_AUTHORITATIVE_SOURCE_DISCOVERED',
        entityResolution
      );
    }

    if (selectedSources.length === 0) {
      const allFailedEntityMatch = allCandidates.every(
        (c) =>
          c.entity_match_evaluation.isSiblingOrParentContamination ||
          !c.entity_match_evaluation.isExactEntity
      );
      return this.buildDiagnosticSummary(
        maxSourcesRequested,
        allCandidates.length,
        allFailedEntityMatch
          ? 'SOURCES_REJECTED_ENTITY_MISMATCH'
          : 'NO_AUTHORITATIVE_SOURCE_DISCOVERED',
        entityResolution
      );
    }

    const rawExtractedKb = Number(
      selectedSources.reduce((acc, s) => acc + s.raw_extracted_kb, 0).toFixed(1)
    );

    // Requirement #24: Zero Reconciled Facts Must Trigger Explainable Halt (INSUFFICIENT)
    if (rawExtractedKb <= 0 || provenancedFacts.length === 0) {
      return this.buildDiagnosticSummary(
        maxSourcesRequested,
        allCandidates.length,
        'EXTRACTION_FAILED',
        entityResolution
      );
    }

    const retrievedSourcesCount = allCandidates.filter(
      (c) => (!c.http_telemetry || c.http_telemetry.httpStatus === 200) && c.raw_extracted_kb > 0
    ).length;
    const parsedSourcesCount = allCandidates.filter((c) => c.raw_extracted_kb > 0).length;
    const entityVerifiedCount = allCandidates.filter(
      (c) => c.entity_match_evaluation.isExactEntity && !c.entity_match_evaluation.isSiblingOrParentContamination
    ).length;
    const usedSourceIds = new Set(
      provenancedFacts
        .filter((f) => f.validation_status === 'VALIDATED')
        .map((f) => f.actual_source_id || f.source_id)
    );
    const actuallyUsedCount = selectedSources.filter(
      (s) =>
        usedSourceIds.has(s.source_id) &&
        (s.lifecycle_stage === 'USED_IN_ANALYSIS' ||
          s.lifecycle_stage === 'PRODUCED_FACT' ||
          s.lifecycle_stage === 'USED')
    ).length;

    const uniqueDomainsSelected = new Set(selectedSources.map((s) => s.domain)).size;
    const hasPrimaryFacts = provenancedFacts.some((f) => f.fact_class === 'PRIMARY_FACT');
    const hasPrimaryTier = selectedSources.some(
      (s) =>
        (s.tier === 'TIER_1_OFFICIAL' || s.tier === 'TIER_2_REGULATOR_EXCHANGE') &&
        usedSourceIds.has(s.source_id)
    );
    const isPrivateEntity = entityResolution.resolvedEntity?.entityType === 'PRIVATE_COMPANY';

    const overallDataQuality: LedgerSummaryStats['overallDataQuality'] =
      isPrivateEntity || !hasPrimaryFacts
        ? 'PARTIAL_SECONDARY'
        : hasPrimaryTier && actuallyUsedCount >= 1 && provenancedFacts.length >= 4
        ? 'INSTITUTIONAL_GRADE'
        : hasPrimaryTier || provenancedFacts.length >= 4
        ? 'HIGH_VERIFIED'
        : 'PARTIAL_SECONDARY';

    return {
      requestedMaxSources: maxSourcesRequested,
      totalDiscoveredCandidates: allCandidates.length,
      retrievedSourcesCount,
      parsedSourcesCount,
      entityVerifiedCount,
      selectedSourcesCount: selectedSources.length,
      actuallyUsedCount,
      rejectedSourcesCount: allCandidates.length - selectedSources.length,
      uniqueDomainsSelected,
      rawExtractedKb,
      overallDataQuality,
      zeroSourceDiagnostic: {
        code: 'NONE',
        headline: 'VERIFIED — Live Multi-Tier Evidence Retrieved & Validated',
        detailedExplanation: `Discovered ${allCandidates.length} candidate sources, verified ${entityVerifiedCount} exact entity matches, selected ${selectedSources.length} sources across ${uniqueDomainsSelected} distinct domains (${rawExtractedKb} KB extracted over live HTTPS), and confirmed ${actuallyUsedCount} source(s) produced validated facts.`,
        remediationSteps: []
      }
    };
  }

  private static buildDiagnosticSummary(
    maxSourcesRequested: number,
    discoveredCount: number,
    code: ZeroSourceDiagnosticCode,
    entityResolution: EntityResolutionResult
  ): LedgerSummaryStats {
    const diagnosticMap: Record<
      ZeroSourceDiagnosticCode,
      { headline: string; detailedExplanation: string; remediationSteps: string[] }
    > = {
      NONE: {
        headline: 'VERIFIED',
        detailedExplanation: 'Normal execution.',
        remediationSteps: []
      },
      NO_ENTITY_RESOLVED: {
        headline: 'DIAGNOSTIC HALT: No Entity Resolved (UNRESOLVED)',
        detailedExplanation: `The target "${entityResolution.extractedTarget}" could not be matched to any registered legal entity across live queries to Screener.in, Wikidata Knowledge Graph, SEC EDGAR CIK Registry, Yahoo Finance Global Index, or direct corporate domain probes. Under the Non-Substitution Policy, Aegis refuses to substitute an unrelated company or fabricate financial figures.`,
        remediationSteps: [
          'Verify the exact legal corporate name, CIN, CIK, ISIN, or stock ticker.',
          'Ensure the entity is a legitimate registered corporation and not a fictional string.'
        ]
      },
      AMBIGUOUS_ENTITY_CLARIFICATION_REQUIRED: {
        headline: 'DIAGNOSTIC HALT: Ambiguous Entity — Clarification Required',
        detailedExplanation:
          entityResolution.ambiguityClarificationPrompt ||
          `The query "${entityResolution.extractedTarget}" maps to multiple distinct legal entities. Aegis halts rather than silently guessing one company.`,
        remediationSteps: [
          'Select the exact intended legal entity from the disambiguation candidates shown below.',
          'Re-run the pipeline with the specific legal name (e.g., "Tata Industries Limited", "Tata Motors Limited", or "Apple Inc.").'
        ]
      },
      NO_AUTHORITATIVE_SOURCE_DISCOVERED: {
        headline: 'DIAGNOSTIC HALT: Entity Resolved, But No Authoritative Source Discovered',
        detailedExplanation: `The entity was resolved, but zero Tier 1–4 authoritative sources met the minimum quality score threshold (≥45/100) with HTTP 200 retrieval.`,
        remediationSteps: [
          'Check national corporate registry filings directly (e.g., MCA AOC-4 or SEC EDGAR).'
        ]
      },
      SOURCES_REJECTED_ENTITY_MISMATCH: {
        headline: 'DIAGNOSTIC HALT: Sources Discovered But Rejected Due to Entity Mismatch',
        detailedExplanation: `Candidate web pages were discovered (${discoveredCount} candidates), but 100% were rejected by the EntityMatch guard because they referred to sibling/parent affiliates rather than the requested legal entity.`,
        remediationSteps: [
          'Include the entity registration identifier (CIN, CIK, or ISIN) in the query.'
        ]
      },
      NETWORK_RETRIEVAL_FAILED: {
        headline: 'DIAGNOSTIC HALT: Network Retrieval Failed',
        detailedExplanation: `Candidate URLs were identified (${discoveredCount} candidates), but live HTTP/TLS retrieval timed out or was blocked by upstream rate limits.`,
        remediationSteps: ['Retry the live retrieval request.']
      },
      RATE_LIMITED: {
        headline: 'DIAGNOSTIC HALT: Upstream API Rate Limited (HTTP 429)',
        detailedExplanation: `Live entity or source discovery encountered upstream HTTP 429 rate limiting after bounded retry attempts.`,
        remediationSteps: ['Wait briefly and retry the request.']
      },
      EXTRACTION_FAILED: {
        headline: 'EXPLAINABLE HALT: Zero Validated Financial/Technical Facts Extracted (INSUFFICIENT)',
        detailedExplanation: `Authoritative sources were reached (${discoveredCount} candidates), but DOM/PDF/API parsing yielded 0 validated facts passing strict provenance and period/currency alignment gates.`,
        remediationSteps: ['Retrieve the unencrypted statutory filing from the primary regulator repository.']
      }
    };

    const diag = diagnosticMap[code];

    return {
      requestedMaxSources: maxSourcesRequested,
      totalDiscoveredCandidates: discoveredCount,
      retrievedSourcesCount: 0,
      parsedSourcesCount: 0,
      entityVerifiedCount: 0,
      selectedSourcesCount: 0,
      actuallyUsedCount: 0,
      rejectedSourcesCount: discoveredCount,
      uniqueDomainsSelected: 0,
      rawExtractedKb: 0,
      overallDataQuality: 'INSUFFICIENT',
      zeroSourceDiagnostic: {
        code,
        headline: diag.headline,
        detailedExplanation: diag.detailedExplanation,
        remediationSteps: diag.remediationSteps
      }
    };
  }
}
