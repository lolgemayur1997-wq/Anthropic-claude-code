"""Base social media posting interface."""

import os
import json
from datetime import datetime

SCHEDULE_FILE = os.path.join(
    os.path.dirname(__file__), "..", "data", "schedule.json"
)


def _load_schedule():
    path = os.path.abspath(SCHEDULE_FILE)
    if not os.path.exists(path):
        return {"pending_posts": [], "published_posts": []}
    with open(path, "r") as f:
        return json.load(f)


def _save_schedule(data):
    path = os.path.abspath(SCHEDULE_FILE)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def schedule_post(platform, content, post_type="article_share", scheduled_time=None):
    """Add a post to the schedule queue.

    Args:
        platform: 'twitter', 'medium', 'blogger'
        content: The post content (text or dict)
        post_type: Type of post
        scheduled_time: ISO format datetime string (optional)
    """
    schedule = _load_schedule()

    post = {
        "id": f"post_{int(datetime.now().timestamp())}",
        "platform": platform,
        "content": content,
        "post_type": post_type,
        "scheduled_time": scheduled_time or datetime.now().isoformat(),
        "status": "pending",
        "created_at": datetime.now().isoformat(),
    }

    schedule["pending_posts"].append(post)
    _save_schedule(schedule)
    return post


def mark_published(post_id, result=None):
    """Mark a scheduled post as published."""
    schedule = _load_schedule()

    for i, post in enumerate(schedule["pending_posts"]):
        if post["id"] == post_id:
            post["status"] = "published"
            post["published_at"] = datetime.now().isoformat()
            if result:
                post["result"] = result
            schedule["published_posts"].append(post)
            schedule["pending_posts"].pop(i)
            _save_schedule(schedule)
            return True

    return False


def get_pending_posts(platform=None):
    """Get all pending posts, optionally filtered by platform."""
    schedule = _load_schedule()
    posts = schedule.get("pending_posts", [])
    if platform:
        posts = [p for p in posts if p["platform"] == platform]
    return posts


def get_published_count(days=30):
    """Get count of published posts in the last N days."""
    schedule = _load_schedule()
    return len(schedule.get("published_posts", []))
