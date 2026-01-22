#!/bin/bash

# PagesJaunes Scraper by TiwiTiw - Deployment Script for Linux
# This script installs dependencies and sets up the scraper

set -e  # Exit on error

echo "� PagesJaunes Scraper by TiwiTiw"
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js (v18 or higher) from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js detected: $NODE_VERSION"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "✅ npm detected: $NPM_VERSION"

# Create result directory if it doesn't exist
echo ""
echo "📁 Creating result directory..."
mkdir -p result

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "✅ Installation complete!"
echo ""
echo "=========================================="
echo "Usage Examples:"
echo "=========================================="
echo ""
echo "1. Basic scraping (single page):"
echo "   node scraper.js \"https://www.pagesjaunes.fr/annuaire/paris-75000/restaurants\""
echo ""
echo "2. Multi-page scraping with phone reveal:"
echo "   node scraper.js \"https://www.pagesjaunes.fr/annuaire/paris-75000/restaurants\" --max-pages 5 --reveal-phones"
echo ""
echo "3. Custom output directory:"
echo "   node scraper.js \"https://www.pagesjaunes.fr/annuaire/paris-75000/restaurants\" --output ./result/restaurants"
echo ""
echo "4. All options:"
echo "   node scraper.js \"URL\" --max-pages 10 --page-delay 3000 --reveal-phones --output ./result"
echo ""
echo "📊 Results will be saved to: ./result/"
echo ""
echo "=========================================="
