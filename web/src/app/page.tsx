"use client";

import { useState } from "react";
import {
  Search,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  RefreshCw,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { SubgraphData, AnalysisResult } from "@/types/subgraph";

export default function Home() {
  const [walletAddress, setWalletAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!walletAddress.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ walletAddress: walletAddress.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze subgraphs");
      }

      const result = await response.json();
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

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ walletAddress: walletAddress.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to refresh data");
      }

      const result = await response.json();
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
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setWalletAddress(
                        "0xa4c6a8392f046332628f33fd9891a7006b05cc95"
                      )
                    }
                    className="h-12 px-4 text-sm mr-2 cursor-pointer"
                  >
                    Use Example Wallet
                  </Button>
                  <Button
                    onClick={handleAnalyze}
                    disabled={isLoading}
                    className="h-12 px-6 cursor-pointer"
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
            <ChartsSection data={analysisResult} />

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
              <SubgraphTable data={analysisResult.subgraphs} />
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
