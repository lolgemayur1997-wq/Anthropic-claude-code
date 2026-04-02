"""One-time bot setup script.

Run this to verify your bot token and get your Telegram user ID.
"""

import os
import sys

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def verify_bot_token(token):
    """Verify the bot token is valid."""
    resp = requests.get(
        f"https://api.telegram.org/bot{token}/getMe",
        timeout=10,
    )
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok"):
            bot = data["result"]
            print(f"Bot verified: @{bot['username']} ({bot['first_name']})")
            return True
    print("Invalid bot token!")
    return False


def get_updates(token):
    """Get recent messages to find your user ID."""
    resp = requests.get(
        f"https://api.telegram.org/bot{token}/getUpdates",
        timeout=10,
    )
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok") and data.get("result"):
            for update in data["result"]:
                msg = update.get("message", {})
                user = msg.get("from", {})
                if user:
                    print(f"\nFound user: {user.get('first_name', 'Unknown')}")
                    print(f"Your Telegram ID: {user['id']}")
                    print(
                        f"\nAdd this to config/settings.yaml:\n"
                        f"  telegram_id: {user['id']}"
                    )
                    return user["id"]
        print("\nNo messages found. Send /start to your bot first, then run this again.")
    return None


def main():
    token = os.environ.get("TELEGRAM_BOT_TOKEN")

    if not token:
        token = input("Enter your bot token (from @BotFather): ").strip()

    if not token:
        print("No token provided!")
        return

    print("Verifying bot token...")
    if verify_bot_token(token):
        print("\nLooking for your user ID...")
        print("(Make sure you've sent /start to your bot first)")
        get_updates(token)


if __name__ == "__main__":
    main()
