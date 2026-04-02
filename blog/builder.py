"""Static blog builder - converts markdown articles to HTML."""

import os
import re
import json
from datetime import datetime

import markdown
import frontmatter
from jinja2 import Environment, FileSystemLoader


THEMES_DIR = os.path.join(os.path.dirname(__file__), "themes", "default")
ARTICLES_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "articles")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "docs")


def _get_jinja_env():
    """Create Jinja2 environment with the default theme."""
    return Environment(
        loader=FileSystemLoader(os.path.abspath(THEMES_DIR)),
        autoescape=True,
    )


def parse_article(filepath):
    """Parse a markdown article with frontmatter.

    Returns dict with title, date, description, category, content_html.
    """
    with open(filepath, "r") as f:
        post = frontmatter.load(f)

    content_html = markdown.markdown(
        post.content,
        extensions=["tables", "fenced_code", "toc"],
    )

    return {
        "title": post.get("title", "Untitled"),
        "date": str(post.get("date", "")),
        "description": post.get("description", ""),
        "category": post.get("category", "general"),
        "template": post.get("template", ""),
        "content_html": content_html,
        "slug": os.path.splitext(os.path.basename(filepath))[0],
    }


def build_article_page(article, env, output_dir):
    """Build a single article HTML page."""
    template = env.get_template("article.html")
    html = template.render(article=article)

    article_dir = os.path.join(output_dir, article["slug"])
    os.makedirs(article_dir, exist_ok=True)

    filepath = os.path.join(article_dir, "index.html")
    with open(filepath, "w") as f:
        f.write(html)

    return filepath


def build_index_page(articles, env, output_dir, blog_config=None):
    """Build the homepage with article listings."""
    if blog_config is None:
        blog_config = {
            "name": "SmartPicks India",
            "tagline": "Honest reviews & best deals",
        }

    # Sort by date descending
    articles.sort(key=lambda a: a.get("date", ""), reverse=True)

    template = env.get_template("index.html")
    html = template.render(articles=articles, blog=blog_config)

    filepath = os.path.join(output_dir, "index.html")
    with open(filepath, "w") as f:
        f.write(html)

    return filepath


def build_sitemap(articles, base_url, output_dir):
    """Generate sitemap.xml for SEO."""
    urls = [f"  <url><loc>{base_url}/</loc></url>"]
    for article in articles:
        url = f"{base_url}/{article['slug']}/"
        urls.append(f"  <url><loc>{url}</loc><lastmod>{article.get('date', '')}</lastmod></url>")

    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    sitemap += "\n".join(urls)
    sitemap += "\n</urlset>"

    filepath = os.path.join(output_dir, "sitemap.xml")
    with open(filepath, "w") as f:
        f.write(sitemap)

    return filepath


def build_redirect_pages(links, output_dir):
    """Build redirect pages for affiliate link tracking."""
    from affiliate.inserter import create_redirect_page

    go_dir = os.path.join(output_dir, "go")
    os.makedirs(go_dir, exist_ok=True)

    for link in links:
        html = create_redirect_page(link)
        page_dir = os.path.join(go_dir, link["short_slug"])
        os.makedirs(page_dir, exist_ok=True)
        filepath = os.path.join(page_dir, "index.html")
        with open(filepath, "w") as f:
            f.write(html)


def build_site(articles_dir=None, output_dir=None, blog_config=None):
    """Build the entire static site.

    Args:
        articles_dir: Directory containing markdown articles
        output_dir: Directory to output HTML files
        blog_config: Dict with blog name, tagline, url

    Returns:
        Number of articles built.
    """
    if articles_dir is None:
        articles_dir = os.path.abspath(ARTICLES_DIR)
    if output_dir is None:
        output_dir = os.path.abspath(OUTPUT_DIR)

    os.makedirs(output_dir, exist_ok=True)

    env = _get_jinja_env()

    # Parse all articles
    articles = []
    if os.path.exists(articles_dir):
        for filename in os.listdir(articles_dir):
            if filename.endswith(".md"):
                filepath = os.path.join(articles_dir, filename)
                article = parse_article(filepath)
                articles.append(article)

    # Build individual article pages
    for article in articles:
        build_article_page(article, env, output_dir)

    # Build index page
    build_index_page(articles, env, output_dir, blog_config)

    # Build sitemap
    base_url = (blog_config or {}).get("url", "")
    if base_url:
        build_sitemap(articles, base_url, output_dir)

    # Copy CSS
    css_src = os.path.join(os.path.abspath(THEMES_DIR), "style.css")
    if os.path.exists(css_src):
        css_dst = os.path.join(output_dir, "style.css")
        with open(css_src, "r") as f:
            css_content = f.read()
        with open(css_dst, "w") as f:
            f.write(css_content)

    # Build redirect pages for affiliate links
    from affiliate.manager import get_links
    links = get_links()
    if links:
        build_redirect_pages(links, output_dir)

    return len(articles)


if __name__ == "__main__":
    import yaml

    config_path = os.path.join(
        os.path.dirname(__file__), "..", "config", "settings.yaml"
    )
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    count = build_site(blog_config=config.get("blog"))
    print(f"Built {count} articles")
