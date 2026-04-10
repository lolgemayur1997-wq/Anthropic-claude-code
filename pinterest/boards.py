"""Pinterest board management."""

import os
import yaml

from pinterest.api import list_boards, create_board, get_board_pins, is_configured


def _get_board_config():
    """Load board configuration."""
    config_path = os.path.join(
        os.path.dirname(__file__), "..", "config", "pinterest.yaml"
    )
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            config = yaml.safe_load(f)
        return config.get("pinterest", {}).get("boards", {})
    return {}


def get_configured_boards():
    """Get all boards defined in config, grouped by niche."""
    return _get_board_config()


def get_boards_for_niche(niche):
    """Get board names for a specific niche."""
    boards = _get_board_config()
    return boards.get(niche, [])


def ensure_boards_exist(niche=None):
    """Create any boards from config that don't exist on Pinterest yet.

    Args:
        niche: If specified, only create boards for this niche.
               If None, create all configured boards.

    Returns:
        List of (board_name, board_id, created) tuples.
    """
    if not is_configured():
        return []

    existing = list_boards()
    existing_names = {b["name"].lower() for b in existing}
    existing_map = {b["name"].lower(): b["id"] for b in existing}

    board_config = _get_board_config()
    results = []

    niches = [niche] if niche else board_config.keys()

    for n in niches:
        board_names = board_config.get(n, [])
        for name in board_names:
            if name.lower() in existing_names:
                results.append((name, existing_map[name.lower()], False))
            else:
                desc = f"Best {n.replace('_', ' ')} reviews, deals, and recommendations"
                board = create_board(name, description=desc)
                if board:
                    results.append((name, board["id"], True))

    return results


def get_board_id_by_name(name):
    """Find a board's ID by its name.

    Returns board_id string or None.
    """
    if not is_configured():
        return None

    boards = list_boards()
    for board in boards:
        if board["name"].lower() == name.lower():
            return board["id"]
    return None


def get_board_pin_count(board_id):
    """Get the number of pins on a board."""
    pins = get_board_pins(board_id)
    return len(pins)


def get_all_board_stats():
    """Get stats for all boards.

    Returns list of dicts with board name, id, and pin count.
    """
    if not is_configured():
        return []

    boards = list_boards()
    stats = []
    for board in boards:
        stats.append({
            "name": board["name"],
            "id": board["id"],
            "pin_count": board.get("pin_count", 0),
        })
    return stats
