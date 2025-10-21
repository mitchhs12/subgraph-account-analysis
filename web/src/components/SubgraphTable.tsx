"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SubgraphData } from "@/types/subgraph";

interface SubgraphTableProps {
  data: SubgraphData[];
}

export default function SubgraphTable({ data }: SubgraphTableProps) {
  const [sortField, setSortField] =
    useState<keyof SubgraphData>("signal_amount");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());

  const handleSort = (field: keyof SubgraphData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    // Handle numeric sorting
    if (typeof aVal === "string" && typeof bVal === "string") {
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        aVal = aNum;
        bVal = bNum;
      }
    }

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const toggleExpanded = (
    subgraphId: string,
    ipfsHash: string,
    index: number
  ) => {
    const uniqueKey = `${subgraphId}-${ipfsHash}-${index}`;
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(uniqueKey)) {
      newExpanded.delete(uniqueKey);
    } else {
      newExpanded.add(uniqueKey);
    }
    setExpandedRows(newExpanded);
  };

  const getSyncStatusIcon = (syncPercentage: string) => {
    const percentage = parseFloat(syncPercentage.replace("%", ""));
    if (percentage >= 100) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (percentage >= 80) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    } else {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const formatSignalAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (num === 0) return "0";
    return (num / 10 ** 18).toFixed(2);
  };

  const formatId = (id: string) => {
    if (id.length <= 12) return id;
    return `${id.substring(0, 6)}—${id.substring(id.length - 6)}`;
  };

  const copyToClipboard = async (text: string, itemKey: string) => {
    try {
      await navigator.clipboard.writeText(text);

      // Add to copied items and remove after 2 seconds
      setCopiedItems((prev) => new Set(prev).add(itemKey));
      setTimeout(() => {
        setCopiedItems((prev) => {
          const newSet = new Set(prev);
          newSet.delete(itemKey);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: keyof SubgraphData;
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 text-left font-medium text-foreground hover:text-foreground/80 cursor-pointer"
    >
      <span>{children}</span>
      {sortField === field &&
        (sortDirection === "asc" ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        ))}
    </button>
  );

  return (
    <div className="overflow-x-auto w-full">
      <table
        className="w-full divide-y divide-border bg-transparent"
        style={{ width: "100%", tableLayout: "auto" }}
      >
        <thead className="bg-muted/10">
          <tr>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              style={{ width: "12%" }}
            >
              <SortButton field="subgraph_id">Subgraph ID</SortButton>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              style={{ width: "12%" }}
            >
              IPFS Hash
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              style={{ width: "10%" }}
            >
              <SortButton field="signal_amount">Signal</SortButton>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              style={{ width: "12%" }}
            >
              <SortButton field="query_volume_30d">
                Query Volume (30d)
              </SortButton>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              style={{ width: "12%" }}
            >
              <SortButton field="indexer_count">Indexers</SortButton>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              style={{ width: "8%" }}
            >
              <SortButton field="indexers_synced">Synced</SortButton>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              style={{ width: "8%" }}
            >
              <SortButton field="indexers_healthy">Healthy</SortButton>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              style={{ width: "8%" }}
            >
              <SortButton field="sync_percentage">Sync %</SortButton>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              style={{ width: "14%" }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sortedData.map((subgraph, index) => {
            // Create a unique key combining subgraph_id, ipfs_hash, and index
            const uniqueKey = `${subgraph.subgraph_id}-${subgraph.ipfs_hash}-${index}`;
            const isExpanded = expandedRows.has(uniqueKey);
            const syncPercentage = parseFloat(
              subgraph.sync_percentage.replace("%", "")
            );
            const isProblematic = syncPercentage < 100 && syncPercentage > 0;

            return [
              <tr
                key={uniqueKey}
                className={`hover:bg-muted/20 transition-colors ${
                  isProblematic ? "bg-destructive/5" : ""
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono">
                      {formatId(subgraph.subgraph_id)}
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          subgraph.subgraph_id,
                          `subgraph-${uniqueKey}`
                        )
                      }
                      className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      title="Copy full subgraph ID"
                    >
                      {copiedItems.has(`subgraph-${uniqueKey}`) ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground font-mono">
                  <div className="flex items-center space-x-2">
                    <span>{formatId(subgraph.ipfs_hash)}</span>
                    <button
                      onClick={() =>
                        copyToClipboard(subgraph.ipfs_hash, `ipfs-${uniqueKey}`)
                      }
                      className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      title="Copy full IPFS hash"
                    >
                      {copiedItems.has(`ipfs-${uniqueKey}`) ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {formatSignalAmount(subgraph.signal_amount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {subgraph.query_volume_30d.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  <span className="text-blue-600 font-medium">
                    {subgraph.indexer_count}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  <span className="text-green-600 font-medium">
                    {subgraph.indexers_synced}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  <span className="text-green-600 font-medium">
                    {subgraph.indexers_healthy}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  <div className="flex items-center space-x-2">
                    {getSyncStatusIcon(subgraph.sync_percentage)}
                    <Badge
                      variant={
                        syncPercentage >= 100
                          ? "default"
                          : syncPercentage >= 80
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {subgraph.sync_percentage}
                    </Badge>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() =>
                        toggleExpanded(
                          subgraph.subgraph_id,
                          subgraph.ipfs_hash,
                          index
                        )
                      }
                      className="text-primary hover:text-primary/80 cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    <a
                      href={`https://thegraph.com/explorer/subgraphs/${subgraph.subgraph_id}?v=${subgraph.version}&view=Query&chain=arbitrum-one`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 cursor-pointer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </td>
              </tr>,
              /* Expanded row content */
              isExpanded && (
                <tr key={`${uniqueKey}-expanded`} className="bg-muted/5">
                  <td colSpan={9}>
                    <div className="bg-muted/5 rounded-lg py-6 px-6 w-full">
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        <h4 className="font-semibold text-sm text-foreground">
                          Indexer Details
                        </h4>
                      </div>
                      <div className="space-y-3 px-4">
                        {subgraph.active_indexers &&
                        subgraph.indexer_sync_percentages ? (
                          (() => {
                            const indexers =
                              subgraph.active_indexers.split(", ");
                            const syncPercentages =
                              subgraph.indexer_sync_percentages.split(", ");
                            const indexerUrls =
                              subgraph.indexer_urls.split(", ");
                            const totalIndexers = indexers.length;

                            // Create array of indexer objects with their properties
                            const indexerData = indexers.map((indexer, idx) => {
                              const syncPercentage =
                                syncPercentages[idx] || "0%";
                              const syncValue = parseFloat(
                                syncPercentage.replace("%", "")
                              );
                              const isFullySynced = syncValue >= 100;
                              const isHealthy =
                                idx < (subgraph.indexers_healthy || 0);

                              return {
                                indexer,
                                indexerUrl: indexerUrls[idx] || "",
                                idx,
                                syncPercentage,
                                syncValue,
                                isFullySynced,
                                isHealthy,
                              };
                            });

                            // Sort indexers by priority
                            const sortedIndexers = indexerData.sort((a, b) => {
                              // Priority 1: 100% synced and healthy
                              const aPriority1 = a.isFullySynced && a.isHealthy;
                              const bPriority1 = b.isFullySynced && b.isHealthy;
                              if (aPriority1 !== bPriority1)
                                return bPriority1 ? 1 : -1;

                              // Priority 2: Healthy but not 100% synced
                              const aPriority2 =
                                a.isHealthy && !a.isFullySynced;
                              const bPriority2 =
                                b.isHealthy && !b.isFullySynced;
                              if (aPriority2 !== bPriority2)
                                return bPriority2 ? 1 : -1;

                              // Priority 3: Not healthy but fully synced
                              const aPriority3 =
                                !a.isHealthy && a.isFullySynced;
                              const bPriority3 =
                                !b.isHealthy && b.isFullySynced;
                              if (aPriority3 !== bPriority3)
                                return bPriority3 ? 1 : -1;

                              // Priority 4: Not healthy and not fully synced
                              const aPriority4 =
                                !a.isHealthy && !a.isFullySynced;
                              const bPriority4 =
                                !b.isHealthy && !b.isFullySynced;
                              if (aPriority4 !== bPriority4)
                                return bPriority4 ? 1 : -1;

                              // Within same priority, prioritize indexers with actual sync percentages over N/A
                              const aHasSyncPercentage =
                                a.syncPercentage !== "N/A";
                              const bHasSyncPercentage =
                                b.syncPercentage !== "N/A";
                              if (aHasSyncPercentage !== bHasSyncPercentage)
                                return bHasSyncPercentage ? 1 : -1;

                              // If both have sync percentages or both are N/A, sort by sync percentage (highest first)
                              return b.syncValue - a.syncValue;
                            });

                            return sortedIndexers.map(
                              ({
                                indexer,
                                indexerUrl,
                                idx,
                                syncPercentage,
                                syncValue,
                                isFullySynced,
                                isHealthy,
                              }) => (
                                <div
                                  key={idx}
                                  className="bg-background border border-border/30 rounded-lg py-4 px-6 shadow-sm hover:shadow-md transition-shadow"
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center space-x-3">
                                      <div className="flex items-center space-x-2">
                                        <span className="font-mono text-sm text-foreground font-semibold">
                                          {indexer.length > 12
                                            ? `${indexer.substring(
                                                0,
                                                6
                                              )}—${indexer.substring(
                                                indexer.length - 6
                                              )}`
                                            : indexer}
                                        </span>
                                        <button
                                          onClick={() =>
                                            copyToClipboard(
                                              indexer,
                                              `indexer-${uniqueKey}-${idx}`
                                            )
                                          }
                                          className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1 rounded hover:bg-muted/50"
                                          title="Copy full indexer address"
                                        >
                                          {copiedItems.has(
                                            `indexer-${uniqueKey}-${idx}`
                                          ) ? (
                                            <Check className="h-3 w-3 text-green-500" />
                                          ) : (
                                            <Copy className="h-3 w-3" />
                                          )}
                                        </button>
                                        <a
                                          href={`https://thegraph.com/explorer/profile/${indexer}?view=Overview&chain=arbitrum-one`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1 rounded hover:bg-muted/50"
                                          title="View indexer page"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      </div>
                                    </div>
                                    {indexerUrl && indexerUrl !== "None" && (
                                      <div className="mt-2">
                                        <span className="text-xs text-muted-foreground font-mono">
                                          {indexerUrl}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex items-center space-x-2 flex-wrap gap-1">
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                                          isHealthy
                                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                                            : "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400"
                                        }`}
                                      >
                                        {isHealthy ? "Healthy" : "Unhealthy"}
                                      </span>
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                                          isFullySynced
                                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                                        }`}
                                      >
                                        {isFullySynced
                                          ? "Fully Synced"
                                          : "Partially Synced"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-sm bg-muted/30 rounded-md px-3 py-2">
                                    <span className="text-muted-foreground font-medium">
                                      Sync Status:
                                    </span>
                                    <div className="flex items-center space-x-2">
                                      <div
                                        className={`w-2 h-2 rounded-full ${
                                          isFullySynced
                                            ? "bg-emerald-500"
                                            : "bg-yellow-500"
                                        }`}
                                      ></div>
                                      <span
                                        className={`font-semibold ${
                                          isFullySynced
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-yellow-600 dark:text-yellow-400"
                                        }`}
                                      >
                                        {syncPercentage}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )
                            );
                          })()
                        ) : (
                          <div className="text-center py-8">
                            <div className="w-12 h-12 mx-auto mb-3 bg-muted/30 rounded-full flex items-center justify-center">
                              <div className="w-6 h-6 border-2 border-muted-foreground/30 rounded-full"></div>
                            </div>
                            <p className="text-sm text-muted-foreground font-medium">
                              No indexer data available
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ),
            ].filter(Boolean);
          })}
        </tbody>
      </table>
    </div>
  );
}
