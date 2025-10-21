# Graph Network Subgraph Analysis Web App

A modern Next.js web application for analyzing The Graph Network subgraph performance, indexer status, and query volume.

## Features

- **Interactive Dashboard**: Clean, modern interface for subgraph analysis
- **Real-time Analysis**: Run Python analysis script from the web interface
- **Data Visualization**: Charts and graphs for better data understanding
- **Responsive Design**: Works on desktop and mobile devices
- **Sortable Tables**: Interactive tables with sorting and filtering
- **Export Capabilities**: Download analysis results

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.7+ (for the analysis script)
- The Graph API key

### Installation

1. Install dependencies:

```bash
npm install
```

2. Make sure the Python analysis script is set up in the parent directory:

```bash
cd ..
pip install -r requirements.txt
```

3. Set up your API key in a `.env` file in the parent directory:

```bash
echo "THEGRAPH_API_KEY=your_api_key_here" > ../.env
```

### Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production

Build and start the production server:

```bash
npm run build
npm start
```

## Usage

1. Enter a wallet address in the input field
2. Click "Analyze Subgraphs" to run the analysis
3. View the results in the interactive dashboard:
   - Summary cards with key metrics
   - Charts showing sync status and indexer health
   - Detailed table with all subgraph information
   - Problematic subgraphs (if any)

## Architecture

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Backend**: Next.js API routes that execute the Python analysis script
- **Data Flow**: Python script → CSV files → Next.js API → React components
- **Visualization**: Recharts for data visualization

## Components

- `SummaryCards`: Key metrics and statistics
- `ChartsSection`: Data visualization with charts
- `SubgraphTable`: Interactive table with sorting
- `API Route`: Handles Python script execution and CSV parsing

## API Endpoints

- `POST /api/analyze`: Analyzes subgraphs for a given wallet address
  - Input: `{ walletAddress: string }`
  - Output: Analysis results with subgraph data and summary statistics

## File Structure

```
web/
├── src/
│   ├── app/
│   │   ├── api/analyze/route.ts    # API endpoint
│   │   └── page.tsx                # Main page
│   ├── components/
│   │   ├── SummaryCards.tsx        # Summary metrics
│   │   ├── ChartsSection.tsx       # Data visualization
│   │   └── SubgraphTable.tsx       # Data table
│   └── types/
│       └── subgraph.ts             # TypeScript types
├── package.json
└── README.md
```

## Customization

- Modify components in `src/components/` to change the UI
- Update types in `src/types/subgraph.ts` for data structure changes
- Customize charts in `ChartsSection.tsx`
- Modify API logic in `src/app/api/analyze/route.ts`

## Troubleshooting

- **Python script not found**: Ensure the analysis script is in the parent directory
- **API key issues**: Check that your `.env` file is properly configured
- **CSV parsing errors**: Verify the Python script generates the expected CSV format
- **Build errors**: Run `npm run lint` to check for TypeScript errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request
