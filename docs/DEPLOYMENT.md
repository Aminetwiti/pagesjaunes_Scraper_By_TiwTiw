# Deployment Guide

## Linux Server Deployment

### Prerequisites

- Linux server (Ubuntu 20.04+ recommended)
- Node.js v18 or higher
- Git (optional, for cloning)
- SSH access to server

### Quick Deployment

Use the automated deployment script:

```bash
# Make script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

This script will:
1. Check for Node.js installation
2. Install npm dependencies
3. Create necessary directories
4. Set up output folder
5. Verify installation

### Manual Deployment

#### 1. Transfer Files

**Option A: Git Clone**
```bash
git clone <your-repo-url> pj_chrome_ext
cd pj_chrome_ext
```

**Option B: SCP Transfer**
```bash
# From local machine
scp -r pj_chrome_ext user@server:/path/to/destination/
```

**Option C: SFTP**
```bash
sftp user@server
put -r pj_chrome_ext
```

#### 2. Install Dependencies

```bash
cd pj_chrome_ext
npm install
```

#### 3. Verify Installation

```bash
# Test scraper
node scraper.js "https://www.pagesjaunes.fr/annuaire/paris-75000/restaurants" --max-pages 1

# Check output
ls -la result/
```

### System Requirements

#### Minimum Requirements
- **CPU**: 1 core
- **RAM**: 512 MB
- **Disk**: 500 MB free space
- **Network**: Stable internet connection

#### Recommended Requirements
- **CPU**: 2+ cores
- **RAM**: 2 GB
- **Disk**: 5 GB free space (for results storage)
- **Network**: High-speed connection

### Installing Node.js

#### Ubuntu/Debian

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### CentOS/RHEL

```bash
# Install Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Verify installation
node --version
npm --version
```

#### Using NVM (Recommended)

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Load NVM
source ~/.bashrc

# Install Node.js
nvm install 18
nvm use 18

# Verify
node --version
```

## Automated Scraping Setup

### Cron Jobs

#### Daily Scraping

```bash
# Edit crontab
crontab -e

# Add daily scraping at 2 AM
0 2 * * * cd /path/to/pj_chrome_ext && node scraper.js "https://www.pagesjaunes.fr/annuaire/paris-75000/restaurants" --max-pages 10 --output ./result >> /var/log/pj_scraper.log 2>&1
```

#### Hourly Scraping

```bash
# Every hour
0 * * * * cd /path/to/pj_chrome_ext && node scraper.js "URL" --max-pages 5 --output ./result
```

#### Weekly Scraping

```bash
# Every Sunday at 3 AM
0 3 * * 0 cd /path/to/pj_chrome_ext && node scraper.js "URL" --max-pages 20 --output ./result
```

### Systemd Service

Create a systemd service for continuous scraping:

#### 1. Create Service File

```bash
sudo nano /etc/systemd/system/pj-scraper.service
```

#### 2. Add Configuration

```ini
[Unit]
Description=PagesJaunes Scraper Service
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/pj_chrome_ext
ExecStart=/usr/bin/node scraper.js "URL" --max-pages 10 --output ./result
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 3. Enable and Start

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable pj-scraper.service

# Start service
sudo systemctl start pj-scraper.service

# Check status
sudo systemctl status pj-scraper.service
```

## Chrome Extension Deployment

### Local Installation

1. **Open Chrome Extensions**
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode**
   - Toggle switch in top-right corner

3. **Load Extension**
   - Click "Load unpacked"
   - Select the `ext/` folder
   - Extension will appear in toolbar

### Distribution (Optional)

#### Chrome Web Store

1. **Prepare Package**
   ```bash
   cd ext
   zip -r ../pagesjaunes-scraper.zip *
   ```

2. **Upload to Chrome Web Store**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Pay one-time $5 developer fee
   - Upload ZIP file
   - Fill in store listing details
   - Submit for review

#### Private Distribution

Share the `ext/` folder directly with users for manual installation.

## Environment Configuration

### Environment Variables

Create `.env` file in project root:

```bash
# Output directory
OUTPUT_DIR=./result

# Scraping settings
MAX_PAGES=10
PAGE_DELAY=2000
REVEAL_PHONES=true

# Logging
LOG_LEVEL=info
LOG_FILE=./result/scraper.log
```

### Configuration File

Create `config.json`:

```json
{
  "scraper": {
    "maxPages": 10,
    "pageDelay": 2000,
    "revealPhones": true,
    "outputDir": "./result"
  },
  "browser": {
    "headless": true,
    "timeout": 30000
  }
}
```

## Monitoring and Logging

### Log Files

```bash
# Create log directory
mkdir -p logs

# Run with logging
node scraper.js "URL" >> logs/scraper.log 2>&1

# View logs
tail -f logs/scraper.log
```

### Log Rotation

Install logrotate:

```bash
sudo nano /etc/logrotate.d/pj-scraper
```

Add configuration:

```
/path/to/pj_chrome_ext/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

## Security Considerations

### File Permissions

```bash
# Set proper permissions
chmod 755 scraper.js
chmod 644 package.json
chmod 700 result/
```

### Firewall Rules

```bash
# Allow outbound HTTPS (if firewall is enabled)
sudo ufw allow out 443/tcp
```

### User Isolation

Run scraper as dedicated user:

```bash
# Create user
sudo useradd -m -s /bin/bash pjscraper

# Transfer ownership
sudo chown -R pjscraper:pjscraper /path/to/pj_chrome_ext

# Run as user
sudo -u pjscraper node scraper.js "URL"
```

## Backup and Recovery

### Backup Results

```bash
# Create backup script
#!/bin/bash
BACKUP_DIR="/backup/pj_scraper"
DATE=$(date +%Y%m%d)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/results_$DATE.tar.gz result/

# Keep only last 30 days
find $BACKUP_DIR -name "results_*.tar.gz" -mtime +30 -delete
```

### Restore Results

```bash
tar -xzf /backup/pj_scraper/results_20260122.tar.gz
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common deployment issues.
