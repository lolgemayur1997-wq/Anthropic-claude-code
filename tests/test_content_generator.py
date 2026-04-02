"""Tests for content generator."""

import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from content.generator import generate_article, save_article, generate_twitter_post
from content.templates.article import get_template, list_template_names


def test_list_templates():
    templates = list_template_names()
    assert len(templates) >= 5
    ids = [t[0] for t in templates]
    assert "top_n_list" in ids
    assert "single_review" in ids
    assert "comparison" in ids


def test_get_template():
    template = get_template("single_review")
    assert template is not None
    assert "title_pattern" in template
    assert "intro_pattern" in template


def test_generate_single_review():
    data = {
        "product_name": "Test Earbuds Pro",
        "category": "electronics",
        "brand": "TestBrand",
        "price": "1999",
        "rating": "4.5",
        "key_promise": "amazing sound quality",
        "test_period": "2 weeks",
        "description": "Great earbuds for the price",
        "build_quality_text": "Solid build with premium feel.",
        "features_text": "- Bluetooth 5.3\n- ANC\n- 30hr battery",
        "performance_text": "Sound quality is impressive.",
        "pros": ["Great sound", "Long battery", "Comfortable"],
        "cons": ["No wireless charging", "Average mic"],
        "verdict": "an excellent choice for budget earbuds",
        "value_assessment": "offers premium features at a budget price",
        "affiliate_link": "https://example.com/buy",
    }

    article = generate_article("single_review", data)
    assert article is not None
    assert "Test Earbuds Pro" in article["title"]
    assert article["slug"]
    assert article["content"]
    assert "---" in article["content"]  # Frontmatter


def test_generate_top_n_list():
    data = {
        "category": "Earbuds",
        "count": "3",
        "price_range": "2000",
        "top_pick": "Product A",
        "budget_pick": "Product C",
        "products": [
            {
                "product_name": "Product A",
                "price": "1999",
                "description": "Best overall",
                "features": ["Feature 1", "Feature 2"],
                "pros": ["Pro 1", "Pro 2"],
                "cons": ["Con 1"],
            },
            {
                "product_name": "Product B",
                "price": "1499",
                "description": "Best mid-range",
                "features": ["Feature X"],
                "pros": ["Affordable"],
                "cons": ["Basic features"],
            },
        ],
    }

    article = generate_article("top_n_list", data)
    assert article is not None
    assert "Earbuds" in article["title"]
    assert "Product A" in article["content"]
    assert "Product B" in article["content"]


def test_save_article():
    data = {
        "product_name": "Save Test Product",
        "category": "test",
        "brand": "Test",
        "price": "999",
        "rating": "4",
        "key_promise": "testing",
        "test_period": "1 day",
        "description": "Test description",
        "build_quality_text": "Test build.",
        "features_text": "- Test feature",
        "performance_text": "Test performance.",
        "pros": ["Good"],
        "cons": ["Bad"],
        "verdict": "test verdict",
        "value_assessment": "test value",
        "affiliate_link": "#",
    }

    article = generate_article("single_review", data)

    with tempfile.TemporaryDirectory() as tmpdir:
        filepath = save_article(article, output_dir=tmpdir)
        assert os.path.exists(filepath)
        assert filepath.endswith(".md")

        with open(filepath, "r") as f:
            content = f.read()
        assert "Save Test Product" in content


def test_generate_twitter_post():
    data = {
        "product_name": "Cool Gadget",
        "price": "2999",
        "key_feature": "Amazing battery life!",
        "link": "https://example.com",
        "hashtags": "#Tech #India",
    }

    post = generate_twitter_post("product_highlight", data)
    assert post is not None
    assert "Cool Gadget" in post
    assert "2999" in post


if __name__ == "__main__":
    test_list_templates()
    test_get_template()
    test_generate_single_review()
    test_generate_top_n_list()
    test_save_article()
    test_generate_twitter_post()
    print("All content generator tests passed!")
