"""Inline keyboard layouts for the Telegram bot menus."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def main_menu():
    """Main menu keyboard."""
    keyboard = [
        [
            InlineKeyboardButton("📝 New Article", callback_data="new_article"),
            InlineKeyboardButton("📱 New Post", callback_data="new_post"),
        ],
        [
            InlineKeyboardButton("🔗 Manage Links", callback_data="manage_links"),
            InlineKeyboardButton("📊 Stats", callback_data="view_stats"),
        ],
        [
            InlineKeyboardButton("🌐 Publish Blog", callback_data="publish_blog"),
            InlineKeyboardButton("📢 Post Social", callback_data="post_social"),
        ],
        [
            InlineKeyboardButton("⚙️ Settings", callback_data="settings"),
            InlineKeyboardButton("❓ Help", callback_data="help"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


def template_menu():
    """Template selection keyboard."""
    keyboard = [
        [InlineKeyboardButton("📋 Top N Products List", callback_data="tpl_top_n_list")],
        [InlineKeyboardButton("⭐ Single Product Review", callback_data="tpl_single_review")],
        [InlineKeyboardButton("⚔️ Product Comparison", callback_data="tpl_comparison")],
        [InlineKeyboardButton("📖 Buying Guide", callback_data="tpl_buying_guide")],
        [InlineKeyboardButton("🏷️ Deal Alert", callback_data="tpl_deal_alert")],
        [InlineKeyboardButton("« Back", callback_data="main_menu")],
    ]
    return InlineKeyboardMarkup(keyboard)


def niche_menu(niches):
    """Niche selection keyboard."""
    keyboard = []
    for niche in niches:
        name = niche.get("name", "unknown").replace("_", " ").title()
        keyboard.append(
            [InlineKeyboardButton(name, callback_data=f"niche_{niche['name']}")]
        )
    keyboard.append([InlineKeyboardButton("« Back", callback_data="main_menu")])
    return InlineKeyboardMarkup(keyboard)


def social_platform_menu():
    """Social media platform selection."""
    keyboard = [
        [InlineKeyboardButton("🐦 Twitter", callback_data="social_twitter")],
        [InlineKeyboardButton("📝 Medium", callback_data="social_medium")],
        [InlineKeyboardButton("📰 Blogger", callback_data="social_blogger")],
        [InlineKeyboardButton("📱 All Platforms", callback_data="social_all")],
        [InlineKeyboardButton("« Back", callback_data="main_menu")],
    ]
    return InlineKeyboardMarkup(keyboard)


def confirm_menu(action):
    """Confirmation keyboard."""
    keyboard = [
        [
            InlineKeyboardButton("✅ Yes", callback_data=f"confirm_{action}"),
            InlineKeyboardButton("❌ No", callback_data="main_menu"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


def links_menu():
    """Affiliate links management keyboard."""
    keyboard = [
        [InlineKeyboardButton("➕ Add Link", callback_data="add_link")],
        [InlineKeyboardButton("📋 List Links", callback_data="list_links")],
        [InlineKeyboardButton("📊 Link Stats", callback_data="link_stats")],
        [InlineKeyboardButton("« Back", callback_data="main_menu")],
    ]
    return InlineKeyboardMarkup(keyboard)
