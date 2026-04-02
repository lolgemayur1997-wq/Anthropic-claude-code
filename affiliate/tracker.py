"""Affiliate link click tracking."""

import json
import os
from datetime import datetime

from affiliate.manager import get_link_by_slug, increment_clicks

ANALYTICS_FILE = os.path.join(
    os.path.dirname(__file__), "..", "data", "analytics.json"
)


def _load_analytics():
    path = os.path.abspath(ANALYTICS_FILE)
    if not os.path.exists(path):
        return {"page_views": {}, "link_clicks": {}, "daily_stats": []}
    with open(path, "r") as f:
        return json.load(f)


def _save_analytics(data):
    path = os.path.abspath(ANALYTICS_FILE)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def record_click(link_id):
    """Record a click on an affiliate link."""
    analytics = _load_analytics()

    # Update link-level clicks
    if link_id not in analytics["link_clicks"]:
        analytics["link_clicks"][link_id] = []

    analytics["link_clicks"][link_id].append(
        {"timestamp": datetime.now().isoformat()}
    )

    # Also increment in the links database
    increment_clicks(link_id)

    _save_analytics(analytics)


def record_page_view(page_slug):
    """Record a page view."""
    analytics = _load_analytics()

    if page_slug not in analytics["page_views"]:
        analytics["page_views"][page_slug] = 0

    analytics["page_views"][page_slug] += 1
    _save_analytics(analytics)


def get_click_stats(days=30):
    """Get click statistics for the last N days."""
    analytics = _load_analytics()
    total_clicks = sum(len(clicks) for clicks in analytics["link_clicks"].values())
    top_links = sorted(
        analytics["link_clicks"].items(),
        key=lambda x: len(x[1]),
        reverse=True,
    )[:10]

    return {
        "total_clicks": total_clicks,
        "top_links": [
            {"link_id": lid, "clicks": len(clicks)} for lid, clicks in top_links
        ],
    }


def get_page_view_stats():
    """Get page view statistics."""
    analytics = _load_analytics()
    views = analytics.get("page_views", {})
    total = sum(views.values())
    top_pages = sorted(views.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "total_views": total,
        "top_pages": [{"page": p, "views": v} for p, v in top_pages],
    }
