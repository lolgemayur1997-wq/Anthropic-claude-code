"""Tests for affiliate link manager."""

import os
import sys
import json
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import affiliate.manager as manager


def test_add_and_get_link():
    # Use a temp file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump([], f)
        tmp_path = f.name

    original_data_file = manager.DATA_FILE
    manager.DATA_FILE = tmp_path

    try:
        link = manager.add_link(
            product_name="Test Product",
            url="https://example.com/product",
            category="electronics",
            program="amazon",
            commission_rate=5,
        )

        assert link["product_name"] == "Test Product"
        assert link["url"] == "https://example.com/product"
        assert link["category"] == "electronics"
        assert link["clicks"] == 0

        # Get all links
        links = manager.get_links()
        assert len(links) == 1

        # Get by category
        links = manager.get_links(category="electronics")
        assert len(links) == 1
        links = manager.get_links(category="kitchen")
        assert len(links) == 0

        # Get by ID
        found = manager.get_link_by_id(link["id"])
        assert found is not None
        assert found["product_name"] == "Test Product"

    finally:
        manager.DATA_FILE = original_data_file
        os.unlink(tmp_path)


def test_update_and_delete():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump([], f)
        tmp_path = f.name

    original_data_file = manager.DATA_FILE
    manager.DATA_FILE = tmp_path

    try:
        link = manager.add_link(
            product_name="Update Test",
            url="https://example.com",
            category="test",
        )

        # Update
        updated = manager.update_link(link["id"], product_name="Updated Name")
        assert updated["product_name"] == "Updated Name"

        # Increment clicks
        clicks = manager.increment_clicks(link["id"])
        assert clicks == 1
        clicks = manager.increment_clicks(link["id"])
        assert clicks == 2

        # Delete
        result = manager.delete_link(link["id"])
        assert result is True
        links = manager.get_links()
        assert len(links) == 0

    finally:
        manager.DATA_FILE = original_data_file
        os.unlink(tmp_path)


def test_get_stats():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump([], f)
        tmp_path = f.name

    original_data_file = manager.DATA_FILE
    manager.DATA_FILE = tmp_path

    try:
        manager.add_link("P1", "http://a.com", "electronics")
        manager.add_link("P2", "http://b.com", "kitchen")

        stats = manager.get_stats()
        assert stats["total_links"] == 2
        assert len(manager.get_categories()) == 2

    finally:
        manager.DATA_FILE = original_data_file
        os.unlink(tmp_path)


if __name__ == "__main__":
    test_add_and_get_link()
    test_update_and_delete()
    test_get_stats()
    print("All affiliate manager tests passed!")
