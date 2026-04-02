"""Content generator - fills templates with product data to create articles."""

import os
import re
from datetime import datetime

from content.templates.article import get_template, get_all_templates, list_template_names
from content.templates.social_post import (
    get_twitter_template,
    get_instagram_template,
)
from content.templates.youtube_script import get_template as get_yt_template


def _safe_format(pattern, data):
    """Format a string pattern with data, leaving missing placeholders empty."""
    try:
        return pattern.format(**data)
    except KeyError:
        # Replace any remaining {placeholders} with empty string
        return re.sub(r"\{[^}]+\}", "", pattern)


def _format_list_items(items, prefix="- "):
    """Convert a list of strings into markdown bullet points."""
    if isinstance(items, str):
        return items
    return "\n".join(f"{prefix}{item}" for item in items)


def generate_article(template_id, data):
    """Generate a full article from a template and data.

    Args:
        template_id: ID of the template to use (e.g., 'top_n_list')
        data: dict with all required fields for the template

    Returns:
        dict with 'title', 'meta_description', 'content' (markdown), 'slug'
    """
    template = get_template(template_id)
    if not template:
        return None

    # Add defaults
    data.setdefault("year", str(datetime.now().year))
    data.setdefault("date", datetime.now().strftime("%Y-%m-%d"))

    # Generate title
    title = _safe_format(template["title_pattern"], data)

    # Generate meta description
    meta_desc = _safe_format(template.get("meta_description", ""), data)

    # Generate intro
    intro = _safe_format(template["intro_pattern"], data)

    # Generate body sections
    body_parts = [intro, ""]

    # Handle product sections (for listicle templates)
    if "product_section" in template and "products" in data:
        for i, product in enumerate(data["products"], 1):
            product["rank"] = i
            product.setdefault("store", "Amazon")
            product.setdefault("affiliate_link", "#")

            # Format pros/cons as lists
            if "pros" in product and isinstance(product["pros"], list):
                product["pros"] = _format_list_items(
                    product["pros"], prefix="- ✅ "
                )
            if "cons" in product and isinstance(product["cons"], list):
                product["cons"] = _format_list_items(
                    product["cons"], prefix="- ❌ "
                )
            if "features" in product and isinstance(product["features"], list):
                product["features"] = _format_list_items(product["features"])

            section = _safe_format(template["product_section"], product)
            body_parts.append(section)

    # Handle generic sections
    if "sections" in template:
        for section in template["sections"]:
            heading = _safe_format(section["heading"], data)
            content = _safe_format(section["pattern"], data)
            body_parts.extend([heading, content, ""])

    # Handle comparison table
    if "comparison_table_header" in template and "comparison_features" in data:
        table = _safe_format(template["comparison_table_header"], data)
        for feature in data["comparison_features"]:
            table += _safe_format(template["comparison_row"], feature)
        body_parts.append(table)

    # Generate conclusion
    conclusion = _safe_format(template["conclusion_pattern"], data)
    body_parts.extend(["", conclusion])

    # Assemble full markdown
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")

    markdown_content = f"""---
title: "{title}"
date: {data['date']}
description: "{meta_desc}"
category: "{data.get('category', 'general')}"
template: "{template_id}"
---

# {title}

{chr(10).join(body_parts)}
"""

    return {
        "title": title,
        "slug": slug,
        "meta_description": meta_desc,
        "content": markdown_content,
        "date": data["date"],
        "category": data.get("category", "general"),
    }


def generate_twitter_post(template_id, data):
    """Generate a Twitter post from a template.

    Returns the formatted post text.
    """
    template = get_twitter_template(template_id)
    if not template:
        return None

    # Default emoji
    data.setdefault("emoji", "🔥")
    data.setdefault("hashtags", "#BestDeals #India")

    return _safe_format(template["pattern"], data)


def generate_instagram_caption(template_id, data):
    """Generate an Instagram caption from a template."""
    template = get_instagram_template(template_id)
    if not template:
        return None

    data.setdefault("emoji", "⭐")
    data.setdefault("year", str(datetime.now().year))
    data.setdefault("hashtags", "#ProductReview #BestDeals #India")

    # Format pros/cons lists
    if "pros" in data and isinstance(data["pros"], list):
        data["pros"] = _format_list_items(data["pros"], prefix="✅ ")
    if "cons" in data and isinstance(data["cons"], list):
        data["cons"] = _format_list_items(data["cons"], prefix="❌ ")

    # Format product list
    if "products" in data and isinstance(data["products"], list):
        numbered = [f"{i}. {p}" for i, p in enumerate(data["products"], 1)]
        data["product_list"] = "\n".join(numbered)

    return _safe_format(template["pattern"], data)


def generate_youtube_script(template_id, data):
    """Generate a YouTube Shorts script from a template."""
    template = get_yt_template(template_id)
    if not template:
        return None

    data.setdefault("tags", "#Shorts #Review #BestDeals")
    return _safe_format(template["pattern"], data)


def save_article(article, output_dir=None):
    """Save a generated article to the data/articles directory.

    Args:
        article: dict returned by generate_article()
        output_dir: optional custom output directory

    Returns:
        The file path where the article was saved.
    """
    if output_dir is None:
        output_dir = os.path.join(
            os.path.dirname(__file__), "..", "data", "articles"
        )

    output_dir = os.path.abspath(output_dir)
    os.makedirs(output_dir, exist_ok=True)

    filename = f"{article['date']}-{article['slug'][:60]}.md"
    filepath = os.path.join(output_dir, filename)

    with open(filepath, "w") as f:
        f.write(article["content"])

    return filepath
