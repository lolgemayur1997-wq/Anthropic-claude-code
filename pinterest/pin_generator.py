"""Pin image generator - creates Pinterest-optimized images using Pillow."""

import io
import os
import random
import textwrap
from datetime import datetime

from PIL import Image, ImageDraw, ImageFont, ImageFilter

from pinterest.templates.colors import (
    get_scheme, get_niche_schemes, get_gradient,
    COLOR_SCHEMES, GRADIENTS, PIN_WIDTH, PIN_HEIGHT, FONT_SIZES,
)
from pinterest.templates.product_pin import get_layout as product_layout, get_cta_texts
from pinterest.templates.quote_pin import get_layout as quote_layout
from pinterest.templates.list_pin import get_layout as list_layout, LIST_TITLES

IMAGES_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "pin_images")


def _get_font(size, bold=False):
    """Get a font at the given size. Falls back to default if custom fonts unavailable."""
    # Try common system fonts
    font_names = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]

    for font_path in font_names:
        if os.path.exists(font_path):
            return ImageFont.truetype(font_path, size)

    # Fall back to default
    try:
        return ImageFont.truetype("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf", size)
    except (OSError, IOError):
        return ImageFont.load_default()


def _draw_gradient(image, color_top, color_bottom):
    """Draw a vertical gradient on the image."""
    draw = ImageDraw.Draw(image)
    for y in range(image.height):
        ratio = y / image.height
        r = int(color_top[0] + (color_bottom[0] - color_top[0]) * ratio)
        g = int(color_top[1] + (color_bottom[1] - color_top[1]) * ratio)
        b = int(color_top[2] + (color_bottom[2] - color_top[2]) * ratio)
        draw.line([(0, y), (image.width, y)], fill=(r, g, b))


def _draw_rounded_rect(draw, xy, fill, radius=20):
    """Draw a rounded rectangle."""
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def _wrap_text(text, font, max_width, draw):
    """Wrap text to fit within max_width pixels."""
    words = text.split()
    lines = []
    current_line = ""

    for word in words:
        test_line = f"{current_line} {word}".strip()
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current_line = test_line
        else:
            if current_line:
                lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    return lines


def _draw_text_centered(draw, text, region, font, fill):
    """Draw text centered within a region."""
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = region["x"] + (region["w"] - tw) // 2
    y = region["y"] + (region["h"] - th) // 2
    draw.text((x, y), text, font=font, fill=fill)


def create_product_pin(product_name, price, features=None, scheme_name=None,
                       gradient_name=None, niche="default", branding="SmartPicks India"):
    """Create a product showcase pin.

    Args:
        product_name: Name of the product
        price: Price string (e.g., "2,999")
        features: List of key features (max 4)
        scheme_name: Color scheme name (random from niche if None)
        gradient_name: Gradient name (overrides scheme background)
        niche: Product niche for auto color selection
        branding: Branding text for footer

    Returns:
        PIL Image object (1000x1500)
    """
    if scheme_name is None:
        schemes = get_niche_schemes(niche)
        scheme_name = random.choice(schemes)

    scheme = get_scheme(scheme_name)
    layout = product_layout()

    # Create base image
    img = Image.new("RGB", (PIN_WIDTH, PIN_HEIGHT), scheme["background"])

    if gradient_name:
        grad = get_gradient(gradient_name)
        _draw_gradient(img, grad[0], grad[1])

    draw = ImageDraw.Draw(img)

    # Branding top
    font_brand = _get_font(layout["fonts"]["branding_top"])
    r = layout["regions"]["branding_top"]
    draw.text((r["x"], r["y"]), branding.upper(), font=font_brand,
              fill=scheme["text_secondary"])

    # Product image placeholder area
    r = layout["regions"]["image_area"]
    _draw_rounded_rect(draw, (r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]),
                       fill=(255, 255, 255, 30) if scheme_name != "clean_white" else (240, 240, 240),
                       radius=15)
    # Draw placeholder text
    placeholder_font = _get_font(FONT_SIZES["subtitle"])
    _draw_text_centered(draw, "[ Product Image ]", r, placeholder_font, scheme["text_secondary"])

    # Product name
    font_name = _get_font(layout["fonts"]["product_name"], bold=True)
    r = layout["regions"]["product_name"]
    lines = _wrap_text(product_name, font_name, r["w"], draw)
    y_offset = r["y"]
    for line in lines[:3]:
        draw.text((r["x"], y_offset), line, font=font_name, fill=scheme["text_primary"])
        y_offset += layout["fonts"]["product_name"] + 8

    # Price
    font_price = _get_font(layout["fonts"]["price"], bold=True)
    r = layout["regions"]["price"]
    draw.text((r["x"], r["y"]), f"₹{price}", font=font_price, fill=scheme["accent"])

    # Features
    if features:
        font_feat = _get_font(layout["fonts"]["features"])
        r = layout["regions"]["features"]
        y_offset = r["y"]
        for feat in features[:4]:
            draw.text((r["x"], y_offset), f"✦ {feat}", font=font_feat,
                      fill=scheme["text_primary"])
            y_offset += layout["fonts"]["features"] + 16

    # CTA Button
    r = layout["regions"]["cta_button"]
    _draw_rounded_rect(draw,
                       (r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]),
                       fill=scheme["accent"], radius=40)
    font_cta = _get_font(layout["fonts"]["cta_button"], bold=True)
    cta_text = random.choice(get_cta_texts())
    cta_color = (255, 255, 255) if scheme_name != "clean_white" else (255, 255, 255)
    _draw_text_centered(draw, cta_text, r, font_cta, cta_color)

    # Branding bottom
    font_bottom = _get_font(layout["fonts"]["branding_bottom"])
    r = layout["regions"]["branding_bottom"]
    draw.text((r["x"], r["y"]), f"📌 {branding}", font=font_bottom,
              fill=scheme["text_secondary"])

    return img


def create_quote_pin(quote_text, author="", topic_tag="", scheme_name=None,
                     gradient_name=None, branding="SmartPicks India"):
    """Create a quote/tip pin.

    Args:
        quote_text: The quote or tip text
        author: Attribution (optional)
        topic_tag: Tag like "Tech Tip", "Kitchen Hack" (optional)
        scheme_name: Color scheme name
        gradient_name: Gradient name

    Returns:
        PIL Image object (1000x1500)
    """
    if scheme_name is None:
        scheme_name = random.choice(list(COLOR_SCHEMES.keys()))

    scheme = get_scheme(scheme_name)
    layout = quote_layout()

    img = Image.new("RGB", (PIN_WIDTH, PIN_HEIGHT), scheme["background"])

    if gradient_name:
        grad = get_gradient(gradient_name)
        _draw_gradient(img, grad[0], grad[1])

    draw = ImageDraw.Draw(img)

    # Quote marks
    font_mark = _get_font(layout["fonts"]["quote_mark"], bold=True)
    r = layout["regions"]["quote_mark_open"]
    draw.text((r["x"], r["y"]), "\u201c", font=font_mark, fill=scheme["accent"])
    r = layout["regions"]["quote_mark_close"]
    draw.text((r["x"], r["y"]), "\u201d", font=font_mark, fill=scheme["accent"])

    # Quote text
    font_quote = _get_font(layout["fonts"]["quote_text"], bold=True)
    r = layout["regions"]["quote_text"]
    lines = _wrap_text(quote_text, font_quote, r["w"], draw)
    total_height = len(lines) * (layout["fonts"]["quote_text"] + 12)
    y_start = r["y"] + (r["h"] - total_height) // 2

    for line in lines[:8]:
        bbox = draw.textbbox((0, 0), line, font=font_quote)
        tw = bbox[2] - bbox[0]
        x = r["x"] + (r["w"] - tw) // 2
        draw.text((x, y_start), line, font=font_quote, fill=scheme["text_primary"])
        y_start += layout["fonts"]["quote_text"] + 12

    # Author
    if author:
        font_author = _get_font(layout["fonts"]["author"])
        r = layout["regions"]["author"]
        draw.text((r["x"], r["y"]), f"— {author}", font=font_author,
                  fill=scheme["text_secondary"])

    # Topic tag
    if topic_tag:
        font_tag = _get_font(layout["fonts"]["topic_tag"], bold=True)
        r = layout["regions"]["topic_tag"]
        _draw_rounded_rect(draw,
                           (r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]),
                           fill=scheme["accent"], radius=30)
        _draw_text_centered(draw, topic_tag, r, font_tag, (255, 255, 255))

    # Branding
    font_brand = _get_font(layout["fonts"]["branding"])
    r = layout["regions"]["branding"]
    draw.text((r["x"], r["y"]), f"📌 {branding}", font=font_brand,
              fill=scheme["text_secondary"])

    return img


