import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import csv from "csv-parser";

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!walletAddress.startsWith("0x") || walletAddress.length !== 42) {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 }
      );
    }

    // Path to the Python script
    const scriptPath = path.join(process.cwd(), "..", "analyze.py");
    const csvPath = path.join(process.cwd(), "..", "subgraph_network_data.csv");
    const problematicCsvPath = path.join(
      process.cwd(),
      "..",
      "problematic_subgraphs.csv"
    );

    // Check if the script exists
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: "Analysis script not found" },
        { status: 500 }
      );
    }

    // Run the Python script
    await runPythonScript(scriptPath, walletAddress);

    // Read the CSV output
    const result = await parseCsvOutput(csvPath, problematicCsvPath);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze subgraphs" },
      { status: 500 }
    );
  }
}

function runPythonScript(
  scriptPath: string,
  walletAddress: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const python = spawn("python3", [scriptPath], {
      cwd: path.dirname(scriptPath),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";

    // Send wallet address to stdin
    python.stdin.write(walletAddress + "\n");
    python.stdin.end();

    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        return;
      }
      resolve();
    });

    python.on("error", (error) => {
      reject(new Error(`Failed to start Python script: ${error}`));
    });
  });
}

async function parseCsvOutput(
  csvPath: string,
  problematicCsvPath: string
): Promise<any> {
  try {
    // Parse CSV with proper handling of quoted fields
    const subgraphs: any[] = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on("data", (row) => {
          // Convert numeric fields
          row.version = parseInt(row.version) || 0;
          row.indexer_count = parseInt(row.indexer_count) || 0;
          row.query_volume_30d = parseFloat(row.query_volume_30d) || 0;
          row.query_volume_days = parseInt(row.query_volume_days) || 0;
          row.indexers_responding = parseInt(row.indexers_responding) || 0;
          row.indexers_synced = parseInt(row.indexers_synced) || 0;
          row.indexers_healthy = parseInt(row.indexers_healthy) || 0;

          subgraphs.push(row);
        })
        .on("end", resolve)
        .on("error", reject);
    });

    // Read problematic subgraphs if they exist
    let problematicSubgraphs: any[] = [];
    if (fs.existsSync(problematicCsvPath)) {
      await new Promise((resolve, reject) => {
        fs.createReadStream(problematicCsvPath)
          .pipe(csv())
          .on("data", (row) => {
            problematicSubgraphs.push(row);
          })
          .on("end", resolve)
          .on("error", reject);
      });
    }

    // Calculate summary statistics
    const summary = {
      total_subgraphs: new Set(subgraphs.map((s) => s.subgraph_id)).size,
      total_versions: subgraphs.length,
      total_query_volume: subgraphs.reduce(
        (sum, s) => sum + s.query_volume_30d,
        0
      ),
      subgraphs_with_queries: subgraphs.filter((s) => s.query_volume_30d > 0)
        .length,
      total_indexers: subgraphs.reduce((sum, s) => sum + s.indexer_count, 0),
      responding_indexers: subgraphs.reduce(
        (sum, s) => sum + s.indexers_responding,
        0
      ),
      synced_indexers: subgraphs.reduce((sum, s) => sum + s.indexers_synced, 0),
      healthy_indexers: subgraphs.reduce(
        (sum, s) => sum + s.indexers_healthy,
        0
      ),
      processing_time: 0, // This would need to be extracted from the Python output
    };

    // Get top subgraphs by signal amount
    const topBySignal = subgraphs
      .filter((s) => s.signal_amount !== "0")
      .sort((a, b) => parseFloat(b.signal_amount) - parseFloat(a.signal_amount))
      .slice(0, 5);

    // Get top subgraphs by query volume
    const topByQueries = subgraphs
      .filter((s) => s.query_volume_30d > 0)
      .sort((a, b) => b.query_volume_30d - a.query_volume_30d)
      .slice(0, 5);

    return {
      subgraphs,
      summary,
      top_by_signal: topBySignal,
      top_by_queries: topByQueries,
      problematic_subgraphs: problematicSubgraphs,
    };
  } catch (error) {
    throw new Error(`Failed to parse CSV output: ${error}`);
  }
}
