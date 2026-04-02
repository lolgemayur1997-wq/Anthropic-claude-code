"""Content rewriter - create variations of content to avoid duplication."""

import random


# Synonym groups for common words in product reviews
SYNONYMS = {
    "best": ["top", "finest", "greatest", "most popular", "leading"],
    "good": ["excellent", "solid", "impressive", "reliable", "dependable"],
    "bad": ["poor", "weak", "disappointing", "subpar", "lacking"],
    "buy": ["purchase", "get", "grab", "pick up", "invest in"],
    "cheap": ["affordable", "budget-friendly", "economical", "value-for-money", "pocket-friendly"],
    "expensive": ["premium", "high-end", "costly", "pricey", "top-tier"],
    "fast": ["quick", "speedy", "rapid", "swift", "snappy"],
    "big": ["large", "spacious", "generous", "ample", "roomy"],
    "small": ["compact", "portable", "mini", "lightweight", "travel-sized"],
    "new": ["latest", "newest", "recently launched", "brand new", "fresh"],
    "features": ["specifications", "capabilities", "functions", "highlights", "offerings"],
    "review": ["analysis", "assessment", "evaluation", "breakdown", "deep dive"],
    "price": ["cost", "price point", "rate", "value", "pricing"],
    "quality": ["build quality", "craftsmanship", "construction", "make", "finish"],
    "recommend": ["suggest", "endorse", "vouch for", "stand behind", "back"],
}

# Alternative phrases for common review sentences
PHRASE_ALTERNATIVES = {
    "In this review": [
        "In this detailed breakdown",
        "In our hands-on evaluation",
        "In this comprehensive look",
        "Here in our analysis",
    ],
    "Let's dive in": [
        "Let's get started",
        "Here's what you need to know",
        "Let's break it down",
        "Without further ado",
    ],
    "Worth buying": [
        "Worth your money",
        "A smart purchase",
        "A worthy investment",
        "Deserves your consideration",
    ],
    "Check it out": [
        "Take a look",
        "See for yourself",
        "Have a look",
        "Give it a try",
    ],
}


def rewrite_with_synonyms(text, variation_rate=0.3):
    """Replace some words with synonyms to create variations.

    Args:
        text: Original text
        variation_rate: Probability of replacing each matchable word (0-1)

    Returns:
        Rewritten text
    """
    words = text.split()
    result = []

    for word in words:
        clean_word = word.lower().strip(".,!?;:")
        if clean_word in SYNONYMS and random.random() < variation_rate:
            synonym = random.choice(SYNONYMS[clean_word])
            # Preserve original capitalization
            if word[0].isupper():
                synonym = synonym.capitalize()
            # Preserve trailing punctuation
            trailing = ""
            for ch in reversed(word):
                if ch in ".,!?;:":
                    trailing = ch + trailing
                else:
                    break
            result.append(synonym + trailing)
        else:
            result.append(word)

    return " ".join(result)


def rewrite_phrases(text):
    """Replace common phrases with alternatives."""
    for phrase, alternatives in PHRASE_ALTERNATIVES.items():
        if phrase in text:
            replacement = random.choice(alternatives)
            text = text.replace(phrase, replacement, 1)
    return text


def create_variation(text, variation_rate=0.3):
    """Create a content variation using both synonym and phrase replacement."""
    text = rewrite_phrases(text)
    text = rewrite_with_synonyms(text, variation_rate)
    return text
