"""Simple JSON file-based storage for analytics data."""

import json
import os
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def load_json(filename):
    """Load a JSON file from the data directory."""
    path = os.path.join(os.path.abspath(DATA_DIR), filename)
    if not os.path.exists(path):
        return {}
    with open(path, "r") as f:
        return json.load(f)


def save_json(filename, data):
    """Save data to a JSON file in the data directory."""
    path = os.path.join(os.path.abspath(DATA_DIR), filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def append_daily_stat(stat_data):
    """Append a daily stat entry."""
    analytics = load_json("analytics.json")
    if "daily_stats" not in analytics:
        analytics["daily_stats"] = []

    stat_data["date"] = datetime.now().strftime("%Y-%m-%d")
    analytics["daily_stats"].append(stat_data)
    save_json("analytics.json", analytics)
