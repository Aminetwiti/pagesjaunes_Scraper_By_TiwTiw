# Usage Guide

## Chrome Extension Usage

### Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Navigate to the `ext/` folder in this project
5. Click **Select Folder**

The extension icon should now appear in your Chrome toolbar.

### Basic Usage

1. **Navigate to PagesJaunes**
   - Go to https://www.pagesjaunes.fr
   - Search for businesses (e.g., "restaurants paris")

2. **Open Extension**
   - Click the extension icon in your toolbar
   - The popup will show extracted listings from the current page

3. **Export Data**
   - Click **Export JSON** to download as JSON
   - Click **Export CSV** to download as CSV
   - Files are saved to your Downloads folder

### Features

- **Auto-extraction** - Automatically extracts visible listings
- **Real-time updates** - Updates as you scroll or navigate
- **Multiple formats** - Export to JSON or CSV
- **Phone reveal** - Automatically clicks to reveal hidden phone numbers
- **Batch processing** - Handles multiple pages of results

## Standalone Scraper Usage

### Installation

```bash
# Clone or navigate to project
cd pj_chrome_ext

# Install dependencies
npm install

# Or use the deployment script
chmod +x deploy.sh
./deploy.sh
```

### Basic Commands

#### Single Page Scraping

```bash
node scraper.js "https://www.pagesjaunes.fr/annuaire/paris-75000/restaurants"
```

This will:
- Scrape the first page of results
- Save to `result/pagesjaunes_YYYY-MM-DD-HHMMSS.json`
- Save to `result/pagesjaunes_YYYY-MM-DD-HHMMSS.csv`

#### Multi-Page Scraping

```bash
node scraper.js "https://www.pagesjaunes.fr/annuaire/paris-75000/restaurants" --max-pages 5
```

Scrapes 5 pages of results with automatic pagination.

#### Reveal Phone Numbers

```bash
node scraper.js "URL" --reveal-phones
```

Automatically clicks buttons to reveal hidden phone numbers.

#### Custom Output Directory

```bash
node scraper.js "URL" --output ./my-results
```

Saves results to a custom directory.

#### All Options Combined

```bash
node scraper.js "https://www.pagesjaunes.fr/annuaire/paris-75000/restaurants" \
  --max-pages 10 \
  --page-delay 3000 \
  --reveal-phones \
  --output ./results/restaurants
```

### Command-Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--max-pages <N>` | Number of pages to scrape | 1 |
| `--page-delay <MS>` | Delay between pages (milliseconds) | 2000 |
| `--reveal-phones` | Click to reveal phone numbers | false |
| `--output <DIR>` | Output directory | ./result |

### Output Files

Results are saved with timestamps:

```
result/
├── pagesjaunes_2026-01-22-120000.json
├── pagesjaunes_2026-01-22-120000.csv
├── pagesjaunes_2026-01-22-130000.json
└── pagesjaunes_2026-01-22-130000.csv
```

### JSON Output Example

```json
[
  {
    "name": "Restaurant Le Gourmet",
    "address": "123 Rue de Rivoli, 75001 Paris",
    "phone": "+33 1 42 60 00 00",
    "website": "https://legourmet.fr",
    "categories": ["Restaurant français", "Gastronomie"],
    "rating": 4.5,
    "reviews": 127,
    "hours": "Lun-Sam: 12h-14h30, 19h-22h30",
    "gps": {
      "lat": 48.8606,
      "lng": 2.3376
    }
  }
]
```

### CSV Output Example

```csv
name,address,phone,website,categories,rating,reviews,hours,gps_lat,gps_lng
"Restaurant Le Gourmet","123 Rue de Rivoli, 75001 Paris","+33 1 42 60 00 00","https://legourmet.fr","Restaurant français,Gastronomie",4.5,127,"Lun-Sam: 12h-14h30, 19h-22h30",48.8606,2.3376
```

## Advanced Usage

### Automated Scraping (Cron)

Create a cron job to scrape daily:

```bash
# Edit crontab
crontab -e

# Add daily scraping at 2 AM
0 2 * * * cd /path/to/pj_chrome_ext && node scraper.js "URL" --max-pages 10 --output ./result
```

### Batch Scraping Multiple Searches

Create a shell script:

```bash
#!/bin/bash
SEARCHES=(
  "restaurants paris"
  "plombiers lyon"
  "electriciens marseille"
)

for search in "${SEARCHES[@]}"; do
  URL="https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${search}"
  node scraper.js "$URL" --max-pages 5 --output "./result/${search}"
  sleep 5
done
```

### Processing Results

#### Count Total Listings

```bash
jq '. | length' result/pagesjaunes_*.json
```

#### Filter by Rating

```bash
jq '[.[] | select(.rating >= 4.0)]' result/pagesjaunes_*.json
```

#### Extract Phone Numbers Only

```bash
jq -r '.[].phone' result/pagesjaunes_*.json
```

## Best Practices

### Rate Limiting

- Use `--page-delay` to avoid being blocked
- Recommended: 2000-5000ms between pages
- For large scrapes, use longer delays

### Error Handling

- Check output files for completeness
- Monitor console output for errors
- Retry failed scrapes with increased delays

### Data Quality

- Use `--reveal-phones` for complete data
- Verify GPS coordinates are present
- Check for duplicate entries

### Storage Management

- Regularly clean old files from `result/`
- Compress JSON files for archival
- Use database for long-term storage

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.
