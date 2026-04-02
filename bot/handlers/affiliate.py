"""Affiliate link management handlers."""

from telegram import Update
from telegram.ext import (
    ContextTypes,
    ConversationHandler,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
)

from bot.middleware import auth_required
from bot.keyboards import links_menu, main_menu
from affiliate.manager import add_link, get_links, delete_link, get_stats

# Conversation states
GET_LINK_NAME, GET_LINK_URL, GET_LINK_CATEGORY, GET_LINK_PROGRAM = range(4)


@auth_required
async def addlink_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /addlink command."""
    await update.message.reply_text(
        "🔗 *Add Affiliate Link*\n\nWhat's the product name?",
        parse_mode="Markdown",
    )
    return GET_LINK_NAME


async def get_link_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["link_name"] = update.message.text.strip()
    await update.message.reply_text("Paste the affiliate URL:")
    return GET_LINK_URL


async def get_link_url(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["link_url"] = update.message.text.strip()
    await update.message.reply_text(
        "What category?\n(e.g., electronics, kitchen, fitness)"
    )
    return GET_LINK_CATEGORY


async def get_link_category(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["link_category"] = update.message.text.strip().lower()
    await update.message.reply_text(
        "Which affiliate program?\n(e.g., amazon, flipkart, cj)"
    )
    return GET_LINK_PROGRAM


async def get_link_program(update: Update, context: ContextTypes.DEFAULT_TYPE):
    program = update.message.text.strip().lower()

    new_link = add_link(
        product_name=context.user_data["link_name"],
        url=context.user_data["link_url"],
        category=context.user_data["link_category"],
        program=program,
    )

    await update.message.reply_text(
        f"✅ *Link Added!*\n\n"
        f"Product: {new_link['product_name']}\n"
        f"Category: {new_link['category']}\n"
        f"Program: {new_link['program']}\n"
        f"ID: `{new_link['id']}`",
        parse_mode="Markdown",
        reply_markup=main_menu(),
    )

    context.user_data.clear()
    return ConversationHandler.END


@auth_required
async def listlinks_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /listlinks command."""
    links = get_links()

    if not links:
        await update.message.reply_text(
            "No affiliate links yet. Use /addlink to add one!",
            reply_markup=main_menu(),
        )
        return

    text = "🔗 *Your Affiliate Links:*\n\n"
    for link in links[:20]:  # Limit to 20
        clicks = link.get("clicks", 0)
        text += (
            f"• *{link['product_name']}*\n"
            f"  Category: {link['category']} | "
            f"Clicks: {clicks}\n\n"
        )

    stats = get_stats()
    text += f"📊 Total: {stats['total_links']} links, {stats['total_clicks']} clicks"

    await update.message.reply_text(
        text, parse_mode="Markdown", reply_markup=main_menu()
    )


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text("Cancelled.", reply_markup=main_menu())
    return ConversationHandler.END


def get_addlink_conversation():
    """Build the add link ConversationHandler."""
    return ConversationHandler(
        entry_points=[
            CommandHandler("addlink", addlink_command),
            CallbackQueryHandler(addlink_command, pattern="^add_link$"),
        ],
        states={
            GET_LINK_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_link_name)],
            GET_LINK_URL: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_link_url)],
            GET_LINK_CATEGORY: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_link_category)],
            GET_LINK_PROGRAM: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_link_program)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )
