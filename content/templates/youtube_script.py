"""YouTube Shorts script templates."""

YOUTUBE_SHORTS_TEMPLATES = [
    {
        "id": "quick_review",
        "name": "Quick Product Review (60s)",
        "pattern": (
            "TITLE: {product_name} - 60 Second Review\n\n"
            "HOOK (0-5s):\n"
            '"{hook_line}"\n\n'
            "INTRO (5-10s):\n"
            '"Today we\'re looking at the {product_name}, priced at \u20b9{price}."\n\n'
            "FEATURES (10-30s):\n"
            "{features_script}\n\n"
            "VERDICT (30-50s):\n"
            '"{verdict_script}"\n\n'
            "CTA (50-60s):\n"
            '"Link in the description for the best price. '
            'Follow for more reviews!"\n\n'
            "---\n"
            "DESCRIPTION:\n"
            "{product_name} Review | \u20b9{price}\n"
            "{description_text}\n"
            "Buy here: {affiliate_link}\n\n"
            "TAGS: {tags}"
        ),
    },
    {
        "id": "top_3",
        "name": "Top 3 Picks (60s)",
        "pattern": (
            "TITLE: Top 3 {category} Under \u20b9{price_range}\n\n"
            "HOOK (0-5s):\n"
            '"Looking for the best {category}? Here are my top 3 picks!"\n\n'
            "PICK 3 (5-20s):\n"
            '"At number 3, the {product_3}. {reason_3}"\n\n'
            "PICK 2 (20-35s):\n"
            '"Number 2 is the {product_2}. {reason_2}"\n\n'
            "PICK 1 (35-50s):\n"
            '"And the winner is... the {product_1}! {reason_1}"\n\n'
            "CTA (50-60s):\n"
            '"Links for all 3 in the description. Which one would you pick?"\n\n'
            "---\n"
            "DESCRIPTION:\n"
            "Top 3 Best {category} Under \u20b9{price_range}\n\n"
            "1. {product_1}: {link_1}\n"
            "2. {product_2}: {link_2}\n"
            "3. {product_3}: {link_3}\n\n"
            "TAGS: {tags}"
        ),
    },
    {
        "id": "deal_alert_short",
        "name": "Deal Alert Short (30s)",
        "pattern": (
            "TITLE: \ud83d\udea8 {product_name} at {discount}% OFF!\n\n"
            "HOOK (0-3s):\n"
            '"STOP scrolling! You need to see this deal!"\n\n'
            "DEAL (3-20s):\n"
            '"The {product_name} is currently {discount}% off on {store}. '
            "That's just \u20b9{deal_price} instead of \u20b9{original_price}. "
            '{deal_detail}"\n\n'
            "CTA (20-30s):\n"
            '"Link in description. Go grab it before it\'s gone!"\n\n'
            "---\n"
            "DESCRIPTION:\n"
            "{product_name} - {discount}% OFF DEAL\n"
            "Buy here: {affiliate_link}\n\n"
            "TAGS: {tags}"
        ),
    },
]


def get_template(template_id):
    """Get a YouTube Shorts template by ID."""
    for t in YOUTUBE_SHORTS_TEMPLATES:
        if t["id"] == template_id:
            return t
    return None


def get_all_templates():
    return YOUTUBE_SHORTS_TEMPLATES
