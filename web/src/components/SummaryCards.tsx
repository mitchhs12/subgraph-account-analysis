import { BarChart3, Users, CheckCircle, TrendingUp, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SummaryCardsProps {
  data: {
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
}

export default function SummaryCards({ data }: SummaryCardsProps) {
  const { summary } = data;

  const cards = [
    {
      title: "Total Subgraphs",
      value: summary.total_subgraphs,
      icon: BarChart3,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Versions",
      value: summary.total_versions,
      icon: BarChart3,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Query Volume (30d)",
      value: summary.total_query_volume.toLocaleString(),
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Unique Indexers",
      value: summary.total_indexers,
      subtitle: `${summary.total_indexer_instances} total instances`,
      icon: Users,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Synced Indexers",
      value: summary.synced_indexers,
      subtitle: `${summary.sync_rate.toFixed(1)}% of versions fully synced`,
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Healthy Indexers",
      value: summary.healthy_indexers,
      subtitle: `${(
        (summary.healthy_indexers / summary.responding_indexers) *
        100
      ).toFixed(1)}% of responding`,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const isSyncedIndexers = card.title === "Synced Indexers";

        return (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {card.value}
                  </p>
                  {card.subtitle && (
                    <div className="flex items-center gap-1 mt-1">
                      <p className="text-sm text-muted-foreground">
                        {card.subtitle}
                      </p>
                      {isSyncedIndexers && (
                        <div className="group relative">
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            Percentage of subgraph versions that have at least
                            one indexer at 100% sync
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className={`p-3 rounded-lg ${card.bgColor}`}>
                  <Icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
