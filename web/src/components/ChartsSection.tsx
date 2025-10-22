"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubgraphData } from "@/types/subgraph";
import { Info } from "lucide-react";
import { useState, useEffect } from "react";

interface ChartsSectionProps {
  data: {
    subgraphs: SubgraphData[];
    summary: {
      total_subgraphs: number;
      total_versions: number;
      total_query_volume: number;
      subgraphs_with_queries: number;
      total_indexers: number;
      total_indexer_instances: number;
      responding_indexers: number;
      synced_indexers: number;
      healthy_indexers: number;
      sync_rate: number;
    };
  };
  filterBySignal: boolean;
  filterByQueries: boolean;
  onFilterBySignalChange: (value: boolean) => void;
  onFilterByQueriesChange: (value: boolean) => void;
}

export default function ChartsSection({
  data,
  filterBySignal,
  filterByQueries,
  onFilterBySignalChange,
  onFilterByQueriesChange,
}: ChartsSectionProps) {
  const { subgraphs, summary } = data;
  const [themeKey, setThemeKey] = useState(0);

  // Listen for theme changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          setThemeKey((prev) => prev + 1);
          // Force update chart text colors after theme change (Chromium fix)
          setTimeout(() => {
            forceUpdateChartTextColors();
          }, 100);
        }
      });
    });

    if (typeof window !== "undefined") {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    return () => observer.disconnect();
  }, []);

  // Force update chart text colors - Nuclear option for Chromium
  const forceUpdateChartTextColors = () => {
    if (typeof window === "undefined") return;

    const isDark = document.documentElement.classList.contains("dark");
    const textColor = isDark ? "#ffffff" : "#000000";

    // Target ALL possible text elements in charts with multiple selectors
    const selectors = [
      ".recharts-wrapper text",
      ".recharts-wrapper svg text",
      ".recharts-cartesian-axis-tick-value",
      ".recharts-text",
      "svg text",
      "[class*='recharts'] text",
    ];

    selectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        const textEl = el as SVGTextElement;
        textEl.style.fill = textColor + " !important";
        textEl.style.color = textColor + " !important";
        textEl.setAttribute("fill", textColor);
        textEl.setAttribute("color", textColor);
        // Force style attribute
        textEl.style.setProperty("fill", textColor, "important");
        textEl.style.setProperty("color", textColor, "important");
      });
    });
  };

  // Continuous monitoring for Chromium
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const startMonitoring = () => {
      // Initial fix
      setTimeout(() => forceUpdateChartTextColors(), 100);
      setTimeout(() => forceUpdateChartTextColors(), 500);
      setTimeout(() => forceUpdateChartTextColors(), 1000);

      // Continuous monitoring every 2 seconds
      intervalId = setInterval(() => {
        forceUpdateChartTextColors();
      }, 2000);
    };

    startMonitoring();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [themeKey]);

  // Helper function to get filtered subgraphs based on checkboxes
  const getFilteredSubgraphs = (subgraphs: SubgraphData[]): SubgraphData[] => {
    return subgraphs.filter((subgraph) => {
      const hasSignal =
        subgraph.signal_amount && subgraph.signal_amount !== "0";
      const hasQueries = subgraph.query_volume_30d > 0;

      if (filterBySignal && filterByQueries) {
        return hasSignal && hasQueries;
      } else if (filterBySignal) {
        return hasSignal;
      } else if (filterByQueries) {
        return hasQueries;
      } else {
        return true; // No filters applied
      }
    });
  };

  // Helper function to calculate sync rate for filtered subgraphs
  const getSyncRate = (subgraphs: SubgraphData[]): number => {
    const filteredSubgraphs = getFilteredSubgraphs(subgraphs);

    if (filteredSubgraphs.length === 0) return 0;

    const versionsWithFullySyncedIndexer = filteredSubgraphs.filter(
      (subgraph) => {
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
      }
    );

    return (
      (versionsWithFullySyncedIndexer.length / filteredSubgraphs.length) * 100
    );
  };

  // Helper function to calculate health rate for filtered subgraphs
  const getHealthRate = (subgraphs: SubgraphData[]): number => {
    const filteredSubgraphs = getFilteredSubgraphs(subgraphs);

    if (filteredSubgraphs.length === 0) return 0;

    const versionsWithHealthy = filteredSubgraphs.filter((subgraph) => {
      return subgraph.indexers_healthy > 0;
    });

    return (versionsWithHealthy.length / filteredSubgraphs.length) * 100;
  };

  // Helper function to count active subgraphs for filtered subgraphs
  const getActiveSubgraphs = (subgraphs: SubgraphData[]): number => {
    return getFilteredSubgraphs(subgraphs).length;
  };

  // Helper function to get total query volume for filtered subgraphs
  const getTotalQueryVolume = (subgraphs: SubgraphData[]): number => {
    return getFilteredSubgraphs(subgraphs).reduce((sum, subgraph) => {
      return sum + subgraph.query_volume_30d;
    }, 0);
  };

  // Use CSS variables for chart text colors - more reliable than JS theme detection
  const textColor = "hsl(var(--chart-text))";
  const mutedTextColor = "hsl(var(--chart-text-muted))";

  // For inline styles in Recharts, we need to get the computed CSS values
  const getComputedTextColor = () => {
    if (typeof window !== "undefined") {
      const root = document.documentElement;
      const isDark = root.classList.contains("dark");
      return isDark ? "#ffffff" : "#000000";
    }
    return "#000000"; // fallback
  };

  // Define color schemes for different themes
  const colors = {
    primary: [
      "#4A5568", // Muted blue-gray
      "#6B46C1", // Muted purple
      "#059669", // Muted green
      "#D97706", // Muted amber
      "#DC2626", // Muted red
      "#BE185D", // Muted pink
      "#047857", // Muted emerald
      "#6B7280", // Muted gray
    ],
    sync: {
      "Fully Synced": "#059669", // Muted green
      "Mostly Synced": "#D97706", // Muted amber
      "Partially Synced": "#DC2626", // Muted red
      "Not Synced": "#6B7280", // Muted gray
      Unknown: "#4B5563", // Darker gray
    },
    health: {
      Healthy: "#059669", // Muted green
      Unhealthy: "#DC2626", // Muted red
      "Not Responding": "#6B7280", // Muted gray
    },
  };

  // Format large numbers with K, M, B suffixes
  const formatNumber = (value: number) => {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)}B`;
    } else if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    } else {
      return value.toString();
    }
  };

  // Prepare data for charts
  const syncStatusData = subgraphs.reduce((acc, subgraph) => {
    const syncPercentage = parseFloat(
      subgraph.sync_percentage.replace("%", "")
    );
    let status = "Unknown";

    if (syncPercentage >= 100) {
      status = "Fully Synced";
    } else if (syncPercentage >= 80) {
      status = "Mostly Synced";
    } else if (syncPercentage > 0) {
      status = "Partially Synced";
    } else {
      status = "Not Synced";
    }

    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const syncChartData = Object.entries(syncStatusData).map(
    ([status, count]) => ({
      status,
      count,
      color:
        colors.sync[status as keyof typeof colors.sync] || colors.sync.Unknown,
    })
  );

  const queryVolumeData = subgraphs
    .filter((s) => s.query_volume_30d > 0)
    .sort((a, b) => b.query_volume_30d - a.query_volume_30d)
    .slice(0, 10)
    .map((subgraph, index) => ({
      name:
        subgraph.ipfs_hash.length <= 12
          ? subgraph.ipfs_hash
          : `${subgraph.ipfs_hash.substring(
              0,
              6
            )}—${subgraph.ipfs_hash.substring(subgraph.ipfs_hash.length - 6)}`,
      queries: subgraph.query_volume_30d,
      signal: parseFloat(subgraph.signal_amount) / 10 ** 18,
      color: colors.primary[index % colors.primary.length],
    }));

  const indexerHealthData = [
    {
      name: "Healthy",
      value: summary.healthy_indexers,
      color: colors.health.Healthy,
    },
    {
      name: "Unhealthy",
      value: summary.responding_indexers - summary.healthy_indexers,
      color: colors.health.Unhealthy,
    },
    {
      name: "Not Responding",
      value: summary.total_indexer_instances - summary.responding_indexers,
      color: colors.health["Not Responding"],
    },
  ];

  return (
    <>
      {/* Chromium-specific style injection */}
      <style
        key={`chart-styles-${themeKey}`}
        dangerouslySetInnerHTML={{
          __html: `
          .recharts-wrapper text,
          .recharts-wrapper svg text,
          .recharts-cartesian-axis-tick-value,
          .recharts-text,
          svg text,
          [class*='recharts'] text {
            fill: ${getComputedTextColor()} !important;
            color: ${getComputedTextColor()} !important;
          }
        `,
        }}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sync Status Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Sync Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart key={`sync-${themeKey}`} data={syncChartData}>
                <CartesianGrid stroke={mutedTextColor} opacity={0.3} />
                <XAxis
                  dataKey="status"
                  stroke={getComputedTextColor()}
                  tick={{ fill: getComputedTextColor(), fontSize: 12 }}
                />
                <YAxis
                  stroke={getComputedTextColor()}
                  tick={{ fill: getComputedTextColor() }}
                  tickFormatter={formatNumber}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div
                          style={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                            padding: "8px 12px",
                            color: textColor,
                          }}
                        >
                          <p style={{ color: textColor, margin: 0 }}>
                            {`${label}: ${payload[0].value}`}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count">
                  {syncChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Indexer Health Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Indexer Health Status</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ResponsiveContainer width="100%" height={450}>
              <PieChart key={`pie-${themeKey}`}>
                <Pie
                  data={indexerHealthData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={150}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {indexerHealthData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey={(entry) =>
                      `${entry.name} ${(
                        (entry.value /
                          indexerHealthData.reduce(
                            (sum, item) => sum + item.value,
                            0
                          )) *
                        100
                      ).toFixed(0)}%`
                    }
                    position="outside"
                    style={{ fill: getComputedTextColor(), fontSize: 12 }}
                  />
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      return (
                        <div
                          style={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                            padding: "8px 12px",
                            color: textColor,
                          }}
                        >
                          <p style={{ color: textColor, margin: 0 }}>
                            {`${data.name}: ${data.value} (${(
                              (data.value /
                                indexerHealthData.reduce(
                                  (sum, item) => sum + item.value,
                                  0
                                )) *
                              100
                            ).toFixed(0)}%)`}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Query Volume Chart */}
        {queryVolumeData.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle>Top 10 Subgraphs by Query Volume (30 days)</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ResponsiveContainer width="100%" height={450}>
                <BarChart key={`query-${themeKey}`} data={queryVolumeData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={mutedTextColor}
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="name"
                    stroke={getComputedTextColor()}
                    tick={{ fill: getComputedTextColor(), fontSize: 10 }}
                    interval={0}
                  />
                  <YAxis
                    stroke={getComputedTextColor()}
                    tick={{ fill: getComputedTextColor() }}
                    tickFormatter={formatNumber}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0];
                        return (
                          <div
                            style={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                              padding: "8px 12px",
                              color: textColor,
                            }}
                          >
                            <p style={{ color: textColor, margin: 0 }}>
                              {`${label}: ${formatNumber(
                                data.value as number
                              )} queries`}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="queries" name="queries">
                    {queryVolumeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
            <div className="flex gap-4 mt-4">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={filterBySignal}
                  onChange={(e) => onFilterBySignalChange(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>Filter by {">"}0 Signal</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={filterByQueries}
                  onChange={(e) => onFilterByQueriesChange(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>Filter by {">"}0 Queries (30D)</span>
              </label>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {getSyncRate(subgraphs).toFixed(1)}%
                </div>
                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                  <span>Sync Rate</span>
                  <div className="group relative">
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      Percentage of filtered subgraph versions that have at
                      least one indexer at 100% sync
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {getHealthRate(subgraphs).toFixed(1)}%
                </div>
                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                  <span>Health Rate</span>
                  <div className="group relative">
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      Percentage of filtered subgraph versions that have at
                      least one healthy indexer
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {getActiveSubgraphs(subgraphs)}
                </div>
                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                  <span>Active Subgraph Versions</span>
                  <div className="group relative">
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      Number of filtered subgraph versions
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {getTotalQueryVolume(subgraphs).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Queries (30D)
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
