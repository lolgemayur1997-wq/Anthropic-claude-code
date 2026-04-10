"""Landing page generator for Pinterest pins — creates product pages on GitHub Pages."""

import os
import re

from jinja2 import Environment, FileSystemLoader

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "products")


def _get_env():
    return Environment(
        loader=FileSystemLoader(os.path.abspath(TEMPLATES_DIR)),
        autoescape=True,
    )


def _slugify(text):
    slug = text.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")[:60]


def create_landing_page(product_data, output_dir=None):
    """Create a product landing page.

    Args:
        product_data: Dict with keys:
            - name: Product name
            - price: Current price
            - original_price: (optional) MRP
            - discount: (optional) Discount percentage
            - description: Product description
            - features: (optional) List of features
            - pros: (optional) List of pros
            - cons: (optional) List of cons
            - affiliate_link: Main affiliate URL
            - alt_link: (optional) Alternative store URL
            - store: (optional) Store name (default: Amazon)
            - alt_store: (optional) Alt store name
            - category: Product category
            - verdict: (optional) One-line verdict

    Returns:
        URL path to the landing page (e.g., /products/earbuds-xyz/)
    """
    if output_dir is None:
        output_dir = os.path.abspath(OUTPUT_DIR)

    os.makedirs(output_dir, exist_ok=True)

    env = _get_env()
    template = env.get_template("product.html")

    slug = _slugify(product_data["name"])
    html = template.render(product=product_data)

    page_dir = os.path.join(output_dir, slug)
    os.makedirs(page_dir, exist_ok=True)

    filepath = os.path.join(page_dir, "index.html")
    with open(filepath, "w") as f:
        f.write(html)

    # Copy CSS if not already there
    css_src = os.path.join(os.path.abspath(TEMPLATES_DIR), "landing_style.css")
    css_dst = os.path.join(output_dir, "landing_style.css")
    if not os.path.exists(css_dst):
        with open(css_src, "r") as f:
            css = f.read()
        with open(css_dst, "w") as f:
            f.write(css)

    return f"/products/{slug}/"


def build_all_landing_pages(products, output_dir=None):
    """Build landing pages for a list of products.

    Returns list of (product_name, url_path) tuples.
    """
    results = []
    for product in products:
        url = create_landing_page(product, output_dir)
        results.append((product["name"], url))
    return results
