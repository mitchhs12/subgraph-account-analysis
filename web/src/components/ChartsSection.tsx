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
import { useTheme } from "next-themes";

interface ChartsSectionProps {
  data: {
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
  };
}

export default function ChartsSection({ data }: ChartsSectionProps) {
  const { subgraphs, summary } = data;
  const { theme } = useTheme();

  // Define explicit colors based on theme
  const textColor = theme === "dark" ? "#ffffff" : "#000000";
  const mutedTextColor = theme === "dark" ? "#9ca3af" : "#6b7280";

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

  // Custom label component for pie chart
  const CustomLabel = ({ x, y, value }: any) => (
    <text
      x={x}
      y={y}
      fill={textColor}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
    >
      {value}
    </text>
  );

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
      value: summary.total_indexers - summary.responding_indexers,
      color: colors.health["Not Responding"],
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Sync Status Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Sync Status Distribution</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={syncChartData}>
              <CartesianGrid stroke={mutedTextColor} opacity={0.3} />
              <XAxis
                dataKey="status"
                stroke={textColor}
                tick={{ fill: textColor, fontSize: 12 }}
              />
              <YAxis
                stroke={textColor}
                tick={{ fill: textColor }}
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
            <PieChart>
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
                  style={{ fill: textColor, fontSize: 12 }}
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
              <BarChart data={queryVolumeData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={mutedTextColor}
                  opacity={0.3}
                />
                <XAxis
                  dataKey="name"
                  stroke={textColor}
                  tick={{ fill: textColor, fontSize: 10 }}
                  interval={0}
                />
                <YAxis
                  stroke={textColor}
                  tick={{ fill: textColor }}
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
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {(
                  (summary.synced_indexers / summary.responding_indexers) *
                  100
                ).toFixed(1)}
                %
              </div>
              <div className="text-sm text-muted-foreground">Sync Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {(
                  (summary.healthy_indexers / summary.responding_indexers) *
                  100
                ).toFixed(1)}
                %
              </div>
              <div className="text-sm text-muted-foreground">Health Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {summary.subgraphs_with_queries}
              </div>
              <div className="text-sm text-muted-foreground">
                Active Subgraphs
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {summary.total_query_volume.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Queries</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
