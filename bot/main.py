"""Telegram bot entry point - SmartPicks Content Automation Bot.

Supports two modes:
- Polling mode (local dev): python -m bot.main
- Webhook mode (Render/Railway): Set PORT env var, bot auto-detects
"""

import os
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

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
from bot.handlers.pinterest import (
    get_newpin_conversation, pinterest_command, pinschedule_command,
    pinstats_command, boards_command, pinterest_callback,
)

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


class HealthHandler(BaseHTTPRequestHandler):
    """Simple HTTP handler for health checks (required by Render/Railway)."""

    def do_GET(self):
        if self.path == "/health" or self.path == "/":
            self.send_response(200)
            self.send_header("Content-type", "text/plain")
            self.end_headers()
            self.wfile.write(b"SmartPicks Bot is running!")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Suppress default logging to avoid noise
        pass


def start_health_server(port):
    """Start a simple HTTP server for health checks in a background thread."""
    server = HTTPServer(("0.0.0.0", port), HealthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    logger.info(f"Health check server running on port {port}")
    return server


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
    app.add_handler(get_newpin_conversation())

    # Register command handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("listlinks", listlinks_command))
    app.add_handler(CommandHandler("publish", publish_command))
    app.add_handler(CommandHandler("stats", stats_command))
    app.add_handler(CommandHandler("postnow", postnow_command))
    app.add_handler(CommandHandler("pinterest", pinterest_command))
    app.add_handler(CommandHandler("pinschedule", pinschedule_command))
    app.add_handler(CommandHandler("pinstats", pinstats_command))
    app.add_handler(CommandHandler("boards", boards_command))

    # Register callback handlers
    app.add_handler(CallbackQueryHandler(confirm_publish, pattern="^confirm_publish$"))
    app.add_handler(CallbackQueryHandler(social_callback, pattern="^social_"))
    app.add_handler(CallbackQueryHandler(pinterest_callback, pattern="^pin_(?!new)|^pinterest_menu$"))
    app.add_handler(CallbackQueryHandler(menu_callback, pattern="^(main_menu|help|settings)$"))

    return app


def main():
    """Run the bot - auto-detects polling vs webhook mode."""
    port = os.environ.get("PORT")

    if port:
        # ============================================
        # WEBHOOK MODE (for Render, Railway, etc.)
        # ============================================
        port = int(port)
        logger.info(f"Starting SmartPicks Bot in WEBHOOK mode (port {port})...")

        # Start health check server (Render needs this to keep the service alive)
        start_health_server(port)

        # Run bot in polling mode in the main thread
        # (Polling works on free tiers that don't support inbound webhooks)
        app = create_app()
        logger.info("Bot is now running and listening for messages!")
        app.run_polling(drop_pending_updates=True)
    else:
        # ============================================
        # POLLING MODE (for local development)
        # ============================================
        logger.info("Starting SmartPicks Bot in POLLING mode...")
        app = create_app()
        app.run_polling()


if __name__ == "__main__":
    main()
