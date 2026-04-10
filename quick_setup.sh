#!/bin/bash
# Quick Setup - Run with your tokens
#
# Usage:
#   bash quick_setup.sh "BOT_TOKEN" "USER_ID" "PINTEREST_TOKEN" "AMAZON_TAG"
#
# Example:
#   bash quick_setup.sh "7123456:AAHxyz" "987654321" "pina_abc123" "smartpick-21"
#
# You can skip any value by using "" (empty quotes)

BOT_TOKEN="$1"
USER_ID="$2"
PINTEREST_TOKEN="$3"
AMAZON_TAG="$4"

echo ""
echo "=================================="
echo "  SmartPicks Quick Setup"
echo "=================================="
echo ""

# Create .env file
if [ -n "$BOT_TOKEN" ] || [ -n "$PINTEREST_TOKEN" ]; then
    echo "Creating .env file..."
    > .env
    [ -n "$BOT_TOKEN" ] && echo "TELEGRAM_BOT_TOKEN=$BOT_TOKEN" >> .env
    [ -n "$USER_ID" ] && echo "TELEGRAM_OWNER_ID=$USER_ID" >> .env
    [ -n "$PINTEREST_TOKEN" ] && echo "PINTEREST_ACCESS_TOKEN=$PINTEREST_TOKEN" >> .env
    echo "✅ .env created"
fi

# Verify Telegram bot
if [ -n "$BOT_TOKEN" ]; then
    echo ""
    echo "Verifying Telegram bot..."
    RESULT=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe" 2>/dev/null)
    if echo "$RESULT" | grep -q '"ok":true'; then
        BOT_NAME=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['username'])" 2>/dev/null)
        echo "✅ Bot verified: @${BOT_NAME}"
    else
        echo "⚠️  Could not verify bot token"
    fi
fi

# Run Python setup
echo ""
echo "Updating config files..."
python3 -c "
import yaml, os

# Update settings.yaml
with open('config/settings.yaml', 'r') as f:
    s = yaml.safe_load(f)

bot_token = os.environ.get('1', '$BOT_TOKEN')
user_id = '$USER_ID'
amazon_tag = '$AMAZON_TAG'

if '$BOT_TOKEN':
    s['owner']['telegram_bot_token'] = '$BOT_TOKEN'
if '$USER_ID' and '$USER_ID'.isdigit():
    s['owner']['telegram_id'] = int('$USER_ID')

with open('config/settings.yaml', 'w') as f:
    yaml.dump(s, f, default_flow_style=False, sort_keys=False)

# Update pinterest.yaml
if '$PINTEREST_TOKEN':
    with open('config/pinterest.yaml', 'r') as f:
        p = yaml.safe_load(f)
    p['pinterest']['access_token'] = '$PINTEREST_TOKEN'
    with open('config/pinterest.yaml', 'w') as f:
        yaml.dump(p, f, default_flow_style=False, sort_keys=False)

# Update affiliates.yaml
if '$AMAZON_TAG':
    with open('config/affiliates.yaml', 'r') as f:
        a = yaml.safe_load(f)
    a['programs'][0]['tag'] = '$AMAZON_TAG'
    with open('config/affiliates.yaml', 'w') as f:
        yaml.dump(a, f, default_flow_style=False, sort_keys=False)

print('✅ Config files updated')
"

echo ""
echo "=================================="
echo "  DONE! Next steps:"
echo "=================================="
echo ""
echo "  1. Add these GitHub Secrets:"
echo "     TELEGRAM_BOT_TOKEN"
echo "     TELEGRAM_OWNER_ID"
[ -n "$PINTEREST_TOKEN" ] && echo "     PINTEREST_ACCESS_TOKEN"
echo ""
echo "  2. Enable GitHub Pages:"
echo "     Settings → Pages → Branch: main → /docs"
echo ""
echo "  3. Send /start to your Telegram bot!"
echo ""
