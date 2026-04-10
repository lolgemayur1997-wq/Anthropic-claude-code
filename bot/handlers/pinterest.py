"""Pinterest bot handlers - manage pins from Telegram."""

import os
import random

from telegram import Update
from telegram.ext import (
    ContextTypes,
    ConversationHandler,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
)
from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from bot.middleware import auth_required
from bot.keyboards import main_menu

# Conversation states
PIN_TYPE, PIN_PRODUCT, PIN_PRICE, PIN_FEATURES, PIN_BOARD, PIN_CONFIRM = range(6)


def _pinterest_menu():
    keyboard = [
        [InlineKeyboardButton("🖼️ New Pin", callback_data="pin_new")],
        [InlineKeyboardButton("📋 Pin Queue", callback_data="pin_queue")],
        [InlineKeyboardButton("📊 Pin Stats", callback_data="pin_stats")],
        [InlineKeyboardButton("📌 Boards", callback_data="pin_boards")],
        [InlineKeyboardButton("« Back", callback_data="main_menu")],
    ]
    return InlineKeyboardMarkup(keyboard)


def _pin_type_menu():
    keyboard = [
        [InlineKeyboardButton("🛍️ Product Pin", callback_data="ptype_product")],
        [InlineKeyboardButton("💬 Quote/Tip Pin", callback_data="ptype_quote")],
        [InlineKeyboardButton("📋 Top-N List Pin", callback_data="ptype_list")],
        [InlineKeyboardButton("« Back", callback_data="pinterest_menu")],
    ]
    return InlineKeyboardMarkup(keyboard)


@auth_required
async def pinterest_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /pinterest command - show Pinterest menu."""
    await update.message.reply_text(
        "📌 *Pinterest Automation*\n\nWhat would you like to do?",
        parse_mode="Markdown",
        reply_markup=_pinterest_menu(),
    )


@auth_required
async def newpin_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /newpin command - start pin creation."""
    await update.message.reply_text(
        "🖼️ *Create New Pin*\n\nChoose pin type:",
        parse_mode="Markdown",
        reply_markup=_pin_type_menu(),
    )
    return PIN_TYPE


