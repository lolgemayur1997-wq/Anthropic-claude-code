"""SEO-optimized Pinterest pin description and hashtag generator."""

import random
import re
from datetime import datetime

# Description templates per pin type
PRODUCT_DESCRIPTIONS = [
    (
        "Looking for the best {product_name}? {key_feature}. "
        "Priced at just ₹{price}, this is one of the top picks in {year}. "
        "Perfect for {audience}. Check our detailed review and get the best deal! "
        "{hashtags}"
    ),
    (
        "{product_name} — {key_feature}. At ₹{price}, it offers incredible "
        "value for money. {benefit}. Tap the pin for our honest review and "
        "best price! {hashtags}"
    ),
    (
        "Why {product_name} is trending in {year}: {key_feature}. "
        "Available at ₹{price}. {benefit}. "
        "Read our complete review — link in pin! {hashtags}"
    ),
    (
        "Save this pin! {product_name} is one of the best {category} you can "
        "buy under ₹{price}. {key_feature}. "
        "Full review with pros & cons on our blog. {hashtags}"
    ),
    (
        "₹{price} only! {product_name} delivers {key_feature}. "
        "We tested it for {test_period} — here's our verdict. "
        "Tap for our detailed review! {hashtags}"
    ),
]

LIST_DESCRIPTIONS = [
    (
        "Looking for the best {category}? Here are our top {count} picks "
        "that offer the best value in {year}. Prices start from ₹{min_price}. "
        "Save this pin for your next purchase! {hashtags}"
    ),
    (
        "Top {count} {category} that are actually worth buying in {year}. "
        "We tested and compared them all. "
        "Tap to see detailed reviews and best prices! {hashtags}"
    ),
    (
        "Don't buy {category} without seeing this list! "
        "Our top {count} picks based on quality, features, and value for money. "
        "All under ₹{max_price}. Save now, thank us later! {hashtags}"
    ),
]

QUOTE_DESCRIPTIONS = [
    (
        "{topic} tip that everyone should know! {quote_preview}. "
        "Follow us for more {topic} tips and product recommendations. {hashtags}"
    ),
    (
        "Did you know? {quote_preview}. "
        "Save this {topic} tip and share with friends who need it! {hashtags}"
    ),
]

# Hashtag pools by niche
HASHTAGS = {
    "tech_gadgets": [
        "#TechDeals", "#GadgetReview", "#BestEarbuds", "#SmartphoneDeals",
        "#TechIndia", "#AmazonDeals", "#FlipkartSale", "#BudgetTech",
        "#GadgetsOfInstagram", "#TechTips", "#WirelessEarbuds", "#SmartWatch",
        "#LaptopDeals", "#PhoneReview", "#TechNews", "#ElectronicsDeals",
        "#GadgetLover", "#TechSavvy", "#BestDeals", "#OnlineShopping",
    ],
    "kitchen": [
        "#KitchenAppliances", "#KitchenEssentials", "#CookingTips",
        "#HomeAppliances", "#KitchenGadgets", "#IndianKitchen", "#CookingLife",
        "#KitchenDecor", "#HomeCooking", "#MixerGrinder", "#AirFryer",
        "#KitchenHacks", "#CookingAtHome", "#HealthyCooking", "#KitchenGoals",
        "#IndianCooking", "#FoodieLife", "#KitchenOrganization",
    ],
    "home_decor": [
        "#HomeDecor", "#InteriorDesign", "#HomeDesign", "#DecorIdeas",
        "#HomeStyling", "#LivingRoom", "#BedroomDecor", "#DIYDecor",
        "#BudgetDecor", "#HomeInspo", "#SmallSpaces", "#ApartmentDecor",
        "#IndianHomeDecor", "#HomeMakeover", "#WallDecor", "#PlantDecor",
    ],
    "fashion": [
        "#FashionIndia", "#StyleInspo", "#BudgetFashion", "#OOTD",
        "#FashionDeals", "#AmazonFashion", "#FlipkartFashion", "#StyleTips",
        "#AffordableFashion", "#TrendAlert", "#FashionBlogger",
        "#IndianFashion", "#WardrobeEssentials", "#FashionFinds",
    ],
    "fitness": [
        "#FitnessIndia", "#HomeWorkout", "#FitnessGear", "#WorkoutMotivation",
        "#GymEquipment", "#YogaLife", "#FitLife", "#HealthyLiving",
        "#ExerciseAtHome", "#FitnessGoals", "#WorkoutFromHome",
        "#ResistanceBands", "#ProteinPowder", "#FitnessReview",
    ],
    "default": [
        "#BestDeals", "#India", "#OnlineShopping", "#AmazonIndia",
        "#ProductReview", "#SaveMoney", "#SmartShopping", "#DealOfTheDay",
        "#BudgetFriendly", "#ValueForMoney",
    ],
}


