"""SEO utilities - keyword research using free Google autocomplete API."""

import json
import urllib.parse
import urllib.request


def get_keyword_suggestions(seed_keyword, language="en", country="in"):
    """Get keyword suggestions from Google Autocomplete.

    Args:
        seed_keyword: The base keyword to get suggestions for
        language: Language code (default: 'en')
        country: Country code (default: 'in' for India)

    Returns:
        List of suggested keywords
    """
    encoded = urllib.parse.quote(seed_keyword)
    url = (
        f"http://suggestqueries.google.com/complete/search?"
        f"client=firefox&q={encoded}&hl={language}&gl={country}"
    )

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
            if len(data) >= 2:
                return data[1]
    except Exception:
        pass

    return []


def generate_long_tail_keywords(seed_keyword):
    """Generate long-tail keyword variations.

    Appends common modifiers to the seed keyword and fetches suggestions.
    """
    modifiers = [
        "best", "top", "review", "under", "vs",
        "buy", "cheap", "india", "online", "2026",
    ]

    all_keywords = set()
    for modifier in modifiers:
        query = f"{seed_keyword} {modifier}"
        suggestions = get_keyword_suggestions(query)
        all_keywords.update(suggestions)

    return sorted(all_keywords)


def generate_meta_tags(title, description, keywords=None):
    """Generate HTML meta tags for SEO.

    Returns a dict with meta tag values.
    """
    return {
        "title": title[:60],
        "description": description[:160],
        "keywords": ", ".join(keywords) if keywords else "",
        "og_title": title[:60],
        "og_description": description[:160],
    }


def generate_slug(title):
    """Generate a URL-friendly slug from a title."""
    import re

    slug = title.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug[:80]
