"""Social media post scheduler."""

import os
from datetime import datetime

import yaml

from social.poster import get_pending_posts, mark_published
from social.platforms.twitter import post_tweet
from social.platforms.medium import post_article as medium_post
from social.platforms.blogger import post_article as blogger_post


def _get_config():
    config_path = os.path.join(
        os.path.dirname(__file__), "..", "config", "settings.yaml"
    )
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            return yaml.safe_load(f)
    return {}


def process_pending_posts():
    """Process all pending scheduled posts.

    Returns dict with counts of successful/failed posts per platform.
    """
    results = {"twitter": 0, "medium": 0, "blogger": 0, "errors": 0}

    # Process Twitter posts
    for post in get_pending_posts("twitter"):
        try:
            tweet_id = post_tweet(post["content"])
            if tweet_id:
                mark_published(post["id"], result={"tweet_id": tweet_id})
                results["twitter"] += 1
            else:
                results["errors"] += 1
        except Exception:
            results["errors"] += 1

    # Process Medium posts
    for post in get_pending_posts("medium"):
        try:
            content = post["content"]
            if isinstance(content, dict):
                url = medium_post(
                    content.get("title", ""),
                    content.get("html", ""),
                    content.get("tags"),
                )
            else:
                results["errors"] += 1
                continue

            if url:
                mark_published(post["id"], result={"url": url})
                results["medium"] += 1
            else:
                results["errors"] += 1
        except Exception:
            results["errors"] += 1

    # Process Blogger posts
    for post in get_pending_posts("blogger"):
        try:
            content = post["content"]
            if isinstance(content, dict):
                url = blogger_post(
                    content.get("title", ""),
                    content.get("html", ""),
                    content.get("labels"),
                )
            else:
                results["errors"] += 1
                continue

            if url:
                mark_published(post["id"], result={"url": url})
                results["blogger"] += 1
            else:
                results["errors"] += 1
        except Exception:
            results["errors"] += 1

    return results
