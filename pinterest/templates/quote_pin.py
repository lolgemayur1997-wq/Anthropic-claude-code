"""Quote/tip pin template - renders motivational or educational quote pins."""

from pinterest.templates.colors import FONT_SIZES, PIN_WIDTH, PIN_HEIGHT


def get_layout():
    """Get the quote pin layout specification.

    Layout (1000x1500):
    ┌──────────────────┐
    │                   │
    │                   │
    │    "             │  y: 200
    │                   │
    │  QUOTE TEXT       │  y: 300-900
    │  (centered,       │
    │   large font)     │
    │                   │
    │    "             │  y: 950
    │                   │
    │  — AUTHOR         │  y: 1020-1080
    │                   │
    │  ┌─────────────┐  │
    │  │  TOPIC TAG   │  │  y: 1150-1210
    │  └─────────────┘  │
    │                   │
    │  SmartPicks India  │  y: 1380-1420
    └──────────────────┘
    """
    return {
        "type": "quote",
        "regions": {
            "quote_mark_open": {"x": 80, "y": 200, "w": 100, "h": 100},
            "quote_text": {"x": 80, "y": 320, "w": 840, "h": 600},
            "quote_mark_close": {"x": 820, "y": 930, "w": 100, "h": 100},
            "author": {"x": 80, "y": 1040, "w": 840, "h": 60},
            "topic_tag": {"x": 250, "y": 1160, "w": 500, "h": 60},
            "branding": {"x": 50, "y": 1380, "w": 900, "h": 40},
        },
        "fonts": {
            "quote_mark": 120,
            "quote_text": FONT_SIZES["title_medium"],
            "author": FONT_SIZES["subtitle"],
            "topic_tag": FONT_SIZES["body"],
            "branding": FONT_SIZES["caption"],
        },
    }


# Tip categories with pre-written tips for quick pin generation
TIPS_BY_NICHE = {
    "tech_gadgets": [
        ("Always check for warranty before buying electronics online", "Tech Tip"),
        ("Bluetooth 5.3 gives 2x better battery life than 5.0", "Did You Know?"),
        ("Best time to buy gadgets: Amazon Great Indian Festival & Flipkart BBD", "Shopping Tip"),
        ("USB-C is now the universal standard — avoid Micro USB devices", "Pro Tip"),
        ("Check GST invoice option for better warranty on electronics", "Smart Buying"),
    ],
    "kitchen": [
        ("A good mixer grinder should have a copper motor, not aluminum", "Kitchen Tip"),
        ("Induction cooktops save 30% more energy than gas stoves", "Did You Know?"),
        ("Non-stick pans should be replaced every 3-5 years for safety", "Health Tip"),
        ("Air fryers use 80% less oil than deep frying", "Healthy Living"),
        ("Stainless steel is the safest material for everyday cooking", "Kitchen Wisdom"),
    ],
    "fitness": [
        ("30 minutes of daily walking can reduce heart disease risk by 35%", "Fitness Fact"),
        ("Resistance bands can replace an entire gym setup at home", "Home Gym Tip"),
        ("Drink water 30 minutes before meals for better digestion", "Health Tip"),
        ("Morning workouts boost metabolism for the entire day", "Pro Tip"),
        ("A yoga mat should be at least 6mm thick for joint protection", "Yoga Tip"),
    ],
    "home_decor": [
        ("Mirrors make small rooms look 2x bigger", "Decor Tip"),
        ("Indoor plants improve air quality by up to 25%", "Green Living"),
        ("LED strip lights can transform any room under ₹500", "Budget Decor"),
        ("The 60-30-10 color rule: 60% dominant, 30% secondary, 10% accent", "Design Rule"),
        ("Decluttering one room at a time makes the task manageable", "Organization Tip"),
    ],
}
