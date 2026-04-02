"""Auto-insert affiliate links into content."""

import re

from affiliate.manager import get_links


def find_matching_links(text, category=None):
    """Find affiliate links that match products mentioned in the text.

    Returns list of (product_name, link_dict) tuples.
    """
    links = get_links(category=category)
    matches = []

    for link in links:
        product_name = link["product_name"].lower()
        if product_name in text.lower():
            matches.append((link["product_name"], link))

    return matches


def insert_links_into_markdown(markdown_text, category=None):
    """Insert affiliate links into markdown content.

    Finds product mentions and wraps them with affiliate links.
    Only links the first occurrence of each product.

    Returns the modified markdown text.
    """
    matches = find_matching_links(markdown_text, category)

    for product_name, link in matches:
        # Only replace first occurrence that isn't already a link
        pattern = re.compile(
            r"(?<!\[)" + re.escape(product_name) + r"(?!\])",
            re.IGNORECASE,
        )
        replacement = f"[{product_name}]({link['url']})"
        markdown_text = pattern.sub(replacement, markdown_text, count=1)

    return markdown_text


def add_cta_block(markdown_text, links, style="soft"):
    """Add a call-to-action block at the end of the article.

    Args:
        markdown_text: The article markdown
        links: List of affiliate link dicts to include
        style: 'soft' or 'direct'
    """
    if not links:
        return markdown_text

    if style == "soft":
        cta = "\n\n---\n\n## Where to Buy\n\n"
        cta += "Here are the best prices we found:\n\n"
        for link in links:
            cta += f"- [{link['product_name']}]({link['url']}) — Check latest price\n"
    else:
        cta = "\n\n---\n\n## 🛒 Buy Now\n\n"
        for link in links:
            cta += f"- **[Buy {link['product_name']}]({link['url']})**\n"

    return markdown_text + cta


def create_redirect_page(link):
    """Generate an HTML redirect page for click tracking.

    This page logs the click via JavaScript before redirecting.
    Used for GitHub Pages hosting.
    """
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Redirecting...</title>
<meta http-equiv="refresh" content="1;url={link['url']}">
<script>
// Log click
fetch('/data/click?id={link["id"]}').catch(function(){{}});
// Redirect
window.location.href = "{link['url']}";
</script>
</head>
<body>
<p>Redirecting to {link['product_name']}...</p>
<p><a href="{link['url']}">Click here if not redirected</a></p>
</body>
</html>"""
    return html
