"""Social media posting handlers."""

from telegram import Update
from telegram.ext import ContextTypes

from bot.middleware import auth_required
from bot.keyboards import social_platform_menu, main_menu


@auth_required
async def postnow_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /postnow command."""
    await update.message.reply_text(
        "📢 *Post to Social Media*\n\n"
        "Choose a platform:",
        parse_mode="Markdown",
        reply_markup=social_platform_menu(),
    )


async def social_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle social media platform selection."""
    query = update.callback_query
    await query.answer()

    platform = query.data.replace("social_", "")

    if platform == "twitter":
        try:
            from social.platforms.twitter import post_latest_article
            result = post_latest_article()
            if result:
                await query.edit_message_text(
                    "✅ Posted to Twitter!",
                    reply_markup=main_menu(),
                )
            else:
                await query.edit_message_text(
                    "❌ Twitter not configured. Add API keys in config.",
                    reply_markup=main_menu(),
                )
        except Exception as e:
            await query.edit_message_text(
                f"❌ Twitter error: {e}",
                reply_markup=main_menu(),
            )
    elif platform == "medium":
        try:
            from social.platforms.medium import post_latest_article
            result = post_latest_article()
            if result:
                await query.edit_message_text(
                    "✅ Posted to Medium!",
                    reply_markup=main_menu(),
                )
            else:
                await query.edit_message_text(
                    "❌ Medium not configured. Add token in config.",
                    reply_markup=main_menu(),
                )
        except Exception as e:
            await query.edit_message_text(
                f"❌ Medium error: {e}",
                reply_markup=main_menu(),
            )
    elif platform == "all":
        await query.edit_message_text(
            "⏳ Posting to all configured platforms...\n"
            "This will be handled by the scheduled workflow.",
            reply_markup=main_menu(),
        )
    else:
        await query.edit_message_text(
            f"Platform '{platform}' coming soon!",
            reply_markup=main_menu(),
        )
