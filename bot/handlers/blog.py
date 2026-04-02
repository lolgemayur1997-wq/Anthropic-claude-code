"""Blog publishing handlers."""

import os

import yaml
from telegram import Update
from telegram.ext import ContextTypes

from bot.middleware import auth_required
from bot.keyboards import main_menu, confirm_menu


@auth_required
async def publish_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /publish command."""
    await update.message.reply_text(
        "🌐 *Publish Blog*\n\n"
        "This will rebuild your entire blog and deploy it.\n"
        "Continue?",
        parse_mode="Markdown",
        reply_markup=confirm_menu("publish"),
    )


async def confirm_publish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle publish confirmation."""
    query = update.callback_query
    await query.answer()

    if query.data != "confirm_publish":
        await query.edit_message_text("Cancelled.", reply_markup=main_menu())
        return

    await query.edit_message_text("⏳ Building blog...")

    try:
        config_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "config", "settings.yaml"
        )
        blog_config = {}
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                config = yaml.safe_load(f)
                blog_config = config.get("blog", {})

        from blog.builder import build_site

        count = build_site(blog_config=blog_config)

        await query.edit_message_text(
            f"✅ *Blog Built!*\n\n"
            f"📄 {count} articles published\n"
            f"🌐 Your blog is ready at:\n"
            f"`{blog_config.get('url', 'Check GitHub Pages settings')}`\n\n"
            f"Push to GitHub to deploy.",
            parse_mode="Markdown",
            reply_markup=main_menu(),
        )
    except Exception as e:
        await query.edit_message_text(
            f"❌ Build failed: {e}",
            reply_markup=main_menu(),
        )
