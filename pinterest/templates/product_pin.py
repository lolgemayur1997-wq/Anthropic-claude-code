"""Product showcase pin template - renders product info on an attractive pin image."""

from pinterest.templates.colors import (
    get_scheme, FONT_SIZES, PIN_WIDTH, PIN_HEIGHT
)


def get_layout():
    """Get the product pin layout specification.

    Layout (1000x1500):
    ┌──────────────────┐
    │   BRANDING (top)  │  y: 0-80
    │                   │
    │  ┌─────────────┐  │
    │  │  PRODUCT     │  │  y: 100-700
    │  │  IMAGE       │  │
    │  └─────────────┘  │
    │                   │
    │  PRODUCT NAME     │  y: 730-850
    │  (large text)     │
    │                   │
    │  ₹ PRICE          │  y: 870-950
    │                   │
    │  ★ Key Feature 1  │  y: 970-1200
    │  ★ Key Feature 2  │
    │  ★ Key Feature 3  │
    │                   │
    │  ┌─────────────┐  │
    │  │  CTA BUTTON  │  │  y: 1250-1330
    │  └─────────────┘  │
    │                   │
    │  SmartPicks India  │  y: 1380-1420
    │  branding footer   │
    └──────────────────┘
    """
    return {
        "type": "product",
        "regions": {
            "branding_top": {"x": 50, "y": 30, "w": 900, "h": 50},
            "image_area": {"x": 100, "y": 100, "w": 800, "h": 600},
            "product_name": {"x": 50, "y": 730, "w": 900, "h": 120},
            "price": {"x": 50, "y": 870, "w": 900, "h": 80},
            "features": {"x": 70, "y": 970, "w": 860, "h": 250},
            "cta_button": {"x": 150, "y": 1250, "w": 700, "h": 80},
            "branding_bottom": {"x": 50, "y": 1380, "w": 900, "h": 40},
        },
        "fonts": {
            "branding_top": FONT_SIZES["branding"],
            "product_name": FONT_SIZES["title_medium"],
            "price": FONT_SIZES["price"],
            "features": FONT_SIZES["body"],
            "cta_button": FONT_SIZES["subtitle"],
            "branding_bottom": FONT_SIZES["caption"],
        },
    }


def get_cta_texts():
    """Get call-to-action button text options."""
    return [
        "Check Best Price →",
        "Shop Now →",
        "View Deal →",
        "Get Best Price →",
        "Buy at Best Price →",
        "See Latest Price →",
    ]
