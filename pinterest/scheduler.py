"""Pinterest pin scheduling and queue management."""

import json
import os
import random
import time
from datetime import datetime

import yaml

from pinterest.api import create_pin, create_pin_with_base64, is_configured
from pinterest.pin_generator import image_to_base64

QUEUE_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "pin_queue.json")
PINS_DB = os.path.join(os.path.dirname(__file__), "..", "data", "pins.json")


def _load_queue():
    path = os.path.abspath(QUEUE_FILE)
    if not os.path.exists(path):
        return {"pending": [], "posted": []}
    with open(path, "r") as f:
        return json.load(f)


def _save_queue(data):
    path = os.path.abspath(QUEUE_FILE)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _load_pins_db():
    path = os.path.abspath(PINS_DB)
    if not os.path.exists(path):
        return []
    with open(path, "r") as f:
        return json.load(f)


def _save_pins_db(pins):
    path = os.path.abspath(PINS_DB)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(pins, f, indent=2)


def _get_config():
    config_path = os.path.join(
        os.path.dirname(__file__), "..", "config", "pinterest.yaml"
    )
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            return yaml.safe_load(f).get("pinterest", {})
    return {}


def add_to_queue(title, description, board_id, link=None, image_path=None,
                 image_base64=None, pin_type="product", niche="default"):
    """Add a pin to the scheduling queue.

    Args:
        title: Pin title
        description: Pin description
        board_id: Target board ID
        link: Destination URL (affiliate/landing page)
        image_path: Path to local pin image
        image_base64: Base64-encoded image (alternative to path)
        pin_type: 'product', 'quote', or 'list'
        niche: Content niche

    Returns the queued pin dict.
    """
    queue = _load_queue()

    pin_data = {
        "id": f"pin_{int(datetime.now().timestamp())}_{random.randint(100, 999)}",
        "title": title,
        "description": description,
        "board_id": board_id,
        "link": link or "",
        "image_path": image_path or "",
        "image_base64": image_base64 or "",
        "pin_type": pin_type,
        "niche": niche,
        "status": "pending",
        "queued_at": datetime.now().isoformat(),
        "posted_at": None,
        "pinterest_pin_id": None,
    }

    queue["pending"].append(pin_data)
    _save_queue(queue)
    return pin_data


def get_pending_pins():
    """Get all pending pins in the queue."""
    queue = _load_queue()
    return queue.get("pending", [])


def get_posted_pins(limit=50):
    """Get recently posted pins."""
    queue = _load_queue()
    posted = queue.get("posted", [])
    return posted[-limit:]


def process_queue(max_pins=8):
    """Process pending pins — post them to Pinterest.

    Args:
        max_pins: Maximum pins to post in this batch

    Returns:
        Dict with success/failure counts.
    """
    if not is_configured():
        return {"posted": 0, "failed": 0, "error": "Pinterest not configured"}

    queue = _load_queue()
    pending = queue.get("pending", [])
    config = _get_config()
    min_interval = config.get("min_interval_seconds", 60)

    results = {"posted": 0, "failed": 0, "pins": []}

    for pin_data in pending[:max_pins]:
        try:
            # Determine image source
            if pin_data.get("image_base64"):
                result = create_pin_with_base64(
                    board_id=pin_data["board_id"],
                    title=pin_data["title"],
                    description=pin_data["description"],
                    image_base64=pin_data["image_base64"],
                    link=pin_data.get("link"),
                )
            elif pin_data.get("image_path") and os.path.exists(pin_data["image_path"]):
                # Convert local image to base64
                from PIL import Image
                import io
                import base64

                img = Image.open(pin_data["image_path"])
                buffer = io.BytesIO()
                img.save(buffer, format="JPEG", quality=85)
                b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

                result = create_pin_with_base64(
                    board_id=pin_data["board_id"],
                    title=pin_data["title"],
                    description=pin_data["description"],
                    image_base64=b64,
                    link=pin_data.get("link"),
                )
            else:
                results["failed"] += 1
                continue

            if result:
                pin_data["status"] = "posted"
                pin_data["posted_at"] = datetime.now().isoformat()
                pin_data["pinterest_pin_id"] = result.get("id")
                queue["posted"].append(pin_data)
                results["posted"] += 1
                results["pins"].append(pin_data["title"])

                # Record in pins database
                pins_db = _load_pins_db()
                pins_db.append({
                    "pinterest_id": result.get("id"),
                    "title": pin_data["title"],
                    "board_id": pin_data["board_id"],
                    "link": pin_data.get("link", ""),
                    "pin_type": pin_data.get("pin_type", "product"),
                    "niche": pin_data.get("niche", "default"),
                    "posted_at": pin_data["posted_at"],
                    "impressions": 0,
                    "saves": 0,
                    "clicks": 0,
                })
                _save_pins_db(pins_db)
            else:
                results["failed"] += 1

            # Rate limiting
            time.sleep(min_interval)

        except Exception as e:
            results["failed"] += 1

    # Remove posted pins from pending
    posted_ids = {p["id"] for p in queue.get("posted", []) if p.get("posted_at")}
    queue["pending"] = [p for p in queue["pending"] if p["id"] not in posted_ids]
    _save_queue(queue)

    return results


def get_queue_stats():
    """Get queue statistics."""
    queue = _load_queue()
    return {
        "pending": len(queue.get("pending", [])),
        "posted_today": sum(
            1 for p in queue.get("posted", [])
            if p.get("posted_at", "").startswith(datetime.now().strftime("%Y-%m-%d"))
        ),
        "posted_total": len(queue.get("posted", [])),
    }


def clear_pending():
    """Clear all pending pins from the queue."""
    queue = _load_queue()
    cleared = len(queue.get("pending", []))
    queue["pending"] = []
    _save_queue(queue)
    return cleared
