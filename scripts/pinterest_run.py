"""Pinterest pin posting workflow.

Called by GitHub Actions 3x daily (9AM, 2PM, 8PM IST).
Processes the pin queue and posts pending pins to Pinterest.
"""

import os
import sys

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pinterest.scheduler import process_queue, get_queue_stats
from pinterest.api import is_configured


def send_telegram_message(text, bot_token, chat_id):
    """Send a notification via Telegram."""
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    data = {"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
    resp = requests.post(url, json=data, timeout=10)
    return resp.status_code == 200


def run_pinterest_pipeline():
    """Process pending Pinterest pins."""
    if not is_configured():
        print("Pinterest not configured. Set PINTEREST_ACCESS_TOKEN.")
        return

    stats_before = get_queue_stats()
    print(f"Queue: {stats_before['pending']} pending pins")

    if stats_before["pending"] == 0:
        print("No pins to post.")
        return

    results = process_queue(max_pins=8)

    print(f"Posted: {results['posted']}, Failed: {results['failed']}")

    # Send Telegram notification
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    owner_id = os.environ.get("TELEGRAM_OWNER_ID")

    if bot_token and owner_id and results["posted"] > 0:
        msg = (
            f"📌 *Pinterest Update*\n\n"
            f"✅ Posted: {results['posted']} pins\n"
            f"❌ Failed: {results['failed']}\n"
        )
        if results.get("pins"):
            msg += "\n*Pins posted:*\n"
            for title in results["pins"][:5]:
                msg += f"  • {title}\n"

        send_telegram_message(msg, bot_token, owner_id)

    return results


if __name__ == "__main__":
    run_pinterest_pipeline()