async def choose_pin_type(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle pin type selection."""
    query = update.callback_query
    await query.answer()

    if query.data == "pinterest_menu":
        await query.edit_message_text(
            "📌 Pinterest Menu", reply_markup=_pinterest_menu()
        )
        return ConversationHandler.END

    pin_type = query.data.replace("ptype_", "")
    context.user_data["pin_type"] = pin_type

    if pin_type == "product":
        await query.edit_message_text(
            "🛍️ *Product Pin*\n\nWhat's the product name?"
            , parse_mode="Markdown"
        )
        return PIN_PRODUCT
    elif pin_type == "quote":
        await query.edit_message_text(
            "💬 *Quote Pin*\n\nType the quote or tip text:"
            , parse_mode="Markdown"
        )
        return PIN_PRODUCT
    elif pin_type == "list":
        await query.edit_message_text(
            "📋 *List Pin*\n\nWhat category? (e.g., Earbuds, Air Fryers)"
            , parse_mode="Markdown"
        )
        return PIN_PRODUCT

    return PIN_PRODUCT


async def get_pin_product(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get product name / quote text / category."""
    text = update.message.text.strip()
    pin_type = context.user_data.get("pin_type", "product")

    if pin_type == "product":
        context.user_data["product_name"] = text
        await update.message.reply_text("What's the price? (e.g., 2999)")
        return PIN_PRICE
    elif pin_type == "quote":
        context.user_data["quote_text"] = text
        await update.message.reply_text(
            "Who's the author? (or type 'skip' for no attribution)"
        )
        return PIN_PRICE
    elif pin_type == "list":
        context.user_data["category"] = text
        await update.message.reply_text(
            "List the items (one per line):\n"
            "Example:\nProduct A - 1999\nProduct B - 2499"
        )
        return PIN_FEATURES

    return PIN_PRICE


async def get_pin_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get price or author."""
    text = update.message.text.strip()
    pin_type = context.user_data.get("pin_type", "product")

    if pin_type == "product":
        context.user_data["price"] = text
        await update.message.reply_text(
            "List key features (one per line, max 4):"
        )
        return PIN_FEATURES
    elif pin_type == "quote":
        context.user_data["author"] = "" if text.lower() == "skip" else text
        # Generate quote pin directly
        await update.message.reply_text("⏳ Generating quote pin...")
        return await _generate_and_send_pin(update, context)

    return PIN_FEATURES


async def get_pin_features(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get features / list items."""
    text = update.message.text.strip()
    pin_type = context.user_data.get("pin_type", "product")

    if pin_type == "product":
        features = [f.strip() for f in text.split("\n") if f.strip()]
        context.user_data["features"] = features[:4]
    elif pin_type == "list":
        items = []
        for line in text.split("\n"):
            line = line.strip()
            if not line:
                continue
            if " - " in line:
                name, price = line.rsplit(" - ", 1)
                items.append({"name": name.strip(), "price": price.strip()})
            else:
                items.append({"name": line})
        context.user_data["items"] = items[:5]

    await update.message.reply_text("⏳ Generating pin image...")
    return await _generate_and_send_pin(update, context)


async def _generate_and_send_pin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Generate the pin image and send it to the user."""
    pin_type = context.user_data.get("pin_type", "product")

    try:
        from pinterest.pin_generator import (
            create_product_pin, create_quote_pin, create_list_pin,
            save_pin, image_to_base64,
        )
        from pinterest.description_generator import (
            generate_product_description, generate_quote_description,
            generate_list_description, generate_title,
        )

        if pin_type == "product":
            product_name = context.user_data.get("product_name", "Product")
            price = context.user_data.get("price", "0")
            features = context.user_data.get("features", [])

            img = create_product_pin(product_name, price, features)
            filepath = save_pin(img, "product", product_name)

            title = generate_title(product_name, "product")
            description = generate_product_description(
                product_name, price, context.user_data.get("category", "")
            )

        elif pin_type == "quote":
            quote = context.user_data.get("quote_text", "")
            author = context.user_data.get("author", "")

            img = create_quote_pin(quote, author, "Pro Tip")
            filepath = save_pin(img, "quote", quote[:30])

            title = generate_title("", "quote", "Tips")
            description = generate_quote_description("Tips", quote[:80])

        elif pin_type == "list":
            category = context.user_data.get("category", "Products")
            items = context.user_data.get("items", [])

            list_title = f"Top {len(items)} Best {category}"
            img = create_list_pin(list_title, items)
            filepath = save_pin(img, "list", category)

            title = generate_title("", "list", category)
            description = generate_list_description(category, len(items))
        else:
            await update.message.reply_text("Unknown pin type.")
            return ConversationHandler.END

        # Send preview to user
        with open(filepath, "rb") as f:
            await update.message.reply_photo(
                photo=f,
                caption=(
                    f"📌 *Pin Preview*\n\n"
                    f"*Title:* {title}\n\n"
                    f"*Description:*\n{description[:200]}...\n\n"
                    f"Use /pinschedule to add to queue"
                ),
                parse_mode="Markdown",
            )

        # Store for potential scheduling
        context.user_data["last_pin"] = {
            "title": title,
            "description": description,
            "image_path": filepath,
            "pin_type": pin_type,
        }

        await update.message.reply_text(
            "Pin created! Use /pinschedule to view queue.",
            reply_markup=_pinterest_menu(),
        )

    except Exception as e:
        await update.message.reply_text(
            f"❌ Error generating pin: {e}",
            reply_markup=_pinterest_menu(),
        )

    context.user_data.clear()
    return ConversationHandler.END


@auth_required
async def pinschedule_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /pinschedule - view pin queue."""
    from pinterest.scheduler import get_queue_stats

    stats = get_queue_stats()
    await update.message.reply_text(
        f"📋 *Pin Schedule*\n\n"
        f"⏳ Pending: {stats['pending']} pins\n"
        f"✅ Posted today: {stats['posted_today']}\n"
        f"📊 Total posted: {stats['posted_total']}",
        parse_mode="Markdown",
        reply_markup=_pinterest_menu(),
    )


@auth_required
async def pinstats_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /pinstats - Pinterest analytics."""
    from pinterest.analytics import get_overall_stats

    stats = get_overall_stats()
    await update.message.reply_text(
        f"📊 *Pinterest Stats*\n\n"
        f"📌 Total Pins: {stats['total_pins']}\n"
        f"👀 Impressions: {stats['total_impressions']:,}\n"
        f"💾 Saves: {stats['total_saves']:,}\n"
        f"👆 Clicks: {stats['total_clicks']:,}\n"
        f"📈 CTR: {stats['click_through_rate']}%\n"
        f"💾 Save Rate: {stats['save_rate']}%",
        parse_mode="Markdown",
        reply_markup=_pinterest_menu(),
    )


@auth_required
async def boards_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /boards - list Pinterest boards."""
    from pinterest.boards import get_all_board_stats
    from pinterest.api import is_configured

    if not is_configured():
        await update.message.reply_text(
            "⚠️ Pinterest not configured. Add your access token to "
            "config/pinterest.yaml or PINTEREST_ACCESS_TOKEN env var.",
            reply_markup=_pinterest_menu(),
        )
        return

    stats = get_all_board_stats()
    if not stats:
        await update.message.reply_text(
            "No boards found. They'll be auto-created when you start pinning.",
            reply_markup=_pinterest_menu(),
        )
        return

    text = "📌 *Your Boards:*\n\n"
    for board in stats[:15]:
        text += f"• *{board['name']}* — {board['pin_count']} pins\n"

    await update.message.reply_text(
        text, parse_mode="Markdown", reply_markup=_pinterest_menu()
    )


async def pinterest_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle Pinterest menu callbacks."""
    query = update.callback_query
    await query.answer()

    if query.data == "pinterest_menu":
        await query.edit_message_text(
            "📌 Pinterest Menu", reply_markup=_pinterest_menu()
        )
    elif query.data == "pin_queue":
        from pinterest.scheduler import get_queue_stats
        stats = get_queue_stats()
        await query.edit_message_text(
            f"📋 *Pin Queue*\n\n"
            f"⏳ Pending: {stats['pending']}\n"
            f"✅ Today: {stats['posted_today']}\n"
            f"📊 Total: {stats['posted_total']}",
            parse_mode="Markdown",
            reply_markup=_pinterest_menu(),
        )
    elif query.data == "pin_stats":
        from pinterest.analytics import get_overall_stats
        stats = get_overall_stats()
        await query.edit_message_text(
            f"📊 *Pinterest Stats*\n\n"
            f"📌 Pins: {stats['total_pins']}\n"
            f"👀 Impressions: {stats['total_impressions']:,}\n"
            f"👆 Clicks: {stats['total_clicks']:,}",
            parse_mode="Markdown",
            reply_markup=_pinterest_menu(),
        )
    elif query.data == "pin_boards":
        await query.edit_message_text(
            "Use /boards to see your Pinterest boards.",
            reply_markup=_pinterest_menu(),
        )


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text("Cancelled.", reply_markup=main_menu())
    return ConversationHandler.END


def get_newpin_conversation():
    """Build the pin creation ConversationHandler."""
    return ConversationHandler(
        entry_points=[
            CommandHandler("newpin", newpin_command),
            CallbackQueryHandler(newpin_command, pattern="^pin_new$"),
        ],
        states={
            PIN_TYPE: [
                CallbackQueryHandler(choose_pin_type, pattern="^ptype_|^pinterest_menu$"),
            ],
            PIN_PRODUCT: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_pin_product)],
            PIN_PRICE: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_pin_price)],
            PIN_FEATURES: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_pin_features)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )
