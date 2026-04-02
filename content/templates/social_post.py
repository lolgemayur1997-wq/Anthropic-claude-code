"""Social media post templates for various platforms."""

TWITTER_TEMPLATES = [
    {
        "id": "product_highlight",
        "pattern": (
            "{emoji} {product_name} - Now at \u20b9{price}!\n\n"
            "{key_feature}\n\n"
            "{hashtags}\n\n"
            "Check it out: {link}"
        ),
    },
    {
        "id": "deal_tweet",
        "pattern": (
            "\ud83d\udea8 DEAL ALERT \ud83d\udea8\n\n"
            "{product_name}\n"
            "MRP: \u20b9{original_price}\n"
            "Deal: \u20b9{deal_price} ({discount}% OFF)\n\n"
            "Grab it before it's gone!\n"
            "{link}\n\n"
            "{hashtags}"
        ),
    },
    {
        "id": "blog_share",
        "pattern": (
            "\ud83d\udcdd New Blog Post!\n\n"
            "{title}\n\n"
            "{teaser}\n\n"
            "Read more: {link}\n\n"
            "{hashtags}"
        ),
    },
    {
        "id": "tip_tweet",
        "pattern": (
            "\ud83d\udca1 {category} Tip:\n\n"
            "{tip_text}\n\n"
            "Want more tips? Check our guide: {link}\n\n"
            "{hashtags}"
        ),
    },
]

INSTAGRAM_CAPTION_TEMPLATES = [
    {
        "id": "product_review",
        "pattern": (
            "{emoji} {product_name} Review\n\n"
            "{short_review}\n\n"
            "Rating: {rating_stars}\n"
            "Price: \u20b9{price}\n\n"
            "Pros:\n{pros}\n\n"
            "Cons:\n{cons}\n\n"
            "Full review link in bio! \u2b06\ufe0f\n\n"
            "{hashtags}"
        ),
    },
    {
        "id": "top_picks",
        "pattern": (
            "\ud83c\udfc6 Top {count} {category} in {year}\n\n"
            "{product_list}\n\n"
            "Which one would you pick? Let us know in comments! \u2b07\ufe0f\n\n"
            "Detailed reviews on our blog (link in bio)\n\n"
            "{hashtags}"
        ),
    },
]


def get_twitter_template(template_id):
    """Get a Twitter template by ID."""
    for t in TWITTER_TEMPLATES:
        if t["id"] == template_id:
            return t
    return None


def get_instagram_template(template_id):
    """Get an Instagram caption template by ID."""
    for t in INSTAGRAM_CAPTION_TEMPLATES:
        if t["id"] == template_id:
            return t
    return None


def get_all_twitter_templates():
    return TWITTER_TEMPLATES


def get_all_instagram_templates():
    return INSTAGRAM_CAPTION_TEMPLATES
