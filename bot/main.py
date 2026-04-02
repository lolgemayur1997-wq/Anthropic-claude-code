"""Telegram bot entry point - SmartPicks Content Automation Bot."""

import os
import logging

import yaml
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    CallbackQueryHandler,
)

from bot.handlers.help import start_command, help_command, menu_callback
from bot.handlers.content import get_article_conversation
from bot.handlers.affiliate import get_addlink_conversation, listlinks_command
from bot.handlers.blog import publish_command, confirm_publish
from bot.handlers.analytics import stats_command
from bot.handlers.social import postnow_command, social_callback

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def get_bot_token():
    """Get bot token from environment or config."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if token:
        return token

    config_path = os.path.join(
        os.path.dirname(__file__), "..", "config", "settings.yaml"
    )
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            config = yaml.safe_load(f)
        return config.get("owner", {}).get("telegram_bot_token", "")

    return ""


def create_app():
    """Create and configure the Telegram bot application."""
    token = get_bot_token()
    if not token or token == "BOT_TOKEN_HERE":
        raise ValueError(
            "Bot token not configured. Set TELEGRAM_BOT_TOKEN environment "
            "variable or update config/settings.yaml"
        )

    app = ApplicationBuilder().token(token).build()

    # Register conversation handlers (must be before simple handlers)
    app.add_handler(get_article_conversation())
    app.add_handler(get_addlink_conversation())

    # Register command handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("listlinks", listlinks_command))
    app.add_handler(CommandHandler("publish", publish_command))
    app.add_handler(CommandHandler("stats", stats_command))
    app.add_handler(CommandHandler("postnow", postnow_command))

    # Register callback handlers
    app.add_handler(CallbackQueryHandler(confirm_publish, pattern="^confirm_publish$"))
    app.add_handler(CallbackQueryHandler(social_callback, pattern="^social_"))
    app.add_handler(CallbackQueryHandler(menu_callback, pattern="^(main_menu|help|settings)$"))

    return app


def main():
    """Run the bot in polling mode (for development/testing)."""
    logger.info("Starting SmartPicks Bot...")
    app = create_app()
    app.run_polling()


if __name__ == "__main__":
    main()
