# 🔍 PagesJaunes Scraper by TiwiTiw

> Professional scraper for extracting business data from PagesJaunes.fr

## 📋 Overview

This project provides two ways to scrape PagesJaunes:
1. **Chrome Extension** - Interactive browser extension with GUI
2. **Standalone Scraper** - Automated Puppeteer script for Linux servers

## 📁 Project Structure

```
pj_chrome_ext/
├── ext/                    # Chrome Extension
│   ├── icons/             # Extension icons
│   ├── manifest.json      # Extension manifest
│   ├── popup.html/js      # Extension UI
│   └── deep-scraper*.js   # Scraping logic
├── test/                   # Test files
├── docs/                   # Documentation
├── html/                   # HTML samples for testing
├── result/                 # Scraper output files
├── scripts/                # Utility scripts (Python)
├── scraper.js              # Standalone Puppeteer scraper
├── package.json
├── deploy.sh
└── README.md
```

## 🚀 Quick Start

### Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `ext/` folder
4. Visit any PagesJaunes search page and click the extension icon

### Standalone Scraper (Linux)

```bash
# Deploy on Linux server
chmod +x deploy.sh
./deploy.sh

# Run scraper
node scraper.js "https://www.pagesjaunes.fr/annuaire/paris-75000/restaurants" --max-pages 5 --reveal-phones
```

## ⚙️ Scraper Options

- `--max-pages <N>` - Number of pages to scrape (default: 1)
- `--page-delay <MS>` - Delay between pages in milliseconds (default: 2000)
- `--reveal-phones` - Click buttons to reveal phone numbers
- `--output <DIR>` - Output directory (default: ./result)

## 📊 Output

Results are saved in `result/` directory in both JSON and CSV formats:
- `pagesjaunes_YYYY-MM-DD-HHMMSS.json`
- `pagesjaunes_YYYY-MM-DD-HHMMSS.csv`

## 📚 Documentation

- [Architecture](docs/ARCHITECTURE.md) - Technical architecture overview
- [Usage Guide](docs/USAGE.md) - Detailed usage instructions
- [Deployment](docs/DEPLOYMENT.md) - Linux deployment guide
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions

## 🔧 Requirements

- Node.js v18 or higher
- Chrome browser (for extension)
- Linux/Unix environment (for standalone scraper)

## 👤 Author

**TiwiTiw**

## 📄 License

MIT
