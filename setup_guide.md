# Setup Guide - Phone Only

This guide helps you set up the entire system using just your phone.

## Step 1: Install Apps

**Required (free):**
- Telegram (for bot control)
- GitHub Mobile App (for code and deployment)
- A web browser

**Optional:**
- Termux (Android) - for running Python on phone
- iSH (iOS) - for running Python on phone

## Step 2: Create Your Telegram Bot

1. Open Telegram
2. Search for `@BotFather`
3. Send `/newbot`
4. Choose a name (e.g., "SmartPicks Bot")
5. Choose a username (e.g., "smartpicks_bot")
6. **Save the token** BotFather gives you

## Step 3: Get Your Telegram User ID

1. Search for `@userinfobot` on Telegram
2. Send `/start`
3. It will reply with your **User ID** (a number)
4. **Save this number**

## Step 4: Fork/Clone This Repository

Using GitHub Mobile App:
1. Go to the repository
2. Fork it to your account
3. Enable GitHub Pages in Settings > Pages > Source: Deploy from branch > `main` > `/docs`

## Step 5: Add Secrets

In GitHub Mobile App:
1. Go to your repo Settings
2. Go to Secrets > Actions
3. Add these secrets:
   - `TELEGRAM_BOT_TOKEN` = your bot token from Step 2
   - `TELEGRAM_OWNER_ID` = your user ID from Step 3

## Step 6: Update Config

Edit `config/settings.yaml` via GitHub's web editor:
1. Set your `telegram_id`
2. Customize your blog `name` and `tagline`
3. Update `niches` with topics you want to write about
4. Set your blog `url` to `https://YOUR_USERNAME.github.io/YOUR_REPO`

## Step 7: Sign Up for Affiliate Programs

**Free to join:**
1. **Amazon Associates** - associates.amazon.in
   - Add your tag to `config/affiliates.yaml`
2. **Flipkart Affiliate** - affiliate.flipkart.com
3. **Other options**: CJ Affiliate, ShareASale

## Step 8: Start Creating Content!

1. Open Telegram
2. Send `/start` to your bot
3. Use `/addlink` to add your first affiliate link
4. Use `/newarticle` to create your first article
5. Use `/publish` to build and deploy your blog

## Step 9: Enable Automation

The GitHub Actions workflows will automatically:
- Generate 1 article per day (4:00 AM IST)
- Post to social media every 6 hours
- Send weekly analytics report on Sundays

## Tips for Success

1. **Start with ONE niche** you know well
2. **Add real product details** - honest reviews perform better
3. **Be consistent** - let the automation run daily
4. **Check analytics weekly** - double down on what works
5. **Apply for AdSense** after 30+ articles
6. **Engage on social media** - reply to comments, build community

## Troubleshooting

**Bot not responding?**
- Check your bot token in GitHub Secrets
- Ensure your Telegram ID is correct in config

**Blog not deploying?**
- Check GitHub Pages is enabled in repo settings
- Check GitHub Actions tab for errors

**No affiliate earnings?**
- It takes 3-6 months to build traffic
- Focus on SEO and consistent content
- Share on social media actively
