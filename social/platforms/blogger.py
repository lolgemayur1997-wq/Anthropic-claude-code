"""Google Blogger posting."""

import os
import json

import requests
import yaml


def _get_config():
    """Get Blogger config."""
    config_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "config", "settings.yaml"
    )
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            config = yaml.safe_load(f)
        return config.get("social", {}).get("blogger", {})
    return {}


def post_article(title, content_html, labels=None):
    """Post an article to Blogger.

    Requires Blogger API key and blog ID.

    Args:
        title: Article title
        content_html: HTML content
        labels: List of labels/tags

    Returns the Blogger post URL on success.
    """
    config = _get_config()
    blog_id = os.environ.get("BLOGGER_BLOG_ID", config.get("blog_id", ""))

    if not blog_id:
        return None

    # Note: Full OAuth2 flow is needed for Blogger API.
    # This is a simplified version that works with API keys for public blogs.
    # For production, implement OAuth2.

    api_key = os.environ.get("BLOGGER_API_KEY", config.get("api_key", ""))
    if not api_key:
        return None

    data = {
        "kind": "blogger#post",
        "title": title,
        "content": content_html,
    }

    if labels:
        data["labels"] = labels

    resp = requests.post(
        f"https://www.googleapis.com/blogger/v3/blogs/{blog_id}/posts",
        params={"key": api_key},
        headers={"Content-Type": "application/json"},
        data=json.dumps(data),
        timeout=15,
    )

    if resp.status_code in (200, 201):
        return resp.json().get("url")
    return None
