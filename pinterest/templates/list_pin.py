"""Listicle/infographic pin template - renders 'Top N' style pins."""

from pinterest.templates.colors import FONT_SIZES, PIN_WIDTH, PIN_HEIGHT


def get_layout():
    """Get the list pin layout specification.

    Layout (1000x1500):
    ┌──────────────────┐
    │                   │
    │  TOP 5 BEST       │  y: 60-200
    │  {CATEGORY}       │
    │  UNDER ₹{PRICE}   │
    │                   │
    │  ─────────────    │  y: 230
    │                   │
    │  1. Item One      │  y: 270-430
    │     ₹price        │
    │                   │
    │  2. Item Two      │  y: 450-610
    │     ₹price        │
    │                   │
    │  3. Item Three    │  y: 630-790
    │     ₹price        │
    │                   │
    │  4. Item Four     │  y: 810-970
    │     ₹price        │
    │                   │
    │  5. Item Five     │  y: 990-1150
    │     ₹price        │
    │                   │
    │  ─────────────    │  y: 1190
    │                   │
    │  TAP FOR LINKS ↗  │  y: 1220-1300
    │                   │
    │  SmartPicks India  │  y: 1380-1420
    └──────────────────┘
    """
    return {
        "type": "list",
        "regions": {
            "title": {"x": 50, "y": 60, "w": 900, "h": 160},
            "divider_top": {"x": 100, "y": 230, "w": 800, "h": 4},
            "items": [
                {"x": 60, "y": 270 + i * 180, "w": 880, "h": 160}
                for i in range(5)
            ],
            "divider_bottom": {"x": 100, "y": 1190, "w": 800, "h": 4},
            "cta": {"x": 150, "y": 1230, "w": 700, "h": 70},
            "branding": {"x": 50, "y": 1380, "w": 900, "h": 40},
        },
        "fonts": {
            "title": FONT_SIZES["title_medium"],
            "item_name": FONT_SIZES["subtitle"],
            "item_price": FONT_SIZES["body"],
            "item_number": FONT_SIZES["title_large"],
            "cta": FONT_SIZES["subtitle"],
            "branding": FONT_SIZES["caption"],
        },
    }


# Title templates for list pins
LIST_TITLES = [
    "Top {count} Best\n{category}\nUnder ₹{price_range}",
    "{count} Must-Have\n{category}\nin {year}",
    "Best {count}\n{category}\nfor Every Budget",
    "{count} Amazing\n{category}\nYou Need Right Now",
    "Top {count}\n{category}\nWorth Every Rupee",
]
