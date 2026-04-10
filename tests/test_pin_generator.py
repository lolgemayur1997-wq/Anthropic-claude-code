"""Tests for Pinterest pin image generator."""

import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pinterest.pin_generator import (
    create_product_pin, create_quote_pin, create_list_pin,
    save_pin, image_to_base64,
)
from pinterest.templates.colors import get_scheme, get_niche_schemes, COLOR_SCHEMES


def test_color_schemes():
    """Test color scheme loading."""
    scheme = get_scheme("modern_coral")
    assert "background" in scheme
    assert "text_primary" in scheme
    assert "accent" in scheme

    niche_schemes = get_niche_schemes("tech_gadgets")
    assert len(niche_schemes) >= 2
    assert all(s in COLOR_SCHEMES for s in niche_schemes)


def test_product_pin():
    """Test product pin generation."""
    img = create_product_pin(
        product_name="Wireless Earbuds Pro X200",
        price="2,999",
        features=["Active Noise Cancellation", "40hr Battery", "Bluetooth 5.3"],
        scheme_name="modern_coral",
        niche="tech_gadgets",
    )

    assert img is not None
    assert img.size == (1000, 1500)
    assert img.mode == "RGB"


def test_quote_pin():
    """Test quote pin generation."""
    img = create_quote_pin(
        quote_text="The best time to buy is when you find the right deal",
        author="SmartPicks",
        topic_tag="Shopping Tip",
        scheme_name="elegant_navy",
    )

    assert img is not None
    assert img.size == (1000, 1500)


def test_list_pin():
    """Test list pin generation."""
    items = [
        {"name": "Product A", "price": "1,999"},
        {"name": "Product B", "price": "2,499"},
        {"name": "Product C", "price": "3,299"},
        {"name": "Product D", "price": "4,199"},
        {"name": "Product E", "price": "5,499"},
    ]

    img = create_list_pin(
        title="Top 5 Best Earbuds Under 5000",
        items=items,
        scheme_name="sky_blue",
    )

    assert img is not None
    assert img.size == (1000, 1500)


def test_product_pin_with_gradient():
    """Test product pin with gradient background."""
    img = create_product_pin(
        product_name="Smart Watch GT3",
        price="4,999",
        features=["AMOLED Display", "SpO2 Sensor"],
        gradient_name="sunset",
    )

    assert img is not None
    assert img.size == (1000, 1500)


def test_save_pin():
    """Test saving pin to file."""
    img = create_product_pin(
        product_name="Test Save Product",
        price="999",
    )

    with tempfile.TemporaryDirectory() as tmpdir:
        # Monkey-patch the images dir
        import pinterest.pin_generator as pg
        original_dir = pg.IMAGES_DIR
        pg.IMAGES_DIR = tmpdir

        filepath = save_pin(img, "product", "test-save")
        assert os.path.exists(filepath)
        assert filepath.endswith(".jpg")

        # Check file size > 0
        assert os.path.getsize(filepath) > 1000

        pg.IMAGES_DIR = original_dir


def test_image_to_base64():
    """Test base64 conversion."""
    img = create_product_pin("Test", "100")
    b64 = image_to_base64(img)

    assert isinstance(b64, str)
    assert len(b64) > 1000  # Should be a substantial base64 string


def test_all_color_schemes():
    """Test pin generation with every color scheme."""
    for scheme_name in COLOR_SCHEMES:
        img = create_product_pin(
            product_name=f"Test {scheme_name}",
            price="999",
            scheme_name=scheme_name,
        )
        assert img is not None
        assert img.size == (1000, 1500)


if __name__ == "__main__":
    test_color_schemes()
    test_product_pin()
    test_quote_pin()
    test_list_pin()
    test_product_pin_with_gradient()
    test_save_pin()
    test_image_to_base64()
    test_all_color_schemes()
    print("All pin generator tests passed!")
