import { NextRequest, NextResponse } from "next/server";

function getSyncPercentage(
  startBlock: number,
  latestBlock: number,
  chainHeadBlock: number
): string {
  if (latestBlock === 0) return "N/A";
  const blocksProcessed = latestBlock - startBlock;
  const totalBlocks = chainHeadBlock - startBlock;
  if (totalBlocks <= 0) return "N/A";
  const synced = Math.floor((blocksProcessed / totalBlocks) * 100);
  return `${Math.min(synced, 100)}%`;
}

interface ProgressData {
  progress: any[];
}

interface ParsedProgress {
  indexerStatuses: any[];
  indexerSyncPercentages: string[];
}

function parseProgressData(
  progressData: ProgressData,
  startBlock: number
): ParsedProgress {
  const indexerStatuses: any[] = [];
  const indexerSyncPercentages: string[] = [];
  for (const indexerData of progressData.progress) {
    const userAddress = indexerData.user || "";
    const health = indexerData.health || "unknown";
    const synced = indexerData.synced || false;
    const userImage = indexerData.userImage || "";
    const userEns = indexerData.userEns || "";
    const chains = indexerData.chains || [];
    let status: any;
    if (chains.length > 0) {
      const chain = chains[0];
      const chainHeadBlock = parseInt(chain.chainHeadBlock.number);
      const latestBlock = parseInt(chain.latestBlock.number);
      const earliestBlock = parseInt(chain.earliestBlock.number);
      const network = chain.network || "";
      const syncPct = getSyncPercentage(
        startBlock,
        latestBlock,
        chainHeadBlock
      );
      const blocksBehind = chainHeadBlock - latestBlock;
      status = {
        indexer_url: userEns ? `https://${userEns}` : `https://${userAddress}`,
        indexer_id: userAddress,
        status: "success",
        synced,
        health,
        entity_count: "0",
        paused: false,
        node: userAddress,
        latest_block: latestBlock,
        chain_head_block: chainHeadBlock,
        earliest_block: earliestBlock,
        blocks_behind: blocksBehind,
        network,
        user_image: userImage,
        user_ens: userEns,
      };
      indexerSyncPercentages.push(syncPct);
    } else {
      status = {
        indexer_url: userEns ? `https://${userEns}` : `https://${userAddress}`,
        indexer_id: userAddress,
        status: "success",
        synced,
        health,
        entity_count: "0",
        paused: false,
        node: userAddress,
        user_image: userImage,
        user_ens: userEns,
      };
      indexerSyncPercentages.push("N/A");
    }
    indexerStatuses.push(status);
  }
  return { indexerStatuses, indexerSyncPercentages };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subgraphId = searchParams.get("subgraphId");
  const version = searchParams.get("version");
  const ipfsHash = searchParams.get("ipfsHash");
  const signalAmount = searchParams.get("signalAmount");
  const allocationsStr = searchParams.get("allocations");
  const startBlockParam = searchParams.get("startBlock");

  if (
    !subgraphId ||
    !version ||
    !ipfsHash ||
    !signalAmount ||
    !allocationsStr
  ) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }
  let allocations;
  try {
    allocations = JSON.parse(allocationsStr);
  } catch {
    return NextResponse.json({ error: "Invalid allocations" }, { status: 400 });
  }
  // Use provided startBlock or fetch manifest if not provided
  let startBlock = startBlockParam ? parseInt(startBlockParam) : 0;

  if (!startBlockParam) {
    try {
      const manifestRes = await Promise.race([
        fetch(`https://api.thegraph.com/ipfs/api/v0/cat?arg=${ipfsHash}`),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Manifest fetch timeout")), 2000)
        ),
      ]);

      if (manifestRes.ok) {
        const manifest = await manifestRes.text();
        const matches = [...manifest.matchAll(/startBlock:\s*(\d+)/g)];
        if (matches.length > 0) {
          startBlock = Math.min(...matches.map((m) => parseInt(m[1])));
        }
      }
    } catch (error) {
      // If manifest fetch fails, use default startBlock of 0
      console.warn(`Failed to fetch manifest for ${ipfsHash}:`, error);
    }
  }
  // Fetch progress and query volume concurrently with timeouts
  const controller1 = new AbortController();
  const controller2 = new AbortController();

  const timeout1 = setTimeout(() => controller1.abort(), 5000);
  const timeout2 = setTimeout(() => controller2.abort(), 5000);

  const [progressRes, queryVolumeRes] = await Promise.allSettled([
    fetch(`https://thegraph.com/explorer/api/subgraph/progress/${ipfsHash}`, {
      signal: controller1.signal,
    }).then((res) => res.json()),
    fetch(
      `https://thegraph.com/explorer/api/subgraph/query-volume/${ipfsHash}`,
      { signal: controller2.signal }
    ).then((res) => res.json()),
  ]);

  clearTimeout(timeout1);
  clearTimeout(timeout2);
  const progressData =
    progressRes.status === "fulfilled" ? progressRes.value : null;
  const queryVolumeData =
    queryVolumeRes.status === "fulfilled" ? queryVolumeRes.value : null;
  // Parse progress
  let indexerStatuses: any[] = [];
  let indexerSyncPercentages: string[] = [];
  if (progressData && progressData.progress) {
    const parsed = parseProgressData(progressData, startBlock);
    indexerStatuses = parsed.indexerStatuses;
    indexerSyncPercentages = parsed.indexerSyncPercentages;
  }
  // Parse query volume
  let queryVolume30d = 0;
  let queryVolumeDays = 0;
  if (
    queryVolumeData &&
    "count" in queryVolumeData &&
    "numDays" in queryVolumeData
  ) {
    queryVolume30d = parseFloat(queryVolumeData.count) || 0;
    queryVolumeDays = queryVolumeData.numDays || 0;
  }
  // Compute indexer_urls_str
  const indexerUrls = allocations.map((alloc: any) => {
    const url = alloc.indexer.url;
    if (url) {
      return url.replace(/\/$/, "");
    } else {
      return `https://${alloc.indexer.id}.eth`;
    }
  });
  const indexerUrlsStr =
    indexerUrls.length > 0 ? indexerUrls.join(", ") : "None";
  // Compute progress_indexers_str
  const progressIndexerIds = indexerStatuses
    .map((status) => status.indexer_id)
    .filter((id) => id);
  const progressIndexersStr =
    progressIndexerIds.length > 0 ? progressIndexerIds.join(", ") : "None";
  // Build row
  const row = {
    subgraph_id: subgraphId,
    version: parseInt(version),
    ipfs_hash: ipfsHash,
    signal_amount: signalAmount,
    active_indexers: progressIndexersStr,
    indexer_urls: indexerUrlsStr,
    indexer_sync_percentages:
      indexerSyncPercentages.length > 0
        ? indexerSyncPercentages.join(", ")
        : "None",
    indexer_count: indexerStatuses.length,
    query_volume_30d: queryVolume30d,
    query_volume_days: queryVolumeDays,
    indexers_responding: 0,
    indexers_synced: 0,
    indexers_healthy: 0,
    sync_percentage: "0%",
  };
  // Compute summary status
  if (indexerStatuses.length > 0) {
    const successfulStatuses = indexerStatuses.filter(
      (s) => s.status === "success"
    );
    let syncedCount = successfulStatuses.filter((s) => s.synced).length;
    const healthyCount = successfulStatuses.filter(
      (s) => s.health === "healthy"
    ).length;
    // Highest sync pct
    const numericPercentages = indexerSyncPercentages
      .filter((pct) => pct !== "N/A" && pct.endsWith("%"))
      .map((pct) => parseFloat(pct.slice(0, -1)));
    let highestSyncPct = "0%";
    if (numericPercentages.length > 0) {
      const maxPct = Math.max(...numericPercentages);
      highestSyncPct = `${maxPct}%`;
      syncedCount = numericPercentages.filter((val) => val >= 100).length;
    }
    row.indexers_responding = successfulStatuses.length;
    row.indexers_synced = syncedCount;
    row.indexers_healthy = healthyCount;
    row.sync_percentage = highestSyncPct;
  }
  return NextResponse.json(row);
}
