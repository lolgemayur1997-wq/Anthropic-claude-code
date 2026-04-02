"""Medium article posting."""

import os
import json

import requests
import yaml


def _get_token():
    """Get Medium integration token."""
    token = os.environ.get("MEDIUM_TOKEN")
    if token:
        return token

    config_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "config", "settings.yaml"
    )
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            config = yaml.safe_load(f)
        return config.get("social", {}).get("medium", {}).get("token", "")

    return ""


def _get_user_id(token):
    """Get the authenticated user's Medium ID."""
    resp = requests.get(
        "https://api.medium.com/v1/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    if resp.status_code == 200:
        return resp.json().get("data", {}).get("id")
    return None


def post_article(title, content_html, tags=None, canonical_url=None):
    """Post an article to Medium.

    Args:
        title: Article title
        content_html: HTML content
        tags: List of tags (max 5)
        canonical_url: Original article URL (for SEO)

    Returns the Medium post URL on success.
    """
    token = _get_token()
    if not token:
        return None

    user_id = _get_user_id(token)
    if not user_id:
        return None

    data = {
        "title": title,
        "contentFormat": "html",
        "content": content_html,
        "publishStatus": "public",
    }

    if tags:
        data["tags"] = tags[:5]
    if canonical_url:
        data["canonicalUrl"] = canonical_url

    resp = requests.post(
        f"https://api.medium.com/v1/users/{user_id}/posts",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        data=json.dumps(data),
        timeout=15,
    )

    if resp.status_code == 201:
        return resp.json().get("data", {}).get("url")
    return None


def post_latest_article():
    """Post the most recent article to Medium."""
    import glob

    articles_dir = os.path.join(
        os.path.dirname(__file__), "..", "..", "data", "articles"
    )
    articles = sorted(glob.glob(os.path.join(articles_dir, "*.md")), reverse=True)

    if not articles:
        return None

    import frontmatter
    import markdown

    with open(articles[0], "r") as f:
        post = frontmatter.load(f)

    title = post.get("title", "Untitled")
    content_html = markdown.markdown(post.content)
    category = post.get("category", "")

    return post_article(
        title=title,
        content_html=content_html,
        tags=[category, "review", "india", "deals"],
    )
