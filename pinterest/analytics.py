"""Pinterest analytics - track pin performance."""

import json
import os
from datetime import datetime, timedelta

from pinterest.api import get_pin_analytics, is_configured

PINS_DB = os.path.join(os.path.dirname(__file__), "..", "data", "pins.json")


def _load_pins():
    path = os.path.abspath(PINS_DB)
    if not os.path.exists(path):
        return []
    with open(path, "r") as f:
        return json.load(f)


def _save_pins(pins):
    path = os.path.abspath(PINS_DB)
    with open(path, "w") as f:
        json.dump(pins, f, indent=2)


def refresh_analytics():
    """Fetch latest analytics from Pinterest API for all tracked pins.

    Returns number of pins updated.
    """
    if not is_configured():
        return 0

    pins = _load_pins()
    updated = 0

    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

    for pin in pins:
        pid = pin.get("pinterest_id")
        if not pid:
            continue

        analytics = get_pin_analytics(pid, start_date=start_date, end_date=end_date)
        if analytics:
            # Sum up metrics across the date range
            for metric_type, daily_data in analytics.items():
                total = sum(daily_data.values()) if isinstance(daily_data, dict) else 0
                metric_key = metric_type.lower()
                if metric_key == "impression":
                    pin["impressions"] = total
                elif metric_key == "save":
                    pin["saves"] = total
                elif metric_key == "pin_click":
                    pin["clicks"] = total
                elif metric_key == "outbound_click":
                    pin["outbound_clicks"] = total
            updated += 1

    _save_pins(pins)
    return updated


def get_top_pins(metric="clicks", limit=10):
    """Get top-performing pins by a metric.

    Args:
        metric: 'clicks', 'impressions', 'saves'
        limit: Number of pins to return
    """
    pins = _load_pins()
    sorted_pins = sorted(pins, key=lambda p: p.get(metric, 0), reverse=True)
    return sorted_pins[:limit]


def get_niche_stats():
    """Get aggregated stats by niche."""
    pins = _load_pins()
    stats = {}

    for pin in pins:
        niche = pin.get("niche", "default")
        if niche not in stats:
            stats[niche] = {
                "pins": 0,
                "impressions": 0,
                "saves": 0,
                "clicks": 0,
            }
        stats[niche]["pins"] += 1
        stats[niche]["impressions"] += pin.get("impressions", 0)
        stats[niche]["saves"] += pin.get("saves", 0)
        stats[niche]["clicks"] += pin.get("clicks", 0)

    return stats


def get_board_stats():
    """Get aggregated stats by board."""
    pins = _load_pins()
    stats = {}

    for pin in pins:
        board = pin.get("board_id", "unknown")
        if board not in stats:
            stats[board] = {"pins": 0, "impressions": 0, "saves": 0, "clicks": 0}
        stats[board]["pins"] += 1
        stats[board]["impressions"] += pin.get("impressions", 0)
        stats[board]["saves"] += pin.get("saves", 0)
        stats[board]["clicks"] += pin.get("clicks", 0)

    return stats


def get_overall_stats():
    """Get overall Pinterest performance summary."""
    pins = _load_pins()
    total_pins = len(pins)
    total_impressions = sum(p.get("impressions", 0) for p in pins)
    total_saves = sum(p.get("saves", 0) for p in pins)
    total_clicks = sum(p.get("clicks", 0) for p in pins)

    ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
    save_rate = (total_saves / total_impressions * 100) if total_impressions > 0 else 0

    return {
        "total_pins": total_pins,
        "total_impressions": total_impressions,
        "total_saves": total_saves,
        "total_clicks": total_clicks,
        "click_through_rate": round(ctr, 2),
        "save_rate": round(save_rate, 2),
    }


def generate_weekly_report():
    """Generate a formatted weekly report for Telegram."""
    stats = get_overall_stats()
    niche_stats = get_niche_stats()
    top = get_top_pins("clicks", 5)

    report = (
        f"📌 *Pinterest Weekly Report*\n"
        f"*{datetime.now().strftime('%d %b %Y')}*\n\n"
        f"📊 *Overall Stats:*\n"
        f"  Pins: {stats['total_pins']}\n"
        f"  Impressions: {stats['total_impressions']:,}\n"
        f"  Saves: {stats['total_saves']:,}\n"
        f"  Clicks: {stats['total_clicks']:,}\n"
        f"  CTR: {stats['click_through_rate']}%\n"
        f"  Save Rate: {stats['save_rate']}%\n"
    )

    if niche_stats:
        report += "\n📁 *By Niche:*\n"
        for niche, ns in niche_stats.items():
            report += (
                f"  *{niche.replace('_', ' ').title()}*: "
                f"{ns['pins']} pins, {ns['clicks']} clicks\n"
            )

    if top:
        report += "\n🔝 *Top Pins (by clicks):*\n"
        for i, pin in enumerate(top, 1):
            report += f"  {i}. {pin['title'][:40]} — {pin.get('clicks', 0)} clicks\n"

    report += (
        "\n💡 *Tips:*\n"
        "• Create more pins in your best-performing niche\n"
        "• Re-pin top performers to new boards\n"
        "• Test different color schemes and titles"
    )

    return report