def create_list_pin(title, items, scheme_name=None, gradient_name=None,
                    niche="default", branding="SmartPicks India"):
    """Create a listicle/top-N pin.

    Args:
        title: Main title (e.g., "Top 5 Best Earbuds Under ₹2000")
        items: List of dicts with 'name' and optional 'price'
        scheme_name: Color scheme name
        gradient_name: Gradient name

    Returns:
        PIL Image object (1000x1500)
    """
    if scheme_name is None:
        schemes = get_niche_schemes(niche)
        scheme_name = random.choice(schemes)

    scheme = get_scheme(scheme_name)
    layout = list_layout()

    img = Image.new("RGB", (PIN_WIDTH, PIN_HEIGHT), scheme["background"])

    if gradient_name:
        grad = get_gradient(gradient_name)
        _draw_gradient(img, grad[0], grad[1])

    draw = ImageDraw.Draw(img)

    # Title
    font_title = _get_font(layout["fonts"]["title"], bold=True)
    r = layout["regions"]["title"]
    lines = _wrap_text(title, font_title, r["w"], draw)
    y_offset = r["y"]
    for line in lines[:3]:
        bbox = draw.textbbox((0, 0), line, font=font_title)
        tw = bbox[2] - bbox[0]
        x = r["x"] + (r["w"] - tw) // 2
        draw.text((x, y_offset), line, font=font_title, fill=scheme["text_primary"])
        y_offset += layout["fonts"]["title"] + 8

    # Top divider
    r = layout["regions"]["divider_top"]
    draw.line([(r["x"], r["y"]), (r["x"] + r["w"], r["y"])],
              fill=scheme["accent"], width=3)

    # List items
    font_number = _get_font(layout["fonts"]["item_number"], bold=True)
    font_name = _get_font(layout["fonts"]["item_name"], bold=True)
    font_price = _get_font(layout["fonts"]["item_price"])

    for i, item in enumerate(items[:5]):
        r = layout["regions"]["items"][i]

        # Number circle
        circle_x = r["x"] + 10
        circle_y = r["y"] + 10
        circle_r = 35
        draw.ellipse(
            (circle_x, circle_y, circle_x + circle_r * 2, circle_y + circle_r * 2),
            fill=scheme["accent"],
        )
        num_text = str(i + 1)
        bbox = draw.textbbox((0, 0), num_text, font=font_number)
        nw = bbox[2] - bbox[0]
        nh = bbox[3] - bbox[1]
        draw.text(
            (circle_x + circle_r - nw // 2, circle_y + circle_r - nh // 2 - 5),
            num_text, font=font_number, fill=(255, 255, 255),
        )

        # Item name
        name = item if isinstance(item, str) else item.get("name", "")
        draw.text((circle_x + circle_r * 2 + 20, r["y"] + 15),
                  name, font=font_name, fill=scheme["text_primary"])

        # Item price
        price = item.get("price", "") if isinstance(item, dict) else ""
        if price:
            draw.text((circle_x + circle_r * 2 + 20, r["y"] + 60),
                      f"₹{price}", font=font_price, fill=scheme["text_secondary"])

    # Bottom divider
    r = layout["regions"]["divider_bottom"]
    draw.line([(r["x"], r["y"]), (r["x"] + r["w"], r["y"])],
              fill=scheme["accent"], width=3)

    # CTA
    font_cta = _get_font(layout["fonts"]["cta"], bold=True)
    r = layout["regions"]["cta"]
    _draw_rounded_rect(draw,
                       (r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]),
                       fill=scheme["accent"], radius=35)
    _draw_text_centered(draw, "Tap for Links & Reviews ↗", r, font_cta, (255, 255, 255))

    # Branding
    font_brand = _get_font(layout["fonts"]["branding"])
    r = layout["regions"]["branding"]
    draw.text((r["x"], r["y"]), f"📌 {branding}", font=font_brand,
              fill=scheme["text_secondary"])

    return img


def save_pin(image, pin_type="product", name="pin"):
    """Save a pin image to data/pin_images/.

    Returns the file path.
    """
    os.makedirs(os.path.abspath(IMAGES_DIR), exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    slug = name.lower().replace(" ", "-")[:40]
    filename = f"{pin_type}_{slug}_{timestamp}.jpg"
    filepath = os.path.join(os.path.abspath(IMAGES_DIR), filename)

    image.save(filepath, "JPEG", quality=85)
    return filepath


def image_to_base64(image):
    """Convert a PIL Image to base64 string for Pinterest API upload."""
    import base64
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")
