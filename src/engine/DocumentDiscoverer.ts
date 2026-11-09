import {
  DeepWebCrawlNode,
  DiscoveredDocument
} from './types';
import { LiveEvidenceBundle } from './LiveEvidenceCollector';

export class DocumentDiscoverer {
  /**
   * Returns the actual live crawl tree recorded by LiveEvidenceCollector.
   */
  public static getLiveCrawlTree(bundle: LiveEvidenceBundle): DeepWebCrawlNode[] {
    return bundle.crawlTree;
  }

  /**
   * Returns the actual live documents retrieved and verified during the pipeline run.
   */
  public static getLiveDocuments(bundle: LiveEvidenceBundle): DiscoveredDocument[] {
    return bundle.discoveredDocuments;
  }
}
