"""Analytics report workflow.

Called by GitHub Actions weekly.
Sends report to Telegram.
"""

import os
import sys

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from analytics.reporter import generate_weekly_report


def send_telegram_message(text, bot_token, chat_id):
    """Send a message via Telegram Bot API."""
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    data = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
    }
    resp = requests.post(url, json=data, timeout=10)
    return resp.status_code == 200


def run_analytics_pipeline():
    """Generate and send the weekly analytics report."""
    report = generate_weekly_report()
    print(report)

    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    owner_id = os.environ.get("TELEGRAM_OWNER_ID")

    if bot_token and owner_id:
        success = send_telegram_message(report, bot_token, owner_id)
        if success:
            print("Report sent to Telegram!")
        else:
            print("Failed to send Telegram message")
    else:
        print("Telegram not configured - report printed above")

    return report


if __name__ == "__main__":
    run_analytics_pipeline()
