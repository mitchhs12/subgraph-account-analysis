"use client";

import { useState } from "react";
import { Search, BarChart3, AlertTriangle, RefreshCw } from "lucide-react";
import SubgraphTable from "@/components/SubgraphTable";
import SummaryCards from "@/components/SummaryCards";
import ChartsSection from "@/components/ChartsSection";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubgraphData, AnalysisResult } from "@/types/subgraph";

interface VersionData {
  subgraphId: string;
  version: number;
  ipfsHash: string;
  signalAmount: string;
  allocations: Array<{
    indexer: {
      id: string;
      url: string | null;
    };
  }>;
}

export default function Home() {
  const [walletAddress, setWalletAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [cache] = useState<Map<string, AnalysisResult>>(new Map());
  const [filterBySignal, setFilterBySignal] = useState(true);
  const [filterByQueries, setFilterByQueries] = useState(false);

  // Helper function to count unique indexers
  const getUniqueIndexers = (subgraphs: SubgraphData[]): number => {
    const uniqueIndexers = new Set<string>();
    subgraphs.forEach((subgraph) => {
      if (subgraph.active_indexers && subgraph.active_indexers !== "None") {
        const indexers = subgraph.active_indexers
          .split(", ")
          .filter((id) => id.trim() !== "");
        indexers.forEach((id) => uniqueIndexers.add(id.trim()));
      }
    });
    return uniqueIndexers.size;
  };

  // Helper function to calculate sync rate (subgraph versions with at least 1 indexer at 100%)
  const getSyncRate = (subgraphs: SubgraphData[]): number => {
    const versionsWithFullySyncedIndexer = subgraphs.filter((subgraph) => {
      if (
        !subgraph.indexer_sync_percentages ||
        subgraph.indexer_sync_percentages === "None"
      ) {
        return false;
      }
      const percentages = subgraph.indexer_sync_percentages
        .split(", ")
        .map((pct) => pct.trim())
        .filter((pct) => pct !== "N/A" && pct.endsWith("%"));

      return percentages.some((pct) => {
        const numericValue = parseFloat(pct.replace("%", ""));
        return numericValue >= 100;
      });
    });

    return subgraphs.length > 0
      ? (versionsWithFullySyncedIndexer.length / subgraphs.length) * 100
      : 0;
  };

  const handleAnalyze = async () => {
    if (!walletAddress.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    const trimmedAddress = walletAddress.trim();

    // Check cache first
    if (cache.has(trimmedAddress)) {
      setAnalysisResult(cache.get(trimmedAddress)!);
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    try {
      const subgraphsRes = await fetch(
        `/api/subgraphs?account=${encodeURIComponent(walletAddress.trim())}`
      );
      if (!subgraphsRes.ok) {
        const err = await subgraphsRes.json();
        throw new Error(err.error || "Failed to fetch subgraphs");
      }
      const { versions } = await subgraphsRes.json();

      // Pre-fetch all manifests concurrently to get start blocks
      console.log(`Pre-fetching manifests for ${versions.length} versions...`);
      const manifestPromises = versions.map(async (v: VersionData) => {
        try {
          const manifestRes = await Promise.race([
            fetch(`https://api.thegraph.com/ipfs/api/v0/cat?arg=${v.ipfsHash}`),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Manifest timeout")), 2000)
            ),
          ]);

          if (manifestRes.ok) {
            const manifest = await manifestRes.text();
            const matches = [...manifest.matchAll(/startBlock:\s*(\d+)/g)];
            if (matches.length > 0) {
              return Math.min(...matches.map((m) => parseInt(m[1])));
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch manifest for ${v.ipfsHash}:`, error);
        }
        return 0; // Default start block
      });

      const startBlocks = await Promise.all(manifestPromises);
      console.log(`Manifests fetched, starting analysis...`);

      // Process all versions concurrently with pre-fetched start blocks
      const subgraphPromises = versions.map(
        (
          v: {
            subgraphId: string;
            version: number;
            ipfsHash: string;
            signalAmount: string;
            allocations: Array<{
              indexer: {
                id: string;
                url: string | null;
              };
            }>;
          },
          index: number
        ) =>
          fetch(
            `/api/analyze-version?subgraphId=${encodeURIComponent(
              v.subgraphId
            )}&version=${v.version}&ipfsHash=${encodeURIComponent(
              v.ipfsHash
            )}&signalAmount=${encodeURIComponent(
              v.signalAmount
            )}&allocations=${encodeURIComponent(
              JSON.stringify(v.allocations)
            )}&startBlock=${startBlocks[index]}`
          ).then((res) => {
            if (!res.ok)
              throw new Error(`Failed to analyze version ${v.ipfsHash}`);
            return res.json();
          })
      );
      const subgraphs = await Promise.all(subgraphPromises);
      // Compute summary
      const summary = {
        total_subgraphs: new Set(subgraphs.map((s) => s.subgraph_id)).size,
        total_versions: subgraphs.length,
        total_query_volume: subgraphs.reduce(
          (sum, s) => sum + s.query_volume_30d,
          0
        ),
        subgraphs_with_queries: subgraphs.filter((s) => s.query_volume_30d > 0)
          .length,
        total_indexers: getUniqueIndexers(subgraphs),
        total_indexer_instances: subgraphs.reduce(
          (sum, s) => sum + s.indexer_count,
          0
        ),
        responding_indexers: subgraphs.reduce(
          (sum, s) => sum + s.indexers_responding,
          0
        ),
        synced_indexers: subgraphs.reduce(
          (sum, s) => sum + s.indexers_synced,
          0
        ),
        healthy_indexers: subgraphs.reduce(
          (sum, s) => sum + s.indexers_healthy,
          0
        ),
        sync_rate: getSyncRate(subgraphs),
      };
      // Top by signal
      const topBySignal = subgraphs
        .filter((s) => s.signal_amount !== "0")
        .sort(
          (a, b) => parseFloat(b.signal_amount) - parseFloat(a.signal_amount)
        )
        .slice(0, 5);
      // Top by queries
      const topByQueries = subgraphs
        .filter((s) => s.query_volume_30d > 0)
        .sort((a, b) => b.query_volume_30d - a.query_volume_30d)
        .slice(0, 5);
      // Problematic subgraphs
      const issues = subgraphs.filter(
        (s) =>
          s.indexer_count > 0 &&
          s.sync_percentage !== "0%" &&
          s.sync_percentage !== "N/A" &&
          parseFloat(s.sync_percentage.replace("%", "")) < 100
      );
      // Find latest versions
      const latestVersions: { [key: string]: SubgraphData } = {};
      subgraphs.forEach((s) => {
        if (
          !latestVersions[s.subgraph_id] ||
          s.version > latestVersions[s.subgraph_id].version
        ) {
          latestVersions[s.subgraph_id] = s;
        }
      });
      const problematicSubgraphs = issues.map((s) => ({
        ...s,
        is_latest: latestVersions[s.subgraph_id]?.ipfs_hash === s.ipfs_hash,
        signal_amount_formatted:
          s.signal_amount !== "0"
            ? (parseFloat(s.signal_amount) / 1e18).toFixed(2)
            : "0",
      }));
      const result = {
        subgraphs,
        summary,
        top_by_signal: topBySignal,
        top_by_queries: topByQueries,
        problematic_subgraphs: problematicSubgraphs,
      };
      setAnalysisResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };
  const handleRefresh = async () => {
    if (!walletAddress.trim()) {
      setError("Please enter a wallet address first");
      return;
    }
    setIsLoading(true);
    setError(null);
    // Reuse the same logic as handleAnalyze but without clearing analysisResult
    try {
      const subgraphsRes = await fetch(
        `/api/subgraphs?account=${encodeURIComponent(walletAddress.trim())}`
      );
      if (!subgraphsRes.ok) {
        const err = await subgraphsRes.json();
        throw new Error(err.error || "Failed to fetch subgraphs");
      }
      const { versions } = await subgraphsRes.json();

      // Pre-fetch all manifests concurrently to get start blocks
      console.log(`Pre-fetching manifests for ${versions.length} versions...`);
      const manifestPromises = versions.map(async (v: VersionData) => {
        try {
          const manifestRes = await Promise.race([
            fetch(`https://api.thegraph.com/ipfs/api/v0/cat?arg=${v.ipfsHash}`),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Manifest timeout")), 2000)
            ),
          ]);

          if (manifestRes.ok) {
            const manifest = await manifestRes.text();
            const matches = [...manifest.matchAll(/startBlock:\s*(\d+)/g)];
            if (matches.length > 0) {
              return Math.min(...matches.map((m) => parseInt(m[1])));
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch manifest for ${v.ipfsHash}:`, error);
        }
        return 0; // Default start block
      });

      const startBlocks = await Promise.all(manifestPromises);
      console.log(`Manifests fetched, starting analysis...`);

      // Process all versions concurrently with pre-fetched start blocks
      const subgraphPromises = versions.map(
        (
          v: {
            subgraphId: string;
            version: number;
            ipfsHash: string;
            signalAmount: string;
            allocations: Array<{
              indexer: {
                id: string;
                url: string | null;
              };
            }>;
          },
          index: number
        ) =>
          fetch(
            `/api/analyze-version?subgraphId=${encodeURIComponent(
              v.subgraphId
            )}&version=${v.version}&ipfsHash=${encodeURIComponent(
              v.ipfsHash
            )}&signalAmount=${encodeURIComponent(
              v.signalAmount
            )}&allocations=${encodeURIComponent(
              JSON.stringify(v.allocations)
            )}&startBlock=${startBlocks[index]}`
          ).then((res) => {
            if (!res.ok)
              throw new Error(`Failed to analyze version ${v.ipfsHash}`);
            return res.json();
          })
      );
      const subgraphs = await Promise.all(subgraphPromises);
      const summary = {
        total_subgraphs: new Set(subgraphs.map((s) => s.subgraph_id)).size,
        total_versions: subgraphs.length,
        total_query_volume: subgraphs.reduce(
          (sum, s) => sum + s.query_volume_30d,
          0
        ),
        subgraphs_with_queries: subgraphs.filter((s) => s.query_volume_30d > 0)
          .length,
        total_indexers: getUniqueIndexers(subgraphs),
        total_indexer_instances: subgraphs.reduce(
          (sum, s) => sum + s.indexer_count,
          0
        ),
        responding_indexers: subgraphs.reduce(
          (sum, s) => sum + s.indexers_responding,
          0
        ),
        synced_indexers: subgraphs.reduce(
          (sum, s) => sum + s.indexers_synced,
          0
        ),
        healthy_indexers: subgraphs.reduce(
          (sum, s) => sum + s.indexers_healthy,
          0
        ),
        sync_rate: getSyncRate(subgraphs),
      };
      const topBySignal = subgraphs
        .filter((s) => s.signal_amount !== "0")
        .sort(
          (a, b) => parseFloat(b.signal_amount) - parseFloat(a.signal_amount)
        )
        .slice(0, 5);
      const topByQueries = subgraphs
        .filter((s) => s.query_volume_30d > 0)
        .sort((a, b) => b.query_volume_30d - a.query_volume_30d)
        .slice(0, 5);
      const issues = subgraphs.filter(
        (s) =>
          s.indexer_count > 0 &&
          s.sync_percentage !== "0%" &&
          s.sync_percentage !== "N/A" &&
          parseFloat(s.sync_percentage.replace("%", "")) < 100
      );
      const latestVersions: { [key: string]: SubgraphData } = {};
      subgraphs.forEach((s) => {
        if (
          !latestVersions[s.subgraph_id] ||
          s.version > latestVersions[s.subgraph_id].version
        ) {
          latestVersions[s.subgraph_id] = s;
        }
      });
      const problematicSubgraphs = issues.map((s) => ({
        ...s,
        is_latest: latestVersions[s.subgraph_id]?.ipfs_hash === s.ipfs_hash,
        signal_amount_formatted:
          s.signal_amount !== "0"
            ? (parseFloat(s.signal_amount) / 1e18).toFixed(2)
            : "0",
      }));
      const result = {
        subgraphs,
        summary,
        top_by_signal: topBySignal,
        top_by_queries: topByQueries,
        problematic_subgraphs: problematicSubgraphs,
      };
      setAnalysisResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Graph Network Subgraph Analysis
              </h1>
              <p className="mt-2 text-muted-foreground">
                Analyze subgraph performance, indexer status, and query volume
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Input Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Analyze Subgraphs</CardTitle>
            <CardDescription>
              Enter a wallet address to analyze its subgraph deployments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Input Section with Example Button */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label
                    htmlFor="wallet-address"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Wallet Address
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      id="wallet-address"
                      type="text"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      placeholder="0xa4c6a8392f046332628f33fd9891a7006b05cc95"
                      className="w-full pl-10 pr-4 py-3 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-auto items-center justify-center sm:justify-end sm:items-end">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setWalletAddress(
                        "0xa4c6a8392f046332628f33fd9891a7006b05cc95"
                      )
                    }
                    className="h-12 px-4 text-sm cursor-pointer w-full sm:w-auto"
                  >
                    Use Example Wallet
                  </Button>
                  <Button
                    onClick={handleAnalyze}
                    disabled={isLoading}
                    className="h-12 px-6 cursor-pointer w-full sm:w-auto"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Analyzing...
                      </>
                    ) : (
                      "Analyze Subgraphs"
                    )}
                  </Button>
                </div>
              </div>
            </div>
            {error && (
              <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center">
                <AlertTriangle className="h-5 w-5 text-destructive mr-2" />
                <span className="text-destructive">{error}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        {analysisResult && (
          <div className="space-y-8">
            {/* Summary Cards */}
            <SummaryCards data={analysisResult} />

            {/* Charts Section */}
            <ChartsSection
              data={analysisResult}
              filterBySignal={filterBySignal}
              filterByQueries={filterByQueries}
              onFilterBySignalChange={setFilterBySignal}
              onFilterByQueriesChange={setFilterByQueries}
            />

            {/* Subgraph Table */}
            <div className="bg-card rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      Subgraph Details
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      Detailed information about each subgraph and version
                    </p>
                  </div>
                  <Button
                    onClick={handleRefresh}
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <SubgraphTable
                data={analysisResult.subgraphs}
                filterBySignal={filterBySignal}
                filterByQueries={filterByQueries}
              />
            </div>
          </div>
        )}

        {/* Empty State */}
        {!analysisResult && !isLoading && (
          <Card className="text-center py-12">
            <CardContent>
              <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium text-foreground">
                No Analysis Yet
              </h3>
              <p className="mt-2 text-muted-foreground">
                Enter a wallet address above to analyze subgraph performance
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
