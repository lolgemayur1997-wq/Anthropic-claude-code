"""Affiliate link manager - CRUD operations on JSON storage."""

import json
import os
from datetime import datetime

DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "links.json")


def _load_links():
    """Load affiliate links from JSON file."""
    path = os.path.abspath(DATA_FILE)
    if not os.path.exists(path):
        return []
    with open(path, "r") as f:
        return json.load(f)


def _save_links(links):
    """Save affiliate links to JSON file."""
    path = os.path.abspath(DATA_FILE)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(links, f, indent=2)


def add_link(product_name, url, category, program="amazon", commission_rate=0):
    """Add a new affiliate link.

    Returns the created link dict.
    """
    links = _load_links()
    link_id = f"link_{len(links) + 1}_{int(datetime.now().timestamp())}"
    short_slug = product_name.lower().replace(" ", "-")[:50]

    new_link = {
        "id": link_id,
        "product_name": product_name,
        "url": url,
        "short_slug": short_slug,
        "category": category,
        "program": program,
        "commission_rate": commission_rate,
        "clicks": 0,
        "added_date": datetime.now().isoformat(),
    }
    links.append(new_link)
    _save_links(links)
    return new_link


def get_links(category=None, program=None):
    """Get affiliate links, optionally filtered by category or program."""
    links = _load_links()
    if category:
        links = [l for l in links if l["category"] == category]
    if program:
        links = [l for l in links if l["program"] == program]
    return links


def get_link_by_id(link_id):
    """Get a single link by its ID."""
    links = _load_links()
    for link in links:
        if link["id"] == link_id:
            return link
    return None


def get_link_by_slug(slug):
    """Get a single link by its short slug."""
    links = _load_links()
    for link in links:
        if link["short_slug"] == slug:
            return link
    return None


def update_link(link_id, **kwargs):
    """Update fields of an existing link."""
    links = _load_links()
    for link in links:
        if link["id"] == link_id:
            for key, value in kwargs.items():
                if key in link:
                    link[key] = value
            _save_links(links)
            return link
    return None


def delete_link(link_id):
    """Delete an affiliate link by ID."""
    links = _load_links()
    original_count = len(links)
    links = [l for l in links if l["id"] != link_id]
    if len(links) < original_count:
        _save_links(links)
        return True
    return False


def increment_clicks(link_id):
    """Increment the click counter for a link."""
    links = _load_links()
    for link in links:
        if link["id"] == link_id:
            link["clicks"] = link.get("clicks", 0) + 1
            _save_links(links)
            return link["clicks"]
    return 0


def get_categories():
    """Get all unique categories."""
    links = _load_links()
    return list(set(l["category"] for l in links))


def get_stats():
    """Get summary stats of all affiliate links."""
    links = _load_links()
    total_clicks = sum(l.get("clicks", 0) for l in links)
    categories = get_categories()
    return {
        "total_links": len(links),
        "total_clicks": total_clicks,
        "categories": categories,
        "by_program": {},
    }
