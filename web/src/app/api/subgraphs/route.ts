import { NextRequest, NextResponse } from "next/server";

const ENDPOINT =
  "https://gateway.thegraph.com/api/subgraphs/id/DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const account = searchParams.get("account");
  if (!account) {
    return NextResponse.json({ error: "Account is required" }, { status: 400 });
  }
  const apiKey = process.env.THEGRAPH_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 }
    );
  }
  const query = `
  {
    graphAccounts(where: {id: "${account}"}) {
      subgraphs {
        id
        versions {
          version
          subgraphDeployment {
            ipfsHash
            signalledTokens
            indexerAllocations(where: {status: Active}) {
              indexer {
                id
                url
              }
            }
          }
        }
      }
    }
  }`;
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    if (data.errors) {
      throw new Error(JSON.stringify(data.errors));
    }
    const graphAccounts = data.data.graphAccounts;
    if (!graphAccounts || graphAccounts.length === 0) {
      return NextResponse.json({ versions: [] });
    }
    const subgraphs = graphAccounts[0].subgraphs;
    const versions = [];
    for (const sg of subgraphs) {
      for (const ver of sg.versions) {
        versions.push({
          subgraphId: sg.id,
          version: ver.version,
          ipfsHash: ver.subgraphDeployment.ipfsHash,
          signalAmount: ver.subgraphDeployment.signalledTokens,
          allocations: ver.subgraphDeployment.indexerAllocations.map(
            (alloc) => ({
              indexer: {
                id: alloc.indexer.id,
                url: alloc.indexer.url || null,
              },
            })
          ),
        });
      }
    }
    return NextResponse.json({ versions });
  } catch (error) {
    console.error("Error fetching subgraphs:", error);
    return NextResponse.json(
      { error: "Failed to fetch subgraphs" },
      { status: 500 }
    );
  }
}
