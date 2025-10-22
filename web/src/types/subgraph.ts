export interface SubgraphData {
  subgraph_id: string;
  version: number;
  ipfs_hash: string;
  signal_amount: string;
  active_indexers: string;
  indexer_urls: string;
  indexer_sync_percentages: string;
  indexer_count: number;
  query_volume_30d: number;
  query_volume_days: number;
  indexers_responding: number;
  indexers_synced: number;
  indexers_healthy: number;
  sync_percentage: string;
}

export interface AnalysisResult {
  subgraphs: SubgraphData[];
  summary: {
    total_subgraphs: number;
    total_versions: number;
    total_query_volume: number;
    subgraphs_with_queries: number;
    total_indexers: number;
    responding_indexers: number;
    synced_indexers: number;
    healthy_indexers: number;
  };
  top_by_signal: SubgraphData[];
  top_by_queries: SubgraphData[];
  problematic_subgraphs: SubgraphData[];
}

export interface IndexerStatus {
  indexer_url: string;
  indexer_id: string;
  status: string;
  synced: boolean;
  health: string;
  entity_count: string;
  paused: boolean;
  node: string;
  latest_block: number;
  chain_head_block: number;
  earliest_block: number;
  blocks_behind: number;
  network: string;
  user_image?: string;
  user_ens?: string;
}
