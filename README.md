# SmartPicks India - Content & Affiliate Marketing Automation

Automated content and affiliate marketing system that you can manage entirely from your phone. Generates SEO-optimized blog articles, manages affiliate links, publishes to a free blog, and distributes content across social media.

## Features

- **Telegram Bot** - Manage everything from your phone
- **Content Generator** - Template-based article generation (no AI API costs)
- **Affiliate Manager** - Track and auto-insert affiliate links
- **Static Blog** - Free hosting on GitHub Pages
- **Social Media** - Auto-post to Twitter, Medium, Blogger
- **Analytics** - Track views, clicks, and earnings
- **GitHub Actions** - Fully automated daily content pipeline
- **Pinterest Automation** - Auto-create pin images, schedule 25 pins/day, landing pages

## Quick Start (Phone Only)

### 1. Create Telegram Bot
- Open Telegram, search for `@BotFather`
- Send `/newbot`, follow the steps
- Save the bot token

### 2. Get Your Telegram ID
- Send `/start` to your new bot
- Run `python scripts/setup_bot.py` to find your ID

### 3. Configure
Edit `config/settings.yaml`:
```yaml
owner:
  telegram_id: YOUR_ID
  telegram_bot_token: "YOUR_BOT_TOKEN"
```

### 4. Add GitHub Secrets
In your repo Settings > Secrets, add:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_OWNER_ID`

### 5. Start Using
- Send `/start` to your Telegram bot
- Use `/newarticle` to create content
- Use `/addlink` to add affiliate links
- Use `/publish` to deploy your blog

## Project Structure

```
bot/          - Telegram bot (your phone remote control)
content/      - Content generation engine & templates
affiliate/    - Affiliate link management & tracking
blog/         - Static site builder & themes
social/       - Social media posting (Twitter, Medium, Blogger)
pinterest/    - Pinterest pin automation (image gen, scheduling, analytics)
analytics/    - Views, clicks, and earnings tracking
scripts/      - Automation workflow entry points
.github/      - GitHub Actions for daily automation
config/       - All configuration files
data/         - Generated content & analytics data
```

## Revenue Streams

1. **Affiliate Commissions** - Amazon Associates, Flipkart Affiliate
2. **Google AdSense** - Display ads on your blog
3. **Sponsored Content** - Once you build an audience

## How It Works

1. You input product details via Telegram bot
2. System generates SEO-optimized articles using templates
3. Affiliate links are auto-inserted into content
4. Blog is built and deployed to GitHub Pages (free)
5. Articles are shared on social media automatically
6. Weekly analytics reports sent to your Telegram

## Requirements

- Python 3.9+
- A phone with Telegram
- GitHub account (free)

## Installation

```bash
pip install -r requirements.txt
```

## Running Locally

```bash
# Run the Telegram bot
python -m bot.main

# Generate content manually
python scripts/daily_run.py

# Build the blog
python -m blog.builder
```

## Pinterest Automation

The Pinterest module generates eye-catching pin images and auto-posts them:

```bash
# Telegram bot commands
/newpin        - Create a product, quote, or list pin
/pinterest     - Pinterest menu
/pinschedule   - View pin posting queue
/pinstats      - View Pinterest analytics
/boards        - Manage Pinterest boards
```

### Pin Types
- **Product Pins** - Product showcase with image, price, features, CTA
- **Quote Pins** - Tips and advice pins (great for engagement)
- **List Pins** - Top-N listicle infographic pins

### Setup Pinterest
1. Create a Pinterest Business account (free)
2. Go to developers.pinterest.com, create an app
3. Get your access token
4. Add `PINTEREST_ACCESS_TOKEN` to GitHub Secrets

## Deploy Bot (FREE — Required for Bot to Work)

The bot needs to run on a server to respond to your Telegram messages. Use **Render.com** (free, no credit card needed):

### One-Click Deploy on Render.com
1. Go to **render.com** → Sign up with GitHub
2. Click **"New"** → **"Web Service"**
3. Connect your repo: `lolgemayur1997-wq/Anthropic-claude-code`
4. Branch: `claude/passive-income-automation-YBso9`
5. It auto-detects the Dockerfile
6. Add environment variables:
   - `TELEGRAM_BOT_TOKEN` = your bot token
   - `TELEGRAM_OWNER_ID` = your user ID
   - `PINTEREST_ACCESS_TOKEN` = your Pinterest token
7. Click **Deploy** — bot goes live in 2 minutes!

### Register Commands (Run Once)
After deploying, register commands so they show in Telegram's menu:
```bash
TELEGRAM_BOT_TOKEN="your_token" python scripts/register_commands.py
```

### Alternative: Railway.app
1. Go to **railway.app** → Sign up with GitHub
2. New Project → Deploy from repo
3. Add the same environment variables
4. Auto-deploys from the Procfile

## License

MIT
