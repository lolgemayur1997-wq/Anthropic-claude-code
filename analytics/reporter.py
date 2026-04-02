"""Analytics report generator."""

import os
from datetime import datetime

from affiliate.tracker import get_click_stats, get_page_view_stats
from affiliate.manager import get_stats as get_link_stats
from social.poster import get_published_count


def generate_daily_report():
    """Generate a daily analytics report.

    Returns a formatted string suitable for Telegram.
    """
    click_stats = get_click_stats(days=1)
    page_stats = get_page_view_stats()
    link_stats = get_link_stats()

    report = (
        f"📊 *Daily Report - {datetime.now().strftime('%d %b %Y')}*\n\n"
        f"👀 Total Page Views: {page_stats['total_views']}\n"
        f"👆 Total Link Clicks: {click_stats['total_clicks']}\n"
        f"🔗 Total Affiliate Links: {link_stats['total_links']}\n"
        f"📢 Posts Published (30d): {get_published_count()}\n"
    )

    if page_stats["top_pages"]:
        report += "\n📈 *Top Pages Today:*\n"
        for page in page_stats["top_pages"][:5]:
            report += f"  • {page['page']}: {page['views']} views\n"

    return report


def generate_weekly_report():
    """Generate a weekly analytics report."""
    click_stats = get_click_stats(days=7)
    page_stats = get_page_view_stats()
    link_stats = get_link_stats()

    report = (
        f"📊 *Weekly Report - Week of {datetime.now().strftime('%d %b %Y')}*\n\n"
        f"👀 Total Page Views: {page_stats['total_views']}\n"
        f"👆 Total Link Clicks: {click_stats['total_clicks']}\n"
        f"🔗 Active Affiliate Links: {link_stats['total_links']}\n"
        f"📢 Social Posts (30d): {get_published_count()}\n"
    )

    if click_stats["top_links"]:
        report += "\n🔝 *Best Performing Links:*\n"
        for link in click_stats["top_links"][:5]:
            report += f"  • {link['link_id']}: {link['clicks']} clicks\n"

    if page_stats["top_pages"]:
        report += "\n📈 *Most Viewed Pages:*\n"
        for page in page_stats["top_pages"][:5]:
            report += f"  • {page['page']}: {page['views']} views\n"

    report += (
        "\n💡 *Tips:*\n"
        "• Focus on content that gets the most clicks\n"
        "• Add more affiliate links to top-performing pages\n"
        "• Share popular articles on social media again"
    )

    return report
