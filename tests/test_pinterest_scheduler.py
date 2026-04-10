"""Tests for Pinterest scheduler and description generator."""

import os
import sys
import json
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pinterest.description_generator import (
    generate_product_description,
    generate_list_description,
    generate_quote_description,
    generate_hashtags,
    generate_title,
)
import pinterest.scheduler as scheduler


def test_generate_hashtags():
    """Test hashtag generation."""
    tags = generate_hashtags("tech_gadgets", count=15)
    assert isinstance(tags, str)
    assert "#" in tags
    tag_list = tags.split()
    assert len(tag_list) <= 15
    assert all(t.startswith("#") for t in tag_list)


def test_product_description():
    """Test product pin description generation."""
    desc = generate_product_description(
        product_name="Wireless Earbuds XYZ",
        price="1,999",
        category="Earbuds",
        key_feature="Active Noise Cancellation",
        niche="tech_gadgets",
    )
    assert isinstance(desc, str)
    assert len(desc) <= 500
    assert "Wireless Earbuds" in desc or "1,999" in desc


def test_list_description():
    """Test list pin description generation."""
    desc = generate_list_description(
        category="Kitchen Appliances",
        count=5,
        niche="kitchen",
    )
    assert isinstance(desc, str)
    assert len(desc) <= 500


def test_quote_description():
    """Test quote pin description."""
    desc = generate_quote_description(
        topic="Tech",
        quote_preview="Always check reviews before buying",
        niche="tech_gadgets",
    )
    assert isinstance(desc, str)
    assert len(desc) <= 500


def test_generate_title():
    """Test pin title generation."""
    title = generate_title("Wireless Earbuds", "product", "Earbuds")
    assert isinstance(title, str)
    assert len(title) <= 100

    title = generate_title("", "list", "Kitchen Gadgets")
    assert len(title) <= 100

    title = generate_title("", "quote", "Tips")
    assert len(title) <= 100


def test_queue_operations():
    """Test pin queue add/get/stats."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump({"pending": [], "posted": []}, f)
        tmp_queue = f.name

    original_file = scheduler.QUEUE_FILE
    scheduler.QUEUE_FILE = tmp_queue

    try:
        # Add to queue
        pin = scheduler.add_to_queue(
            title="Test Pin",
            description="Test description",
            board_id="test-board-123",
            link="https://example.com",
            pin_type="product",
        )
        assert pin["title"] == "Test Pin"
        assert pin["status"] == "pending"

        # Get pending
        pending = scheduler.get_pending_pins()
        assert len(pending) == 1

        # Stats
        stats = scheduler.get_queue_stats()
        assert stats["pending"] == 1

        # Clear
        cleared = scheduler.clear_pending()
        assert cleared == 1
        assert len(scheduler.get_pending_pins()) == 0

    finally:
        scheduler.QUEUE_FILE = original_file
        os.unlink(tmp_queue)


def test_landing_page_builder():
    """Test landing page generation."""
    from pinterest.landing.builder import create_landing_page

    product = {
        "name": "Test Product XYZ",
        "price": "2,999",
        "description": "A great product for testing",
        "features": ["Feature 1", "Feature 2"],
        "pros": ["Good quality", "Affordable"],
        "cons": ["Small size"],
        "affiliate_link": "https://example.com/buy",
        "category": "electronics",
        "verdict": "Worth buying!",
    }

    with tempfile.TemporaryDirectory() as tmpdir:
        url = create_landing_page(product, output_dir=tmpdir)
        assert url.startswith("/products/")
        assert "test-product" in url

        # Check HTML file exists
        slug = url.strip("/").split("/")[-1]
        index_path = os.path.join(tmpdir, slug, "index.html")
        assert os.path.exists(index_path)

        with open(index_path, "r") as f:
            html = f.read()
        assert "Test Product XYZ" in html
        assert "2,999" in html


if __name__ == "__main__":
    test_generate_hashtags()
    test_product_description()
    test_list_description()
    test_quote_description()
    test_generate_title()
    test_queue_operations()
    test_landing_page_builder()
    print("All Pinterest scheduler tests passed!")
