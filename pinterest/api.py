"""Pinterest API v5 client for pin creation, board management, and analytics."""

import os
import time

import requests
import yaml

API_BASE = "https://api.pinterest.com/v5"


def _get_access_token():
    """Get Pinterest access token from environment or config."""
    token = os.environ.get("PINTEREST_ACCESS_TOKEN")
    if token:
        return token

    config_path = os.path.join(
        os.path.dirname(__file__), "..", "config", "pinterest.yaml"
    )
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            config = yaml.safe_load(f)
        return config.get("pinterest", {}).get("access_token", "")
    return ""


def _headers():
    """Build API request headers."""
    token = _get_access_token()
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _request(method, endpoint, **kwargs):
    """Make an API request with rate limiting."""
    url = f"{API_BASE}{endpoint}"
    kwargs.setdefault("headers", _headers())
    kwargs.setdefault("timeout", 15)

    resp = getattr(requests, method)(url, **kwargs)

    # Handle rate limiting
    if resp.status_code == 429:
        retry_after = int(resp.headers.get("Retry-After", 10))
        time.sleep(retry_after)
        resp = getattr(requests, method)(url, **kwargs)

    return resp


# --- Pin Operations ---

def create_pin(board_id, title, description, media_url, link=None):
    """Create a new pin on a board.

    Args:
        board_id: Pinterest board ID
        title: Pin title (max 100 chars)
        description: Pin description (max 500 chars)
        media_url: URL of the pin image (must be publicly accessible)
        link: Destination URL when pin is clicked (affiliate/landing page)

    Returns:
        Pin data dict on success, None on failure.
    """
    data = {
        "board_id": board_id,
        "title": title[:100],
        "description": description[:500],
        "media_source": {
            "source_type": "image_url",
            "url": media_url,
        },
    }

    if link:
        data["link"] = link

    resp = _request("post", "/pins", json=data)

    if resp.status_code in (200, 201):
        return resp.json()
    return None


def create_pin_with_base64(board_id, title, description, image_base64, link=None):
    """Create a pin using a base64-encoded image.

    Args:
        board_id: Pinterest board ID
        title: Pin title
        description: Pin description
        image_base64: Base64-encoded image data
        link: Destination URL

    Returns:
        Pin data dict on success, None on failure.
    """
    data = {
        "board_id": board_id,
        "title": title[:100],
        "description": description[:500],
        "media_source": {
            "source_type": "image_base64",
            "data": image_base64,
            "content_type": "image/jpeg",
        },
    }

    if link:
        data["link"] = link

    resp = _request("post", "/pins", json=data)

    if resp.status_code in (200, 201):
        return resp.json()
    return None


def get_pin(pin_id):
    """Get pin details."""
    resp = _request("get", f"/pins/{pin_id}")
    if resp.status_code == 200:
        return resp.json()
    return None


def delete_pin(pin_id):
    """Delete a pin."""
    resp = _request("delete", f"/pins/{pin_id}")
    return resp.status_code == 204


def get_pin_analytics(pin_id, metric_types=None, start_date=None, end_date=None):
    """Get analytics for a specific pin.

    Args:
        pin_id: Pinterest pin ID
        metric_types: List of metrics (IMPRESSION, SAVE, PIN_CLICK, OUTBOUND_CLICK)
        start_date: Start date string (YYYY-MM-DD)
        end_date: End date string (YYYY-MM-DD)
    """
    if metric_types is None:
        metric_types = ["IMPRESSION", "SAVE", "PIN_CLICK", "OUTBOUND_CLICK"]

    params = {"metric_types": ",".join(metric_types)}
    if start_date:
        params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date

    resp = _request("get", f"/pins/{pin_id}/analytics", params=params)
    if resp.status_code == 200:
        return resp.json()
    return None


# --- Board Operations ---

def list_boards():
    """List all boards for the authenticated user.

    Returns list of board dicts.
    """
    boards = []
    bookmark = None

    while True:
        params = {"page_size": 25}
        if bookmark:
            params["bookmark"] = bookmark

        resp = _request("get", "/boards", params=params)
        if resp.status_code != 200:
            break

        data = resp.json()
        boards.extend(data.get("items", []))

        bookmark = data.get("bookmark")
        if not bookmark:
            break

    return boards


def create_board(name, description="", privacy="PUBLIC"):
    """Create a new Pinterest board.

    Args:
        name: Board name
        description: Board description
        privacy: PUBLIC or PROTECTED

    Returns board data dict on success.
    """
    data = {
        "name": name[:50],
        "description": description[:500],
        "privacy": privacy,
    }

    resp = _request("post", "/boards", json=data)
    if resp.status_code in (200, 201):
        return resp.json()
    return None


def get_board(board_id):
    """Get board details."""
    resp = _request("get", f"/boards/{board_id}")
    if resp.status_code == 200:
        return resp.json()
    return None


def get_board_pins(board_id, page_size=25):
    """Get all pins on a board."""
    pins = []
    bookmark = None

    while True:
        params = {"page_size": page_size}
        if bookmark:
            params["bookmark"] = bookmark

        resp = _request("get", f"/boards/{board_id}/pins", params=params)
        if resp.status_code != 200:
            break

        data = resp.json()
        pins.extend(data.get("items", []))

        bookmark = data.get("bookmark")
        if not bookmark:
            break

    return pins


# --- User Info ---

def get_user_account():
    """Get the authenticated user's account info."""
    resp = _request("get", "/user_account")
    if resp.status_code == 200:
        return resp.json()
    return None


def is_configured():
    """Check if Pinterest API is configured with a valid token."""
    token = _get_access_token()
    return bool(token) and token != ""
