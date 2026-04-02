"""Tests for blog builder."""

import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from blog.builder import parse_article, build_site
from content.generator import generate_article, save_article


def test_parse_article():
    # Create a test article
    data = {
        "product_name": "Parse Test",
        "category": "test",
        "brand": "Test",
        "price": "500",
        "rating": "4",
        "key_promise": "testing",
        "test_period": "1 day",
        "description": "Test",
        "build_quality_text": "Good.",
        "features_text": "- Feature 1",
        "performance_text": "Good.",
        "pros": ["Pro 1"],
        "cons": ["Con 1"],
        "verdict": "good",
        "value_assessment": "good value",
        "affiliate_link": "#",
    }

    article = generate_article("single_review", data)

    with tempfile.TemporaryDirectory() as tmpdir:
        filepath = save_article(article, output_dir=tmpdir)
        parsed = parse_article(filepath)

        assert parsed["title"]
        assert "Parse Test" in parsed["title"]
        assert parsed["content_html"]
        assert parsed["slug"]


def test_build_site():
    with tempfile.TemporaryDirectory() as articles_dir:
        with tempfile.TemporaryDirectory() as output_dir:
            # Generate a test article
            data = {
                "product_name": "Build Test Product",
                "category": "electronics",
                "brand": "TestBrand",
                "price": "1000",
                "rating": "4",
                "key_promise": "testing build",
                "test_period": "1 day",
                "description": "Testing the build process",
                "build_quality_text": "Solid.",
                "features_text": "- Feature A",
                "performance_text": "Works well.",
                "pros": ["Works"],
                "cons": ["None"],
                "verdict": "good product",
                "value_assessment": "worth it",
                "affiliate_link": "#",
            }
            article = generate_article("single_review", data)
            save_article(article, output_dir=articles_dir)

            # Build the site
            blog_config = {
                "name": "Test Blog",
                "tagline": "Test tagline",
                "url": "https://test.github.io",
            }
            count = build_site(
                articles_dir=articles_dir,
                output_dir=output_dir,
                blog_config=blog_config,
            )

            assert count == 1
            assert os.path.exists(os.path.join(output_dir, "index.html"))
            assert os.path.exists(os.path.join(output_dir, "sitemap.xml"))

            # Check index.html content
            with open(os.path.join(output_dir, "index.html"), "r") as f:
                html = f.read()
            assert "Test Blog" in html


if __name__ == "__main__":
    test_parse_article()
    test_build_site()
    print("All blog builder tests passed!")
