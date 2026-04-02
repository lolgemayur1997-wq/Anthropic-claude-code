"""Analytics handlers."""

from telegram import Update
from telegram.ext import ContextTypes

from bot.middleware import auth_required
from bot.keyboards import main_menu
from affiliate.tracker import get_click_stats, get_page_view_stats
from affiliate.manager import get_stats as get_link_stats


@auth_required
async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /stats command."""
    click_stats = get_click_stats()
    page_stats = get_page_view_stats()
    link_stats = get_link_stats()

    text = (
        "📊 *Your Analytics*\n\n"
        f"🔗 *Links:* {link_stats['total_links']} total\n"
        f"👆 *Clicks:* {click_stats['total_clicks']} total\n"
        f"👀 *Page Views:* {page_stats['total_views']} total\n"
    )

    if page_stats["top_pages"]:
        text += "\n📈 *Top Pages:*\n"
        for page in page_stats["top_pages"][:5]:
            text += f"  • {page['page']}: {page['views']} views\n"

    if click_stats["top_links"]:
        text += "\n🔝 *Top Clicked Links:*\n"
        for link in click_stats["top_links"][:5]:
            text += f"  • {link['link_id']}: {link['clicks']} clicks\n"

    await update.message.reply_text(
        text, parse_mode="Markdown", reply_markup=main_menu()
    )