def _safe_format(template, data):
    """Format template with data, leaving missing placeholders empty."""
    try:
        return template.format(**data)
    except KeyError:
        return re.sub(r"\{[^}]+\}", "", template)


def generate_hashtags(niche="default", count=15):
    """Generate a set of hashtags for a pin.

    Args:
        niche: Content niche
        count: Number of hashtags (max 20)

    Returns:
        String of space-separated hashtags.
    """
    pool = HASHTAGS.get(niche, HASHTAGS["default"])
    default_pool = HASHTAGS["default"]

    selected = random.sample(pool, min(count - 3, len(pool)))
    # Add a few general ones
    remaining = count - len(selected)
    general = [h for h in default_pool if h not in selected]
    selected.extend(random.sample(general, min(remaining, len(general))))

    return " ".join(selected[:count])


def generate_product_description(product_name, price, category, key_feature="",
                                  benefit="", audience="everyone", niche="default"):
    """Generate a SEO-optimized product pin description.

    Returns description string (max 500 chars).
    """
    hashtags = generate_hashtags(niche, count=12)

    data = {
        "product_name": product_name,
        "price": price,
        "category": category,
        "key_feature": key_feature or f"premium quality {category}",
        "benefit": benefit or "Great value for money",
        "audience": audience,
        "year": str(datetime.now().year),
        "test_period": "2 weeks",
        "hashtags": hashtags,
    }

    template = random.choice(PRODUCT_DESCRIPTIONS)
    description = _safe_format(template, data)

    return description[:500]


def generate_list_description(category, count=5, min_price="", max_price="",
                               niche="default"):
    """Generate description for a listicle pin."""
    hashtags = generate_hashtags(niche, count=12)

    data = {
        "category": category,
        "count": str(count),
        "min_price": min_price or "999",
        "max_price": max_price or "10,000",
        "year": str(datetime.now().year),
        "hashtags": hashtags,
    }

    template = random.choice(LIST_DESCRIPTIONS)
    return _safe_format(template, data)[:500]


def generate_quote_description(topic, quote_preview="", niche="default"):
    """Generate description for a quote/tip pin."""
    hashtags = generate_hashtags(niche, count=10)

    data = {
        "topic": topic,
        "quote_preview": quote_preview[:100] if quote_preview else f"A useful {topic} tip",
        "hashtags": hashtags,
    }

    template = random.choice(QUOTE_DESCRIPTIONS)
    return _safe_format(template, data)[:500]


def generate_title(product_name, pin_type="product", category=""):
    """Generate a pin title (max 100 chars).

    Pinterest titles should be keyword-rich and compelling.
    """
    title_templates = {
        "product": [
            f"{product_name} — Best Price & Review",
            f"{product_name} Review {datetime.now().year}",
            f"Best {category}: {product_name}",
            f"{product_name} — Is It Worth Buying?",
            f"₹ Deal: {product_name}",
        ],
        "list": [
            f"Top {category} Picks {datetime.now().year}",
            f"Best {category} Under Budget",
            f"{category} — Our Top Picks",
            f"Must-Have {category} in {datetime.now().year}",
        ],
        "quote": [
            f"{category} Tip You Need to Know",
            f"Did You Know? — {category}",
            f"Smart {category} Advice",
            f"{category} Hack — Save This!",
        ],
    }

    templates = title_templates.get(pin_type, title_templates["product"])
    return random.choice(templates)[:100]
