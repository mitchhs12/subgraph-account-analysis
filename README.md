# Graph Network Subgraph Analysis Tool

A Python script that analyzes subgraph deployments for a given wallet address on The Graph Network. The tool checks the status of active indexers, calculates sync percentages, and provides detailed insights into subgraph health and performance.

## Features

- **Subgraph Discovery**: Fetches all subgraphs and versions for a given wallet address
- **Indexer Status Checking**: Monitors active indexers and their sync status
- **Parallel Processing**: Efficiently checks multiple indexers simultaneously
- **Sync Percentage Calculation**: Calculates how far behind indexers are from chain head
- **Health Monitoring**: Tracks indexer health status and error conditions
- **Query Volume Analysis**: Fetches 30-day query volume data for each subgraph
- **Data Export**: Exports results to CSV and JSON formats
- **Issue Detection**: Identifies subgraphs with sync issues or problems

## Prerequisites

- Python 3.7 or higher
- The Graph API key (get one at [The Graph Studio](https://thegraph.com/studio/apikeys/))

## Installation

1. **Clone or download this repository**

   ```bash
   git clone <repository-url>
   cd graph_account_analysis
   ```

2. **Create a virtual environment (recommended)**

   ```bash
   python3 -m venv venv
   ```

3. **Activate the virtual environment**

   **On macOS/Linux:**

   ```bash
   source venv/bin/activate
   ```

   **On Windows:**

   ```bash
   venv\Scripts\activate
   ```

   You should see `(venv)` at the beginning of your command prompt when the virtual environment is active.

4. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

## Configuration

### Option 1: Environment Variable (Recommended)

Set your The Graph API key as an environment variable:

```bash
export THEGRAPH_API_KEY="your_api_key_here"
```

### Option 2: .env File

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and add your API key:
   ```
   THEGRAPH_API_KEY=your_actual_api_key_here
   ```

### Option 3: Hardcode in Script (Not Recommended)

If you prefer to hardcode the API key, edit `analyze.py` and uncomment/modify line 39:

```python
hardcoded_key = "your_api_key_here"
```

## Usage

1. **Activate the virtual environment**

   ```bash
   source venv/bin/activate  # On macOS/Linux
   # or
   venv\Scripts\activate     # On Windows
   ```

2. **Run the script**

   ```bash
   python analyze.py
   ```

3. **Enter wallet address**
   When prompted, enter the Ethereum wallet address you want to analyze:

   ```
   Enter the Wallet Address to check subgraphs for (e.g., 0xa4c6a8392f046332628f33fd9891a7006b05cc95):
   ```

4. **Wait for analysis**
   The script will:
   - Fetch all subgraphs for the given address
   - Check each version's active indexers
   - Calculate sync percentages
   - Generate detailed reports

## Virtual Environment Operations

### Activating the Virtual Environment

Before running the script, always activate the virtual environment:

**On macOS/Linux:**

```bash
source venv/bin/activate
```

**On Windows:**

```bash
venv\Scripts\activate
```

When activated, you'll see `(venv)` at the beginning of your command prompt.

### Deactivating the Virtual Environment

When you're done working with the project:

```bash
deactivate
```

The `(venv)` prefix will disappear from your command prompt.

### Verifying the Virtual Environment

To check if the virtual environment is active and dependencies are installed:

```bash
# Check if virtual environment is active
which python  # Should show path to venv/bin/python

# Verify dependencies
python -c "import requests, pandas, dotenv; print('✓ All dependencies available')"
```

### Reinstalling Dependencies

If you need to reinstall dependencies:

```bash
# Activate virtual environment first
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate     # On Windows

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Troubleshooting Virtual Environment Issues

**Virtual environment not found:**

```bash
# Recreate the virtual environment
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Dependencies not found:**

```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Check installed packages
pip list

# Reinstall if needed
pip install -r requirements.txt
```

## Output Files

The script generates several output files:

- **`subgraph_network_data.csv`**: Main results in CSV format
- **`subgraph_network_data_detailed.json`**: Detailed results with full indexer status data
- **`problematic_subgraphs.csv`**: Subgraphs with sync issues (if any)

## Output Columns

### CSV Output

- `subgraph_id`: The subgraph identifier
- `ipfs_hash`: IPFS hash of the deployment
- `signal_amount`: Amount of GRT signal on the subgraph
- `active_indexers`: List of active indexer IDs
- `indexer_sync_percentages`: Sync percentages for each indexer
- `indexer_count`: Number of active indexers
- `indexers_responding`: Number of indexers that responded to status checks
- `indexers_synced`: Number of fully synced indexers
- `indexers_healthy`: Number of healthy indexers
- `sync_percentage`: Highest sync percentage among all indexers
- `query_volume_30d`: Total number of queries in the last 30 days
- `query_volume_days`: Number of days the query volume data covers (usually 30)

### JSON Output

Includes all CSV data plus detailed indexer status information:

- Individual indexer URLs and status
- Block information (latest, chain head, earliest)
- Error details (fatal and non-fatal)
- Network information

## Understanding the Results

### Sync Percentage

- **100%**: Indexer is fully synced with the chain head
- **< 100%**: Indexer is behind and still catching up
- **N/A**: Unable to calculate (usually due to missing data)

### Health Status

- **healthy**: Indexer is operating normally
- **unhealthy**: Indexer has issues but is still running
- **failed**: Indexer has critical failures

### Signal Amount

The amount of GRT (Graph Token) signal on the subgraph, indicating its importance and value to the network.

### Query Volume

- **query_volume_30d**: Total number of queries made to the subgraph in the last 30 days
- **query_volume_days**: Number of days the query volume data covers (typically 30)
- Higher query volumes indicate more active usage of the subgraph

## Troubleshooting

### Common Issues

1. **"No valid API key found"**

   - Ensure your API key is set correctly using one of the configuration methods above
   - Verify the API key is valid and has proper permissions

2. **"No account found"**

   - Verify the wallet address is correct and has subgraphs
   - Check that the address is in the correct format (0x followed by 40 hex characters)

3. **"Warning: Account ID doesn't appear to be a valid Ethereum address format"**

   - Ensure the address starts with '0x' and is 42 characters long
   - You can proceed anyway if you're sure the address is correct

4. **Slow performance**
   - The script checks multiple indexers in parallel, but large numbers of subgraphs may take time
   - Consider the network latency and indexer response times

### API Rate Limits

The script makes multiple API calls to The Graph Network. If you encounter rate limiting:

- The script includes built-in error handling
- Consider running during off-peak hours
- Contact The Graph support if issues persist

## Dependencies

- **requests**: HTTP library for API calls
- **pandas**: Data manipulation and analysis
- **python-dotenv**: Environment variable management

## License

This project is open source. Please check the license file for details.

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## Support

For issues related to:

- **The Graph Network**: Visit [The Graph Documentation](https://thegraph.com/docs/)
- **This Script**: Open an issue in this repository
- **API Keys**: Contact [The Graph Support](https://thegraph.com/discord/)
# subgraph-account-analysis
