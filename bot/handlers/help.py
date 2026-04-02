"""Help and start command handlers."""

from telegram import Update
from telegram.ext import ContextTypes

from bot.middleware import auth_required
from bot.keyboards import main_menu


@auth_required
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command."""
    welcome_text = (
        "👋 *Welcome to SmartPicks Bot!*\n\n"
        "Your personal content & affiliate marketing automation system.\n\n"
        "Here's what I can do:\n"
        "📝 Create SEO-optimized articles\n"
        "🔗 Manage affiliate links\n"
        "🌐 Publish to your blog\n"
        "📢 Post to social media\n"
        "📊 Track your analytics\n\n"
        "Use the menu below or type /help for commands."
    )
    await update.message.reply_text(
        welcome_text,
        parse_mode="Markdown",
        reply_markup=main_menu(),
    )


@auth_required
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command."""
    help_text = (
        "📖 *Available Commands:*\n\n"
        "/start - Show main menu\n"
        "/newarticle - Create a new article\n"
        "/newpost - Create a social media post\n"
        "/addlink - Add an affiliate link\n"
        "/listlinks - View all affiliate links\n"
        "/publish - Build & publish blog\n"
        "/postnow - Post to social media\n"
        "/stats - View analytics\n"
        "/help - Show this help message\n\n"
        "💡 *Quick Start:*\n"
        "1. Add affiliate links with /addlink\n"
        "2. Create articles with /newarticle\n"
        "3. Publish with /publish\n"
        "4. Share on social with /postnow"
    )
    await update.message.reply_text(help_text, parse_mode="Markdown")


async def menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle main menu button callbacks."""
    query = update.callback_query
    await query.answer()

    if query.data == "main_menu":
        await query.edit_message_text(
            "Choose an action:",
            reply_markup=main_menu(),
        )
    elif query.data == "help":
        help_text = (
            "📖 *Commands:*\n\n"
            "/newarticle - Create article\n"
            "/addlink - Add affiliate link\n"
            "/publish - Publish blog\n"
            "/stats - View analytics\n"
            "/help - Full help"
        )
        await query.edit_message_text(help_text, parse_mode="Markdown")
