"""Page view and event tracking."""

from affiliate.tracker import record_page_view, get_page_view_stats, get_click_stats

# Re-export from affiliate.tracker for convenience
__all__ = ["record_page_view", "get_page_view_stats", "get_click_stats"]
