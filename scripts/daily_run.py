"""Daily content generation workflow.

This script is called by GitHub Actions on a daily schedule.
It generates a new article based on the configured niches and templates.
"""

import os
import sys
import random
import yaml

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from content.generator import generate_article, save_article
from content.templates.article import list_template_names
from content.seo import get_keyword_suggestions
from affiliate.manager import get_links
from affiliate.inserter import insert_links_into_markdown
from blog.builder import build_site


def load_config():
    config_path = os.path.join(
        os.path.dirname(__file__), "..", "config", "settings.yaml"
    )
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def run_daily_pipeline():
    """Run the daily content generation pipeline."""
    config = load_config()
    niches = config.get("niches", [])

    if not niches:
        print("No niches configured. Add niches to config/settings.yaml")
        return

    # Pick a random niche and template
    niche = random.choice(niches)
    templates = list_template_names()
    template_id, template_name = random.choice(templates)

    print(f"Niche: {niche['name']}, Template: {template_name}")

    # Get keywords for the niche
    keywords = niche.get("keywords", [])
    if keywords:
        keyword = random.choice(keywords)
        suggestions = get_keyword_suggestions(keyword)
        print(f"Keyword: {keyword}, Suggestions: {len(suggestions)}")

    # Build article data
    data = {
        "category": niche["name"].replace("_", " ").title(),
        "price_range": "10000",
        "count": "5",
        "product_name": keyword if keywords else niche["name"],
        "price": "5000",
        "brand": "Various",
        "rating": "4",
        "key_promise": "great value for money",
        "test_period": "2 weeks",
        "description": f"A comprehensive guide to {niche['name'].replace('_', ' ')}",
        "features_text": "Check the detailed features in each section below.",
        "build_quality_text": "Well-built and durable for daily use.",
        "performance_text": "Performs well for the price point.",
        "verdict": "a solid choice worth considering",
        "value_assessment": "delivers good value for the price",
        "affiliate_link": "#",
        "top_pick": keyword if keywords else "our top pick",
        "budget_pick": "the budget option",
    }

    # Generate the article
    article = generate_article(template_id, data)

    if not article:
        print("Failed to generate article")
        return

    # Insert affiliate links
    links = get_links(category=niche["name"])
    if links:
        article["content"] = insert_links_into_markdown(
            article["content"], category=niche["name"]
        )

    # Save the article
    filepath = save_article(article)
    print(f"Article saved: {filepath}")

    # Rebuild the blog
    blog_config = config.get("blog", {})
    count = build_site(blog_config=blog_config)
    print(f"Blog rebuilt with {count} articles")

    return article


if __name__ == "__main__":
    run_daily_pipeline()
