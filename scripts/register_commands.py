"""Register bot commands with Telegram so they appear in the command menu.

Run this ONCE after setting up your bot:
    TELEGRAM_BOT_TOKEN="your_token" python scripts/register_commands.py

Or if token is in config/settings.yaml, just:
    python scripts/register_commands.py
"""

import os
import sys
import json

import requests
import yaml

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# All bot commands to register
COMMANDS = [
    {"command": "start", "description": "Show main menu"},
    {"command": "help", "description": "Show all commands"},
    {"command": "newpin", "description": "Create a Pinterest pin"},
    {"command": "pinterest", "description": "Pinterest menu"},
    {"command": "pinschedule", "description": "View pin posting queue"},
    {"command": "pinstats", "description": "Pinterest analytics"},
    {"command": "boards", "description": "Manage Pinterest boards"},
    {"command": "newarticle", "description": "Create a blog article"},
    {"command": "addlink", "description": "Add an affiliate link"},
    {"command": "listlinks", "description": "View all affiliate links"},
    {"command": "publish", "description": "Build & publish blog"},
    {"command": "postnow", "description": "Post to social media"},
    {"command": "stats", "description": "View analytics"},
]


def get_token():
    """Get bot token from env or config."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if token:
        return token

    config_path = os.path.join(
        os.path.dirname(__file__), "..", "config", "settings.yaml"
    )
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            config = yaml.safe_load(f)
        return config.get("owner", {}).get("telegram_bot_token", "")

    return ""


def register_commands(token):
    """Register all commands with the Telegram Bot API."""
    url = f"https://api.telegram.org/bot{token}/setMyCommands"
    data = {"commands": json.dumps(COMMANDS)}

    resp = requests.post(url, data=data, timeout=10)

    if resp.status_code == 200 and resp.json().get("ok"):
        print("✅ Commands registered successfully!")
        print("")
        print("Commands now available in Telegram:")
        for cmd in COMMANDS:
            print(f"  /{cmd['command']} — {cmd['description']}")
        return True
    else:
        print(f"❌ Failed to register commands: {resp.text}")
        return False


def verify_bot(token):
    """Verify the bot token is valid."""
    url = f"https://api.telegram.org/bot{token}/getMe"
    resp = requests.get(url, timeout=10)

    if resp.status_code == 200 and resp.json().get("ok"):
        bot = resp.json()["result"]
        print(f"✅ Bot verified: @{bot['username']} ({bot['first_name']})")
        return True
    else:
        print("❌ Invalid bot token!")
        return False


def main():
    token = get_token()

    if not token or token == "BOT_TOKEN_HERE":
        print("❌ No bot token found!")
        print("")
        print("Set it via:")
        print('  export TELEGRAM_BOT_TOKEN="your_token_here"')
        print("  python scripts/register_commands.py")
        print("")
        print("Or update config/settings.yaml with your token.")
        sys.exit(1)

    print("Verifying bot...")
    if not verify_bot(token):
        sys.exit(1)

    print("")
    print("Registering commands...")
    if register_commands(token):
        print("")
        print("🎉 Done! Open Telegram, type '/' in your bot chat,")
        print("   and you'll see all commands in the menu!")
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
