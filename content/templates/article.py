"""Article templates for different content types and niches.

Each template is a dict with:
- title_pattern: str with {placeholders}
- intro_pattern: str with {placeholders}
- sections: list of section templates
- conclusion_pattern: str with {placeholders}
- required_fields: list of fields the user must provide
"""

ARTICLE_TEMPLATES = [
    # Template 1: Top N Products Listicle
    {
        "id": "top_n_list",
        "name": "Top N Products List",
        "required_fields": ["category", "count", "price_range", "year", "products"],
        "title_pattern": "Top {count} Best {category} Under \u20b9{price_range} in {year}",
        "meta_description": "Looking for the best {category} under \u20b9{price_range}? Here are the top {count} picks with honest reviews, pros & cons, and buying guide.",
        "intro_pattern": (
            "Finding the right {category} can be overwhelming with so many options "
            "available in the market. Whether you're a first-time buyer or looking to "
            "upgrade, we've tested and reviewed the top {count} {category} under "
            "\u20b9{price_range} to help you make the best choice in {year}.\n\n"
            "Each product on this list has been evaluated based on quality, features, "
            "durability, and value for money. Let's dive in!"
        ),
        "product_section": (
            "### {rank}. {product_name}\n\n"
            "**Price:** \u20b9{price}\n\n"
            "{description}\n\n"
            "**Key Features:**\n{features}\n\n"
            "**Pros:**\n{pros}\n\n"
            "**Cons:**\n{cons}\n\n"
            "[Check Price on {store}]({affiliate_link})\n\n"
            "---\n"
        ),
        "conclusion_pattern": (
            "## Final Verdict\n\n"
            "All {count} {category} on this list offer great value under \u20b9{price_range}. "
            "Our top pick is **{top_pick}** for its excellent balance of features and price.\n\n"
            "If you're on a tighter budget, **{budget_pick}** is a solid choice that "
            "doesn't compromise on essential features.\n\n"
            "**Pro Tip:** Prices on Amazon and Flipkart change frequently. "
            "Click the links above to check the latest prices and available offers."
        ),
    },
    # Template 2: Single Product Review
    {
        "id": "single_review",
        "name": "Single Product Review",
        "required_fields": ["product_name", "category", "brand", "price", "rating"],
        "title_pattern": "{product_name} Review {year} - Is It Worth Buying?",
        "meta_description": "Honest {product_name} review with detailed pros, cons, features, and our verdict. Find out if this {category} is worth your money in {year}.",
        "intro_pattern": (
            "The **{product_name}** by {brand} has been making waves in the {category} "
            "market. Priced at \u20b9{price}, it promises {key_promise}. But does it "
            "deliver? We spent {test_period} testing it thoroughly.\n\n"
            "In this detailed review, we'll cover everything you need to know before "
            "making your purchase decision."
        ),
        "sections": [
            {
                "heading": "## Build Quality & Design",
                "pattern": "{build_quality_text}",
            },
            {
                "heading": "## Key Features",
                "pattern": "{features_text}",
            },
            {
                "heading": "## Performance",
                "pattern": "{performance_text}",
            },
            {
                "heading": "## Pros & Cons",
                "pattern": (
                    "### What We Liked\n{pros}\n\n"
                    "### What Could Be Better\n{cons}"
                ),
            },
        ],
        "conclusion_pattern": (
            "## Should You Buy the {product_name}?\n\n"
            "**Our Rating: {rating}/5**\n\n"
            "The {product_name} is {verdict}. At \u20b9{price}, it {value_assessment}.\n\n"
            "[Buy {product_name} at Best Price]({affiliate_link})"
        ),
    },
    # Template 3: Comparison Article
    {
        "id": "comparison",
        "name": "Product Comparison",
        "required_fields": ["product_a", "product_b", "category"],
        "title_pattern": "{product_a} vs {product_b} - Which {category} is Better in {year}?",
        "meta_description": "Detailed comparison of {product_a} vs {product_b}. Find out which {category} offers better value, features, and performance.",
        "intro_pattern": (
            "Choosing between **{product_a}** and **{product_b}** is a common dilemma "
            "for anyone shopping for a {category}. Both are popular choices in their "
            "price range, but they differ in key areas.\n\n"
            "In this head-to-head comparison, we break down every important aspect to "
            "help you pick the right one."
        ),
        "comparison_table_header": (
            "| Feature | {product_a} | {product_b} |\n"
            "|---------|-------------|-------------|\n"
        ),
        "comparison_row": "| {feature} | {value_a} | {value_b} |\n",
        "sections": [
            {
                "heading": "## Design & Build",
                "pattern": "{design_comparison}",
            },
            {
                "heading": "## Features Comparison",
                "pattern": "{features_comparison}",
            },
            {
                "heading": "## Performance",
                "pattern": "{performance_comparison}",
            },
            {
                "heading": "## Price & Value",
                "pattern": "{price_comparison}",
            },
        ],
        "conclusion_pattern": (
            "## The Verdict\n\n"
            "**Choose {product_a}** if {reason_a}.\n\n"
            "**Choose {product_b}** if {reason_b}.\n\n"
            "[Check {product_a} Price]({affiliate_link_a}) | "
            "[Check {product_b} Price]({affiliate_link_b})"
        ),
    },
    # Template 4: Buying Guide
    {
        "id": "buying_guide",
        "name": "Buying Guide",
        "required_fields": ["category", "year"],
        "title_pattern": "{category} Buying Guide {year} - Everything You Need to Know",
        "meta_description": "Complete {category} buying guide for {year}. Learn what features to look for, common mistakes to avoid, and our top recommendations.",
        "intro_pattern": (
            "Buying a {category} can feel confusing with so many options, brands, and "
            "features to consider. This comprehensive guide will walk you through "
            "everything you need to know to make a smart purchase in {year}.\n\n"
            "Whether you're a first-time buyer or upgrading, this guide has you covered."
        ),
        "sections": [
            {
                "heading": "## Types of {category}",
                "pattern": "{types_text}",
            },
            {
                "heading": "## Key Features to Look For",
                "pattern": "{features_to_look}",
            },
            {
                "heading": "## Common Mistakes to Avoid",
                "pattern": "{mistakes_text}",
            },
            {
                "heading": "## Budget Guide",
                "pattern": "{budget_guide_text}",
            },
            {
                "heading": "## Our Top Recommendations",
                "pattern": "{recommendations_text}",
            },
        ],
        "conclusion_pattern": (
            "## Summary\n\n"
            "{summary_text}\n\n"
            "**Ready to buy?** Check out our detailed reviews:\n{review_links}"
        ),
    },
    # Template 5: Deal/Offer Alert
    {
        "id": "deal_alert",
        "name": "Deal Alert",
        "required_fields": ["product_name", "original_price", "deal_price", "store"],
        "title_pattern": "Deal Alert: {product_name} at \u20b9{deal_price} ({discount}% Off)",
        "meta_description": "Grab {product_name} at just \u20b9{deal_price} (MRP \u20b9{original_price}). Limited time deal with {discount}% discount. Check availability now!",
        "intro_pattern": (
            "Great deal alert! The **{product_name}** is currently available at just "
            "**\u20b9{deal_price}** on {store}, down from the original price of "
            "\u20b9{original_price}. That's a massive **{discount}% discount**!\n\n"
            "This deal might not last long, so act fast if you've been eyeing this product."
        ),
        "sections": [
            {
                "heading": "## Deal Details",
                "pattern": (
                    "- **Product:** {product_name}\n"
                    "- **MRP:** ~~\u20b9{original_price}~~\n"
                    "- **Deal Price:** \u20b9{deal_price}\n"
                    "- **You Save:** \u20b9{savings} ({discount}%)\n"
                    "- **Store:** {store}\n"
                ),
            },
            {
                "heading": "## Why This Is a Good Deal",
                "pattern": "{why_good_deal}",
            },
        ],
        "conclusion_pattern": (
            "[Grab This Deal Now]({affiliate_link})\n\n"
            "*Note: Prices and availability are subject to change. "
            "We recommend checking the link for the latest price.*"
        ),
    },
]


def get_template(template_id):
    """Get a template by its ID."""
    for template in ARTICLE_TEMPLATES:
        if template["id"] == template_id:
            return template
    return None


def get_all_templates():
    """Get all available templates."""
    return ARTICLE_TEMPLATES


def list_template_names():
    """Get a list of template names and IDs."""
    return [(t["id"], t["name"]) for t in ARTICLE_TEMPLATES]
