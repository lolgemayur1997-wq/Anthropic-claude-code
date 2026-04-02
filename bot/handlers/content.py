"""Content creation handlers for the Telegram bot."""

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
from bot.keyboards import template_menu, main_menu
from content.generator import generate_article, save_article
from content.templates.article import list_template_names

# Conversation states
CHOOSE_TEMPLATE, GET_CATEGORY, GET_PRODUCT_NAME, GET_PRICE, GET_DESCRIPTION, \
    GET_FEATURES, GET_PROS, GET_CONS, CONFIRM = range(9)


@auth_required
async def newarticle_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /newarticle command - start article creation flow."""
    await update.message.reply_text(
        "📝 *Create New Article*\n\nChoose a template:",
        parse_mode="Markdown",
        reply_markup=template_menu(),
    )
    return CHOOSE_TEMPLATE


async def choose_template(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle template selection."""
    query = update.callback_query
    await query.answer()

    if query.data == "main_menu":
        await query.edit_message_text("Cancelled.", reply_markup=main_menu())
        return ConversationHandler.END

    template_id = query.data.replace("tpl_", "")
    context.user_data["template_id"] = template_id

    templates = dict(list_template_names())
    template_name = templates.get(template_id, template_id)

    await query.edit_message_text(
        f"Template: *{template_name}*\n\n"
        "What category/niche is this for?\n"
        "(e.g., earbuds, mixer grinder, smartwatch)",
        parse_mode="Markdown",
    )
    return GET_CATEGORY


async def get_category(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get the product category."""
    context.user_data["category"] = update.message.text.strip()

    template_id = context.user_data["template_id"]

    if template_id == "deal_alert":
        await update.message.reply_text(
            "What's the product name?"
        )
        return GET_PRODUCT_NAME
    elif template_id in ("top_n_list", "buying_guide"):
        await update.message.reply_text(
            "What's the price range? (e.g., 5000)"
        )
        return GET_PRICE
    else:
        await update.message.reply_text(
            "What's the product name?"
        )
        return GET_PRODUCT_NAME


async def get_product_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get the product name."""
    context.user_data["product_name"] = update.message.text.strip()
    await update.message.reply_text(
        "What's the price? (just the number, e.g., 2999)"
    )
    return GET_PRICE


async def get_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get the price."""
    context.user_data["price"] = update.message.text.strip()
    await update.message.reply_text(
        "Write a short description (2-3 sentences about the product):"
    )
    return GET_DESCRIPTION


async def get_description(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get the description."""
    context.user_data["description"] = update.message.text.strip()
    await update.message.reply_text(
        "List the key features (one per line):"
    )
    return GET_FEATURES


async def get_features(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get features list."""
    features = update.message.text.strip().split("\n")
    context.user_data["features"] = [f.strip() for f in features if f.strip()]
    await update.message.reply_text(
        "List the pros/advantages (one per line):"
    )
    return GET_PROS


async def get_pros(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get pros list."""
    pros = update.message.text.strip().split("\n")
    context.user_data["pros"] = [p.strip() for p in pros if p.strip()]
    await update.message.reply_text(
        "List the cons/disadvantages (one per line):"
    )
    return GET_CONS


async def get_cons(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get cons and generate the article."""
    cons = update.message.text.strip().split("\n")
    context.user_data["cons"] = [c.strip() for c in cons if c.strip()]

    await update.message.reply_text("⏳ Generating article...")

    # Build data dict for the template
    data = {
        "category": context.user_data.get("category", ""),
        "product_name": context.user_data.get("product_name", ""),
        "price": context.user_data.get("price", ""),
        "price_range": context.user_data.get("price", ""),
        "description": context.user_data.get("description", ""),
        "features_text": "\n".join(
            f"- {f}" for f in context.user_data.get("features", [])
        ),
        "pros": context.user_data.get("pros", []),
        "cons": context.user_data.get("cons", []),
        "brand": context.user_data.get("product_name", "").split()[0],
        "key_promise": "great value for money",
        "test_period": "2 weeks",
        "build_quality_text": context.user_data.get("description", ""),
        "performance_text": "Performance meets expectations for this price range.",
        "rating": "4",
        "verdict": "a solid choice in its price range",
        "value_assessment": "offers good value for money",
        "affiliate_link": "#",
        "count": "5",
    }

    # For listicle template, create a product entry
    if context.user_data.get("template_id") == "top_n_list":
        data["products"] = [
            {
                "product_name": data["product_name"],
                "price": data["price"],
                "description": data["description"],
                "features": context.user_data.get("features", []),
                "pros": context.user_data.get("pros", []),
                "cons": context.user_data.get("cons", []),
            }
        ]
        data["top_pick"] = data["product_name"]
        data["budget_pick"] = data["product_name"]

    template_id = context.user_data.get("template_id", "single_review")
    article = generate_article(template_id, data)

    if article:
        filepath = save_article(article)
        await update.message.reply_text(
            f"✅ *Article Created!*\n\n"
            f"📄 Title: {article['title']}\n"
            f"📁 Saved to: `{filepath}`\n\n"
            f"Use /publish to build and deploy your blog.",
            parse_mode="Markdown",
            reply_markup=main_menu(),
        )
    else:
        await update.message.reply_text(
            "❌ Failed to generate article. Please try again.",
            reply_markup=main_menu(),
        )

    context.user_data.clear()
    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel the conversation."""
    context.user_data.clear()
    await update.message.reply_text(
        "Cancelled.", reply_markup=main_menu()
    )
    return ConversationHandler.END


def get_article_conversation():
    """Build the article creation ConversationHandler."""
    return ConversationHandler(
        entry_points=[
            CommandHandler("newarticle", newarticle_command),
            CallbackQueryHandler(
                newarticle_command, pattern="^new_article$"
            ),
        ],
        states={
            CHOOSE_TEMPLATE: [
                CallbackQueryHandler(choose_template, pattern="^tpl_|^main_menu$"),
            ],
            GET_CATEGORY: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_category)],
            GET_PRODUCT_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_product_name)],
            GET_PRICE: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_price)],
            GET_DESCRIPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_description)],
            GET_FEATURES: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_features)],
            GET_PROS: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_pros)],
            GET_CONS: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_cons)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )
