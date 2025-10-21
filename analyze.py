import requests
import json
import pandas as pd
import re
import os
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

def load_api_key():
    """
    Load API key from multiple sources in order of priority:
    1. Environment variable THEGRAPH_API_KEY
    2. .env file
    3. Hardcoded fallback
    """
    # Try environment variable first
    api_key = os.getenv('THEGRAPH_API_KEY')
    if api_key:
        print("✓ Using API key from environment variable THEGRAPH_API_KEY")
        return api_key
    
    # Try .env file
    try:
        from dotenv import load_dotenv
        load_dotenv()
        api_key = os.getenv('THEGRAPH_API_KEY')
        if api_key:
            print("✓ Using API key from .env file")
            return api_key
    except ImportError:
        print("ℹ python-dotenv not installed, skipping .env file check")
    except Exception as e:
        print(f"ℹ Could not load .env file: {e}")
    
    # Fallback to hardcoded key (uncomment the line below and add your API key)
    # hardcoded_key = "API_KEY_HERE"
    hardcoded_key = None  # Set this to your API key if you want to hardcode it
    
    if hardcoded_key and hardcoded_key != "your_api_key_here":
        print("⚠ Using hardcoded API key (consider using environment variable for security)")
        return hardcoded_key
    
    # No valid API key found
    print("❌ No valid API key found!")
    print("Please set your API key in one of these ways:")
    print("1. Environment variable: export THEGRAPH_API_KEY='your_key_here'")
    print("2. .env file: Create a .env file with THEGRAPH_API_KEY=your_key_here")
    print("3. Hardcode it in the script: Uncomment and set the hardcoded_key variable above")
    print("")
    print("To hardcode your API key:")
    print("1. Uncomment the line: # hardcoded_key = \"API_KEY_HERE\"")
    print("2. Replace the API_KEY_HERE with your actual API key")
    print("3. Comment out the line: hardcoded_key = API_KEY_HERE")
    exit(1)

# Load API key
API_KEY = load_api_key()
headers = {
    "Authorization": f"Bearer {API_KEY}"
}

# Network subgraph endpoint
endpoint = "https://gateway.thegraph.com/api/subgraphs/id/DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp"

# Status checking data structures
class Health(Enum):
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    FAILED = "failed"

@dataclass
class Block:
    number: str

@dataclass
class SubgraphError:
    message: str
    block: Optional[Block] = None
    handlers: Optional[str] = None
    deterministic: bool = False

@dataclass
class ChainIndexingStatus:
    network: str
    chain_head_block: Block
    earliest_block: Block
    latest_block: Optional[Block] = None

@dataclass
class IndexingStatus:
    subgraph: str
    health: Health
    entity_count: str
    node: Optional[str] = None
    paused: Optional[bool] = None
    synced: bool = False
    history_blocks: int = 0
    fatal_error: Optional[SubgraphError] = None
    non_fatal_errors: List[SubgraphError] = None
    chains: List[ChainIndexingStatus] = None

@dataclass
class SubgraphFeatures:
    api_version: Optional[str] = None
    data_sources: List[str] = None
    features: List[str] = None
    spec_version: str = ""
    handlers: List[str] = None
    network: str = ""

@dataclass
class SubgraphData:
    subgraph_features: SubgraphFeatures
    indexing_statuses: List[IndexingStatus]

def get_status_url(local: bool = False) -> str:
    """
    Get the status URL for querying subgraph status.
    """
    if local:
        return "http://localhost:8030/graphql"
    
    # Default to upgrade indexer URL
    return "https://indexer.upgrade.thegraph.com/status"

def get_subgraph_status(url: str, deployment_id: str) -> Optional[SubgraphData]:
    """
    Get detailed subgraph status using GraphQL query.
    """
    query = f"""
    {{
        subgraphFeatures(subgraphId:"{deployment_id}"){{
            apiVersion
            specVersion
            network
            handlers
            dataSources
            features
        }}
        indexingStatuses(subgraphs: ["{deployment_id}"]){{
            subgraph
            synced
            health
            entityCount
            historyBlocks
            node
            paused
            fatalError {{
                message
                handler
                deterministic
            }}
            chains {{
                chainHeadBlock {{
                    number
                }}
                latestBlock {{
                    number
                }}
                earliestBlock {{
                    number
                }}
                network
            }}
            nonFatalErrors{{
                message
                deterministic
                handler
                block{{
                    number
                }}
            }}
        }}
    }}
    """
    
    try:
        response = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json={"query": query},
            timeout=30
        )
        
        if response.status_code != 200:
            return None
            
        data = response.json()
        
        if 'errors' in data:
            return None
            
        if 'data' not in data:
            return None
            
        # Parse the response into our data structures
        subgraph_data = data['data']
        
        # Parse subgraph features
        features_data = subgraph_data.get('subgraphFeatures', {})
        subgraph_features = SubgraphFeatures(
            api_version=features_data.get('apiVersion'),
            data_sources=features_data.get('dataSources', []),
            features=features_data.get('features', []),
            spec_version=features_data.get('specVersion', ''),
            handlers=features_data.get('handlers', []),
            network=features_data.get('network', '')
        )
        
        # Parse indexing statuses
        indexing_statuses = []
        for status_data in subgraph_data.get('indexingStatuses', []):
            # Parse chains
            chains = []
            for chain_data in status_data.get('chains', []):
                chain = ChainIndexingStatus(
                    network=chain_data.get('network', ''),
                    chain_head_block=Block(number=chain_data['chainHeadBlock']['number']),
                    earliest_block=Block(number=chain_data['earliestBlock']['number']),
                    latest_block=Block(number=chain_data['latestBlock']['number']) if chain_data.get('latestBlock') else None
                )
                chains.append(chain)
            
            # Parse fatal error
            fatal_error = None
            if status_data.get('fatalError'):
                fe_data = status_data['fatalError']
                fatal_error = SubgraphError(
                    message=fe_data.get('message', ''),
                    handlers=fe_data.get('handler'),
                    deterministic=fe_data.get('deterministic', False)
                )
            
            # Parse non-fatal errors
            non_fatal_errors = []
            for nfe_data in status_data.get('nonFatalErrors', []):
                nfe = SubgraphError(
                    message=nfe_data.get('message', ''),
                    handlers=nfe_data.get('handler'),
                    deterministic=nfe_data.get('deterministic', False)
                )
                if nfe_data.get('block'):
                    nfe.block = Block(number=nfe_data['block']['number'])
                non_fatal_errors.append(nfe)
            
            status = IndexingStatus(
                subgraph=status_data.get('subgraph', ''),
                health=Health(status_data.get('health', 'failed')),
                entity_count=status_data.get('entityCount', '0'),
                node=status_data.get('node'),
                paused=status_data.get('paused'),
                synced=status_data.get('synced', False),
                history_blocks=status_data.get('historyBlocks', 0),
                fatal_error=fatal_error,
                non_fatal_errors=non_fatal_errors,
                chains=chains
            )
            indexing_statuses.append(status)
        
        return SubgraphData(
            subgraph_features=subgraph_features,
            indexing_statuses=indexing_statuses
        )
        
    except Exception as error:
        return None

def get_manifest_as_string(deployment_id: str) -> Optional[str]:
    """
    Get the manifest content from IPFS.
    """
    try:
        manifest_url = f"https://api.thegraph.com/ipfs/api/v0/cat?arg={deployment_id}"
        response = requests.get(manifest_url, timeout=30)
        if response.status_code == 200:
            return response.text
    except Exception as error:
        print(f"Error fetching manifest: {error}")
    return None

def get_query_volume_30d(deployment_id: str) -> Optional[Dict]:
    """
    Get the 30-day query volume for a subgraph deployment.
    
    Returns:
        Dict with 'count' and 'numDays' or None if failed
    """
    try:
        query_volume_url = f"https://thegraph.com/explorer/api/subgraph/query-volume/{deployment_id}"
        response = requests.get(query_volume_url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if 'count' in data and 'numDays' in data:
                return {
                    'query_volume_30d': data['count'],
                    'query_volume_days': data['numDays']
                }
    except Exception as error:
        print(f"Error fetching query volume for {deployment_id}: {error}")
    
    return None

def get_start_block(manifest: str) -> int:
    """
    Extract the start block from manifest.
    """
    try:
        matches = re.findall(r'startBlock:\s*(\d+)', manifest)
        if matches:
            return min(int(match) for match in matches)
    except Exception:
        pass
    return 0

def get_sync_percentage(start_block: int, latest_block: int, chain_head_block: int) -> str:
    """
    Calculate sync percentage.
    """
    if latest_block == 0:
        return "N/A"
    
    blocks_processed = latest_block - start_block
    total_blocks = chain_head_block - start_block
    
    if total_blocks <= 0:
        return "N/A"
    
    synced = (blocks_processed * 100) // total_blocks
    return f"{min(synced, 100)}%"

def check_indexer_status(deployment_id: str, indexer_url: str) -> Optional[Dict]:
    """
    Check the status of a subgraph deployment on a specific indexer.
    """
    try:
        # Clean up the indexer URL
        if not indexer_url.startswith('http'):
            indexer_url = f"https://{indexer_url}"
        
        # Remove trailing slash if present
        indexer_url = indexer_url.rstrip('/')
        
        # Get status URL for this specific indexer
        status_url = f"{indexer_url}/status"
        
        # Get subgraph status
        subgraph_data = get_subgraph_status(status_url, deployment_id)
        
        if subgraph_data and subgraph_data.indexing_statuses:
            status = subgraph_data.indexing_statuses[0]
            
            # Extract key information
            result = {
                'indexer_url': indexer_url,
                'status': 'success',
                'synced': status.synced,
                'health': status.health.value,
                'entity_count': status.entity_count,
                'paused': status.paused,
                'node': status.node
            }
            
            # Add block information if available
            if status.chains:
                chain = status.chains[0]
                latest_block = int(chain.latest_block.number) if chain.latest_block else 0
                chain_head_block = int(chain.chain_head_block.number)
                earliest_block = int(chain.earliest_block.number)
                
                blocks_behind = chain_head_block - latest_block
                
                result.update({
                    'latest_block': latest_block,
                    'chain_head_block': chain_head_block,
                    'earliest_block': earliest_block,
                    'blocks_behind': blocks_behind,
                    'network': chain.network
                })
            
            # Add error information
            if status.fatal_error:
                result['fatal_error'] = status.fatal_error.message
            
            if status.non_fatal_errors:
                result['non_fatal_errors'] = [error.message for error in status.non_fatal_errors]
            
            return result
        else:
            return {
                'indexer_url': indexer_url,
                'status': 'error',
                'error': 'No status data available'
            }
            
    except Exception as error:
        return {
            'indexer_url': indexer_url,
            'status': 'error',
            'error': str(error)
        }

def check_indexers_and_query_volume_parallel(deployment_id: str, indexer_urls: List[str], start_block: int, ipfs_hash: str, max_workers: int = 10) -> Tuple[List[Dict], List[str], Optional[Dict]]:
    """
    Check multiple indexers in parallel for a given deployment and fetch query volume.
    
    Args:
        deployment_id: The IPFS hash of the subgraph deployment
        indexer_urls: List of indexer URLs to check
        start_block: The start block for sync percentage calculation
        max_workers: Maximum number of concurrent threads
        
    Returns:
        Tuple of (indexer_statuses, indexer_sync_percentages, query_volume_data)
    """
    indexer_statuses = []
    indexer_sync_percentages = []
    query_volume_data = None
    
    if not indexer_urls:
        # Still fetch query volume even if no indexers
        query_volume_data = get_query_volume_30d(deployment_id)
        return indexer_statuses, indexer_sync_percentages, query_volume_data
    
    print(f"    Checking {len(indexer_urls)} active indexers for version {ipfs_hash}...")
    
    def check_single_indexer(indexer_url):
        """Check a single indexer and return both status and sync percentage."""
        status_result = check_indexer_status(deployment_id, indexer_url)
        
        if status_result:
            # Calculate sync percentage for this indexer
            if (status_result.get('status') == 'success' and 
                'latest_block' in status_result and 
                'chain_head_block' in status_result):
                
                latest_block = status_result['latest_block']
                chain_head_block = status_result['chain_head_block']
                sync_pct = get_sync_percentage(start_block, latest_block, chain_head_block)
            else:
                sync_pct = "N/A"
            
            return status_result, sync_pct
        else:
            return None, "N/A"
    
    # Use ThreadPoolExecutor for parallel execution
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit indexer checking tasks
        future_to_url = {
            executor.submit(check_single_indexer, url): url 
            for url in indexer_urls
        }
        
        # Submit query volume task
        query_volume_future = executor.submit(get_query_volume_30d, deployment_id)
        
        # Process completed indexer tasks
        for future in as_completed(future_to_url):
            indexer_url = future_to_url[future]
            try:
                status_result, sync_pct = future.result()
                if status_result:
                    indexer_statuses.append(status_result)
                    indexer_sync_percentages.append(sync_pct)
                else:
                    indexer_sync_percentages.append("N/A")
            except Exception as e:
                print(f"    Error checking {indexer_url}: {e}")
                indexer_sync_percentages.append("N/A")
        
        # Get query volume result
        try:
            query_volume_data = query_volume_future.result()
        except Exception as e:
            print(f"    Error fetching query volume for {deployment_id}: {e}")
    
    return indexer_statuses, indexer_sync_percentages, query_volume_data

# Get account ID from user input
print("Graph Network Subgraph Analysis Tool")
print("=" * 40)
account = input("Enter the Wallet Address to check subgraphs for (e.g., 0xa4c6a8392f046332628f33fd9891a7006b05cc95): ").strip()

if not account:
    print("Error: Account ID cannot be empty")
    exit(1)

# Validate account ID format (basic check for Ethereum address format)
if not account.startswith('0x') or len(account) != 42:
    print("Warning: Account ID doesn't appear to be a valid Ethereum address format")
    proceed = input("Do you want to continue anyway? (y/N): ").strip().lower()
    if proceed not in ['y', 'yes']:
        print("Exiting...")
        exit(1)

# Query to fetch all subgraphs with versions and their deployments
query_subgraphs = """
{
  graphAccounts(where: {id: "%s"}) {
    subgraphs {
      id
      versions {
        version
        subgraphDeployment {
          ipfsHash
          signalledTokens
          createdAt
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
}
""" % account

print(f"\nFetching subgraph data for account: {account}")
response = requests.post(endpoint, json={'query': query_subgraphs}, headers=headers)
data = response.json()

if 'errors' in data:
    print("Error fetching subgraphs:", json.dumps(data['errors'], indent=2))
    exit(1)

graph_accounts = data['data']['graphAccounts']
if not graph_accounts:
    print("No account found.")
    exit(1)

subgraphs = graph_accounts[0]['subgraphs']
print(f"Found {len(subgraphs)} subgraphs")

# Create the DataFrame structure with additional status columns
rows = []

print("Processing subgraphs and checking indexer status...")
start_time = time.time()

for sg_idx, sg in enumerate(subgraphs, 1):
    subgraph_id = sg['id']
    num_versions = len(sg['versions'])
    print(f"\n[{sg_idx}/{len(subgraphs)}] Processing subgraph: {subgraph_id} ({num_versions} versions)")
    
    # Process each version of the subgraph
    for version in sg['versions']:
        deployment = version['subgraphDeployment']
        ipfs_hash = deployment['ipfsHash']
        signalled_tokens = deployment['signalledTokens']
        indexer_allocations = deployment['indexerAllocations']
        
        # Get active indexers
        indexer_ids = [alloc['indexer']['id'] for alloc in indexer_allocations]
        indexer_urls = [alloc['indexer']['url'] for alloc in indexer_allocations if alloc['indexer'].get('url')]
        indexers_str = ', '.join(indexer_ids) if indexer_ids else 'None'
        
        # Log version processing
        if indexer_urls:
            print(f"  Version {ipfs_hash}: {len(indexer_urls)} active indexers")
        else:
            print(f"  Version {ipfs_hash}: No active indexers")
        
        # Get manifest to extract start block (only once per deployment)
        manifest = get_manifest_as_string(ipfs_hash)
        start_block = get_start_block(manifest) if manifest else 0
        
        # Check status for each indexer in parallel and fetch query volume
        indexer_statuses, indexer_sync_percentages, query_volume_data = check_indexers_and_query_volume_parallel(
            ipfs_hash, indexer_urls, start_block, ipfs_hash, max_workers=10
        )
        
        # Create sync percentages string
        sync_percentages_str = ', '.join(indexer_sync_percentages) if indexer_sync_percentages else 'None'
        
        # Create a row for each subgraph-IPFS combination
        row = {
            'subgraph_id': subgraph_id,
            'ipfs_hash': ipfs_hash,
            'signal_amount': signalled_tokens,
            'active_indexers': indexers_str,
            'indexer_sync_percentages': sync_percentages_str,
            'indexer_count': len(indexer_urls),
            'indexer_statuses': indexer_statuses
        }
        
        # Add query volume data
        if query_volume_data:
            row['query_volume_30d'] = query_volume_data.get('query_volume_30d', 0)
            row['query_volume_days'] = query_volume_data.get('query_volume_days', 0)
        else:
            row['query_volume_30d'] = 0
            row['query_volume_days'] = 0
        
        # Add summary status information
        if indexer_statuses:
            successful_statuses = [s for s in indexer_statuses if s.get('status') == 'success']
            synced_count = sum(1 for s in successful_statuses if s.get('synced', False))
            healthy_count = sum(1 for s in successful_statuses if s.get('health') == 'healthy')
            
            # Find the highest sync percentage from indexer_sync_percentages
            highest_sync_pct = "0%"
            if indexer_sync_percentages:
                # Filter out "N/A" values and extract numeric percentages
                numeric_percentages = []
                for pct in indexer_sync_percentages:
                    if pct != "N/A" and pct.endswith('%'):
                        try:
                            # Extract the number before the % sign
                            numeric_value = float(pct[:-1])
                            numeric_percentages.append(numeric_value)
                        except ValueError:
                            continue
                
                if numeric_percentages:
                    highest_sync_pct = f"{max(numeric_percentages):.1f}%"
            
            row.update({
                'indexers_responding': len(successful_statuses),
                'indexers_synced': synced_count,
                'indexers_healthy': healthy_count,
                'sync_percentage': highest_sync_pct
            })
        else:
            row.update({
                'indexers_responding': 0,
                'indexers_synced': 0,
                'indexers_healthy': 0,
                'sync_percentage': "0%"
            })
        
        rows.append(row)

# Calculate total processing time
end_time = time.time()
processing_time = end_time - start_time

print(f"\nProcessing completed in {processing_time:.2f} seconds")

# Create DataFrame
df = pd.DataFrame(rows)

# Create a simplified CSV without the complex indexer_statuses column
csv_df = df.drop('indexer_statuses', axis=1)
output_file = 'subgraph_network_data.csv'
csv_df.to_csv(output_file, index=False)

# Save detailed data with status information to JSON
json_output_file = 'subgraph_network_data_detailed.json'
with open(json_output_file, 'w') as f:
    # Convert the data to JSON-serializable format
    json_data = []
    for _, row in df.iterrows():
        json_row = row.to_dict()
        # Convert indexer_statuses to a simpler format for JSON
        if 'indexer_statuses' in json_row and json_row['indexer_statuses']:
            json_row['indexer_statuses'] = [
                {
                    'indexer_url': status.get('indexer_url', ''),
                    'status': status.get('status', ''),
                    'synced': status.get('synced', False),
                    'health': status.get('health', ''),
                    'entity_count': status.get('entity_count', ''),
                    'blocks_behind': status.get('blocks_behind', 0),
                    'network': status.get('network', ''),
                    'error': status.get('error', '')
                }
                for status in json_row['indexer_statuses']
            ]
        json_data.append(json_row)
    
    json.dump(json_data, f, indent=2)

print(f"\nData saved to {output_file}")
print(f"Detailed data saved to {json_output_file}")
print(f"DataFrame shape: {df.shape}")
print(f"Columns: {list(csv_df.columns)}")

# Display first few rows
print("\nFirst 10 rows:")
print(csv_df.head(10).to_string())

# Display summary statistics
print(f"\nSummary:")
print(f"Total rows: {len(df)}")
print(f"Unique subgraphs: {df['subgraph_id'].nunique()}")
print(f"Unique IPFS hashes: {df['ipfs_hash'].nunique()}")

# Show subgraphs with signal
has_signal = df[df['signal_amount'] != '0']
print(f"Rows with signal: {len(has_signal)}")

# Show subgraphs with active indexers
has_indexers = df[df['active_indexers'] != 'None']
print(f"Rows with active indexers: {len(has_indexers)}")

# Show query volume summary
total_query_volume = df['query_volume_30d'].sum()
subgraphs_with_queries = len(df[df['query_volume_30d'] > 0])
print(f"Total 30-day query volume: {total_query_volume:,}")
print(f"Subgraphs with query volume: {subgraphs_with_queries}")

# Show indexer status summary
total_indexers = df['indexer_count'].sum()
responding_indexers = df['indexers_responding'].sum()
synced_indexers = df['indexers_synced'].sum()
healthy_indexers = df['indexers_healthy'].sum()

print(f"\nIndexer Status Summary:")
print(f"Total indexers checked: {total_indexers}")
print(f"Indexers responding: {responding_indexers} ({(responding_indexers/total_indexers*100):.1f}%)")
print(f"Indexers synced: {synced_indexers} ({(synced_indexers/responding_indexers*100):.1f}%)" if responding_indexers > 0 else "Indexers synced: 0")
print(f"Indexers healthy: {healthy_indexers} ({(healthy_indexers/responding_indexers*100):.1f}%)" if responding_indexers > 0 else "Indexers healthy: 0")

# Show top IPFS hashes by signal amount
print("\nTop 5 IPFS hashes by signal amount:")
top_signal = df[df['signal_amount'] != '0'].copy()
top_signal['signal_amount_num'] = top_signal['signal_amount'].astype(float)
top_signal = top_signal.sort_values('signal_amount_num', ascending=False)
print(top_signal[['ipfs_hash', 'signal_amount', 'query_volume_30d', 'indexer_count', 'indexers_responding', 'indexers_synced', 'sync_percentage', 'indexer_sync_percentages']].head().to_string(index=False))

# Show top IPFS hashes by query volume
print("\nTop 5 IPFS hashes by 30-day query volume:")
top_queries = df[df['query_volume_30d'] > 0].copy()
top_queries = top_queries.sort_values('query_volume_30d', ascending=False)
print(top_queries[['ipfs_hash', 'query_volume_30d', 'signal_amount', 'indexer_count', 'indexers_responding', 'indexers_synced', 'sync_percentage']].head().to_string(index=False))

# Show subgraphs with issues (sync percentage < 100%)
print("\nSubgraphs with potential issues (sync percentage < 100%):")
issues = df[
    (df['indexer_count'] > 0) & 
    (df['sync_percentage'] != '0%') &
    (df['sync_percentage'] != 'N/A') &
    (df['sync_percentage'].str.replace('%', '').astype(float) < 100.0)
]

if not issues.empty:
    # Add columns to identify latest version and signal amount
    issues_display = issues.copy()
    
    # Determine if each subgraph is the latest version
    latest_versions = df.groupby('subgraph_id')['ipfs_hash'].last().reset_index()
    latest_versions['is_latest'] = True
    issues_display = issues_display.merge(latest_versions[['ipfs_hash', 'is_latest']], on='ipfs_hash', how='left')
    issues_display['is_latest'] = issues_display['is_latest'].fillna(False)
    
    # Format signal amount for better readability (convert from wei to GRT)
    issues_display['signal_amount_formatted'] = issues_display['signal_amount'].apply(
        lambda x: f"{float(x) / 10**18:,.2f}" if x != '0' else '0'
    )
    
    print(issues_display[['subgraph_id', 'ipfs_hash', 'is_latest', 'signal_amount_formatted', 'query_volume_30d', 'active_indexers', 'indexer_count', 'indexers_responding', 'sync_percentage', 'indexer_sync_percentages']].to_string(index=False))
    
    # Save problematic subgraphs to CSV
    issues_csv_file = 'problematic_subgraphs.csv'
    issues_display[['subgraph_id', 'ipfs_hash', 'is_latest', 'signal_amount_formatted', 'query_volume_30d', 'active_indexers', 'indexer_count', 'indexers_responding', 'sync_percentage', 'indexer_sync_percentages']].to_csv(issues_csv_file, index=False)
    print(f"\nProblematic subgraphs saved to {issues_csv_file}")
else:
    print("No issues found - all subgraphs are 100% synced!")
