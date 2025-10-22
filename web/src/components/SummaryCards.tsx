import { BarChart3, Users, CheckCircle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SummaryCardsProps {
  data: {
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
      title: "Active Indexers",
      value: summary.total_indexers,
      icon: Users,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Synced Indexers",
      value: summary.synced_indexers,
      subtitle: `${(
        (summary.synced_indexers / summary.responding_indexers) *
        100
      ).toFixed(1)}% of responding`,
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
                    <p className="text-sm text-muted-foreground mt-1">
                      {card.subtitle}
                    </p>
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
