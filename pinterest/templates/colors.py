"""Color schemes, gradients, and font configurations for pin templates."""

# Pinterest-optimized color schemes (high contrast, eye-catching)
COLOR_SCHEMES = {
    "modern_coral": {
        "background": (255, 107, 107),
        "text_primary": (255, 255, 255),
        "text_secondary": (255, 220, 220),
        "accent": (52, 73, 94),
        "overlay": (0, 0, 0, 100),
    },
    "elegant_navy": {
        "background": (44, 62, 80),
        "text_primary": (255, 255, 255),
        "text_secondary": (189, 195, 199),
        "accent": (241, 196, 15),
        "overlay": (0, 0, 0, 120),
    },
    "fresh_mint": {
        "background": (46, 204, 113),
        "text_primary": (255, 255, 255),
        "text_secondary": (39, 174, 96),
        "accent": (44, 62, 80),
        "overlay": (0, 0, 0, 80),
    },
    "warm_orange": {
        "background": (243, 156, 18),
        "text_primary": (255, 255, 255),
        "text_secondary": (255, 235, 205),
        "accent": (44, 62, 80),
        "overlay": (0, 0, 0, 100),
    },
    "royal_purple": {
        "background": (142, 68, 173),
        "text_primary": (255, 255, 255),
        "text_secondary": (215, 189, 226),
        "accent": (241, 196, 15),
        "overlay": (0, 0, 0, 100),
    },
    "clean_white": {
        "background": (255, 255, 255),
        "text_primary": (44, 62, 80),
        "text_secondary": (127, 140, 141),
        "accent": (231, 76, 60),
        "overlay": (0, 0, 0, 40),
    },
    "bold_red": {
        "background": (231, 76, 60),
        "text_primary": (255, 255, 255),
        "text_secondary": (255, 200, 200),
        "accent": (255, 255, 255),
        "overlay": (0, 0, 0, 100),
    },
    "sky_blue": {
        "background": (52, 152, 219),
        "text_primary": (255, 255, 255),
        "text_secondary": (174, 214, 241),
        "accent": (241, 196, 15),
        "overlay": (0, 0, 0, 80),
    },
    "rose_gold": {
        "background": (232, 180, 180),
        "text_primary": (80, 40, 40),
        "text_secondary": (140, 80, 80),
        "accent": (180, 100, 100),
        "overlay": (0, 0, 0, 60),
    },
    "dark_mode": {
        "background": (30, 30, 30),
        "text_primary": (255, 255, 255),
        "text_secondary": (180, 180, 180),
        "accent": (0, 200, 150),
        "overlay": (0, 0, 0, 150),
    },
}

# Gradient definitions (top_color, bottom_color)
GRADIENTS = {
    "sunset": ((255, 107, 107), (255, 196, 107)),
    "ocean": ((52, 152, 219), (46, 204, 113)),
    "royal": ((142, 68, 173), (52, 152, 219)),
    "fire": ((231, 76, 60), (243, 156, 18)),
    "forest": ((46, 204, 113), (39, 174, 96)),
    "night": ((44, 62, 80), (52, 73, 94)),
    "peach": ((255, 183, 150), (255, 107, 107)),
    "lavender": ((190, 170, 220), (142, 68, 173)),
}

# Niche-specific recommended color schemes
NICHE_COLORS = {
    "tech_gadgets": ["modern_coral", "dark_mode", "sky_blue", "elegant_navy"],
    "kitchen": ["warm_orange", "fresh_mint", "clean_white", "rose_gold"],
    "home_decor": ["rose_gold", "clean_white", "elegant_navy", "royal_purple"],
    "fashion": ["bold_red", "rose_gold", "royal_purple", "clean_white"],
    "fitness": ["fresh_mint", "bold_red", "sky_blue", "dark_mode"],
    "default": ["modern_coral", "elegant_navy", "clean_white", "sky_blue"],
}

# Pin dimensions
PIN_WIDTH = 1000
PIN_HEIGHT = 1500

# Font sizes (relative to pin size)
FONT_SIZES = {
    "title_large": 72,
    "title_medium": 56,
    "title_small": 44,
    "subtitle": 36,
    "body": 30,
    "body_small": 24,
    "caption": 20,
    "price": 64,
    "branding": 22,
}


def get_scheme(name):
    """Get a color scheme by name."""
    return COLOR_SCHEMES.get(name, COLOR_SCHEMES["modern_coral"])


def get_niche_schemes(niche):
    """Get recommended color scheme names for a niche."""
    return NICHE_COLORS.get(niche, NICHE_COLORS["default"])


def get_gradient(name):
    """Get a gradient definition."""
    return GRADIENTS.get(name, GRADIENTS["sunset"])
