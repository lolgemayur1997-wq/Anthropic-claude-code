"""Authentication middleware - restricts bot to owner only."""

import os
import yaml


def get_owner_id():
    """Get the owner's Telegram ID from config or environment."""
    # Try environment variable first
    owner_id = os.environ.get("TELEGRAM_OWNER_ID")
    if owner_id:
        return int(owner_id)

    # Fall back to config file
    config_path = os.path.join(
        os.path.dirname(__file__), "..", "config", "settings.yaml"
    )
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            config = yaml.safe_load(f)
        return config.get("owner", {}).get("telegram_id", 0)

    return 0


def is_authorized(user_id):
    """Check if a Telegram user ID is authorized."""
    owner_id = get_owner_id()
    if owner_id == 0:
        # No owner configured - allow all (for initial setup)
        return True
    return user_id == owner_id


def auth_required(func):
    """Decorator to restrict handler to authorized users only."""
    async def wrapper(update, context):
        user_id = update.effective_user.id
        if not is_authorized(user_id):
            await update.message.reply_text(
                "Sorry, you are not authorized to use this bot."
            )
            return
        return await func(update, context)
    return wrapper
