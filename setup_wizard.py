#!/usr/bin/env python3
"""
SmartPicks Setup Wizard - Run this to configure everything.

Usage (on phone via Termux or any Python environment):
    python setup_wizard.py

Or set environment variables directly:
    export TELEGRAM_BOT_TOKEN="your_token"
    export TELEGRAM_OWNER_ID="your_id"
    export PINTEREST_ACCESS_TOKEN="your_token"
    python setup_wizard.py --verify
"""

import json
import os
import sys
import yaml

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "config")
SETTINGS_FILE = os.path.join(CONFIG_DIR, "settings.yaml")
PINTEREST_FILE = os.path.join(CONFIG_DIR, "pinterest.yaml")
ENV_FILE = os.path.join(os.path.dirname(__file__), ".env")


def colored(text, color):
    """Simple color output."""
    colors = {"green": "\033[92m", "red": "\033[91m", "yellow": "\033[93m",
              "blue": "\033[94m", "bold": "\033[1m", "end": "\033[0m"}
    return f"{colors.get(color, '')}{text}{colors['end']}"


def print_step(num, total, title):
    print(f"\n{'='*50}")
    print(colored(f"  STEP {num}/{total}: {title}", "bold"))
    print(f"{'='*50}\n")


def print_success(msg):
    print(colored(f"  ✅ {msg}", "green"))


def print_error(msg):
    print(colored(f"  ❌ {msg}", "red"))


def print_info(msg):
    print(colored(f"  ℹ️  {msg}", "blue"))


def print_warn(msg):
    print(colored(f"  ⚠️  {msg}", "yellow"))


# ============================================================
# STEP 1: Telegram Bot Token
# ============================================================
def setup_telegram():
    print_step(1, 6, "TELEGRAM BOT")

    print("  If you DON'T have a bot token yet:")
    print("  1. Open Telegram on your phone")
    print("  2. Search for @BotFather")
    print("  3. Send /newbot")
    print("  4. Choose a name (e.g., SmartPicks Bot)")
    print("  5. Choose a username (e.g., smartpicks_123_bot)")
    print("  6. BotFather will give you a token like:")
    print('     7123456789:AAHxyz_abc123def456\n')

    token = input("  Paste your Bot Token: ").strip()
    if not token or ":" not in token:
        print_error("Invalid token format. Should contain ':'")
        return None, None

    # Verify token
    try:
        import requests
        resp = requests.get(
            f"https://api.telegram.org/bot{token}/getMe", timeout=10
        )
        if resp.status_code == 200 and resp.json().get("ok"):
            bot = resp.json()["result"]
            print_success(f"Bot verified: @{bot['username']} ({bot['first_name']})")
        else:
            print_error("Token verification failed!")
            return None, None
    except Exception as e:
        print_warn(f"Could not verify (network issue): {e}")
        print_info("Continuing anyway...")

    print("\n  Now I need YOUR Telegram User ID:")
    print("  1. Open Telegram")
    print("  2. Search for @userinfobot")
    print("  3. Send /start")
    print("  4. It will reply with your User ID (a number)\n")

    user_id = input("  Paste your User ID (number): ").strip()
    if not user_id.isdigit():
        print_error("Invalid ID. Should be a number like: 987654321")
        return token, None

    print_success(f"Telegram configured! Bot token + User ID: {user_id}")
    return token, user_id


# ============================================================
# STEP 2: Pinterest Access Token
# ============================================================
def setup_pinterest():
    print_step(2, 6, "PINTEREST")

    print("  To get your Pinterest Access Token:")
    print("")
    print("  1. Go to: developers.pinterest.com")
    print("  2. Log in with your Pinterest account")
    print("  3. Click 'My apps' → 'Create app'")
    print("  4. Fill in:")
    print("     - App name: SmartPicks")
    print("     - Description: Content automation")
    print("     - Website: your GitHub Pages URL")
    print("  5. After creating, go to the app settings")
    print("  6. Click 'Generate' under Access Token")
    print("  7. Select these permissions:")
    print("     ✅ boards:read")
    print("     ✅ boards:write")
    print("     ✅ pins:read")
    print("     ✅ pins:write")
    print("  8. Copy the generated token\n")

    token = input("  Paste your Pinterest Access Token (or 'skip'): ").strip()

    if token.lower() == "skip" or not token:
        print_warn("Pinterest skipped. You can set it up later.")
        return None

    # Verify token
    try:
        import requests
        resp = requests.get(
            "https://api.pinterest.com/v5/user_account",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if resp.status_code == 200:
            user = resp.json()
            print_success(f"Pinterest verified: {user.get('username', 'OK')}")
        else:
            print_warn(f"Could not verify (status {resp.status_code})")
            print_info("Token saved anyway. Check it later.")
    except Exception as e:
        print_warn(f"Could not verify: {e}")

    return token


# ============================================================
# STEP 3: Amazon Associates
# ============================================================
def setup_affiliate():
    print_step(3, 6, "AMAZON ASSOCIATES (Affiliate)")

    print("  To sign up for Amazon Associates (FREE):")
    print("")
    print("  1. Go to: affiliate-program.amazon.in")
    print("  2. Click 'Sign Up'")
    print("  3. Log in with your Amazon account")
    print("  4. Fill your website URL:")
    print("     Use your GitHub Pages URL:")
    print("     https://YOUR_USERNAME.github.io/Anthropic-claude-code")
    print("  5. Choose categories (Tech, Kitchen, etc.)")
    print("  6. Enter your payment details")
    print("  7. After approval, find your Associate Tag")
    print("     It looks like: smartpick-21")
    print("")
    print("  ⏰ Takes 1-3 days for approval")
    print("  💡 You need 3 sales in 180 days to stay active\n")

    tag = input("  Your Associate Tag (or 'skip'): ").strip()

    if tag.lower() == "skip" or not tag:
        print_warn("Affiliate skipped. Sign up later at affiliate-program.amazon.in")
        return None

    print_success(f"Amazon tag: {tag}")
    return tag


# ============================================================
# STEP 4: Blog Settings
# ============================================================
def setup_blog():
    print_step(4, 6, "BLOG SETTINGS")

    print("  Let's personalize your blog!\n")

    blog_name = input("  Blog name (default: SmartPicks India): ").strip()
    if not blog_name:
        blog_name = "SmartPicks India"

    tagline = input("  Tagline (default: Honest reviews & best deals): ").strip()
    if not tagline:
        tagline = "Honest reviews & best deals"

    username = input("  Your GitHub username: ").strip()
    if not username:
        print_warn("No username entered. You'll need to update the URL later.")
        url = ""
    else:
        url = f"https://{username}.github.io/Anthropic-claude-code"
        print_success(f"Blog URL: {url}")

    print("")
    print("  Choose your main niche:")
    print("  1. Tech Gadgets (earbuds, phones, laptops)")
    print("  2. Kitchen (air fryers, mixers, appliances)")
    print("  3. Home Decor (furniture, lighting, decor)")
    print("  4. Fitness (equipment, supplements)")
    print("  5. Fashion (clothing, accessories)")
    print("")

    niche = input("  Enter number (1-5, default: 1): ").strip()
    niche_map = {
        "1": "tech_gadgets", "2": "kitchen", "3": "home_decor",
        "4": "fitness", "5": "fashion",
    }
    selected_niche = niche_map.get(niche, "tech_gadgets")
    print_success(f"Primary niche: {selected_niche}")

    return {
        "name": blog_name,
        "tagline": tagline,
        "url": url,
        "niche": selected_niche,
    }


# ============================================================
# STEP 5: Save Configuration
# ============================================================
def save_config(telegram_token, telegram_id, pinterest_token, amazon_tag, blog):
    print_step(5, 6, "SAVING CONFIGURATION")

    # Save to .env file (for local use)
    env_lines = []
    if telegram_token:
        env_lines.append(f"TELEGRAM_BOT_TOKEN={telegram_token}")
    if telegram_id:
        env_lines.append(f"TELEGRAM_OWNER_ID={telegram_id}")
    if pinterest_token:
        env_lines.append(f"PINTEREST_ACCESS_TOKEN={pinterest_token}")

    if env_lines:
        with open(ENV_FILE, "w") as f:
            f.write("\n".join(env_lines) + "\n")
        print_success(f".env file created with {len(env_lines)} variables")

    # Update settings.yaml
    with open(SETTINGS_FILE, "r") as f:
        settings = yaml.safe_load(f)

    if telegram_id:
        settings["owner"]["telegram_id"] = int(telegram_id)
    if telegram_token:
        settings["owner"]["telegram_bot_token"] = telegram_token
    if blog:
        settings["blog"]["name"] = blog["name"]
        settings["blog"]["tagline"] = blog["tagline"]
        if blog["url"]:
            settings["blog"]["url"] = blog["url"]

    with open(SETTINGS_FILE, "w") as f:
        yaml.dump(settings, f, default_flow_style=False, sort_keys=False)
    print_success("config/settings.yaml updated")

    # Update pinterest.yaml
    if pinterest_token:
        with open(PINTEREST_FILE, "r") as f:
            pinterest_config = yaml.safe_load(f)
        pinterest_config["pinterest"]["access_token"] = pinterest_token
        with open(PINTEREST_FILE, "w") as f:
            yaml.dump(pinterest_config, f, default_flow_style=False, sort_keys=False)
        print_success("config/pinterest.yaml updated")

    # Update affiliates.yaml
    if amazon_tag:
        affiliates_file = os.path.join(CONFIG_DIR, "affiliates.yaml")
        with open(affiliates_file, "r") as f:
            affiliates = yaml.safe_load(f)
        affiliates["programs"][0]["tag"] = amazon_tag
        with open(affiliates_file, "w") as f:
            yaml.dump(affiliates, f, default_flow_style=False, sort_keys=False)
        print_success(f"Amazon tag set to: {amazon_tag}")

    return True


# ============================================================
# STEP 6: GitHub Setup Instructions
# ============================================================
def github_instructions(telegram_token, telegram_id, pinterest_token):
    print_step(6, 6, "GITHUB SETUP (Do This on Your Phone)")

    print("  Open GitHub app or github.com on your phone:\n")

    print(colored("  A) Add Secrets (REQUIRED for automation):", "bold"))
    print("  1. Go to your repo → Settings → Secrets → Actions")
    print("  2. Click 'New repository secret'")
    print("  3. Add these secrets:\n")

    if telegram_token:
        print(f"     Name:  TELEGRAM_BOT_TOKEN")
        print(f"     Value: {telegram_token[:10]}...{telegram_token[-5:]}")
        print("")
    if telegram_id:
        print(f"     Name:  TELEGRAM_OWNER_ID")
        print(f"     Value: {telegram_id}")
        print("")
    if pinterest_token:
        print(f"     Name:  PINTEREST_ACCESS_TOKEN")
        print(f"     Value: {pinterest_token[:10]}...{pinterest_token[-5:]}")
        print("")

    print(colored("  B) Enable GitHub Pages (FREE blog hosting):", "bold"))
    print("  1. Go to repo → Settings → Pages")
    print("  2. Source: 'Deploy from a branch'")
    print("  3. Branch: 'claude/passive-income-automation-YBso9'")
    print("  4. Folder: '/docs'")
    print("  5. Click Save")
    print("")

    print(colored("  C) Enable GitHub Actions:", "bold"))
    print("  1. Go to repo → Actions tab")
    print("  2. Click 'I understand, enable Actions'")
    print("  3. The workflows will now run automatically!")
    print("")


# ============================================================
# Verification
# ============================================================
def verify_setup():
    print(f"\n{'='*50}")
    print(colored("  VERIFICATION", "bold"))
    print(f"{'='*50}\n")

    checks = {
        "settings.yaml exists": os.path.exists(SETTINGS_FILE),
        "pinterest.yaml exists": os.path.exists(PINTEREST_FILE),
        "requirements.txt exists": os.path.exists("requirements.txt"),
        "bot/main.py exists": os.path.exists("bot/main.py"),
        "pinterest/pin_generator.py exists": os.path.exists("pinterest/pin_generator.py"),
        "Sample articles exist": len(os.listdir("data/articles")) > 1,
        "Blog docs/ built": os.path.exists("docs/index.html"),
    }

    # Check .env or env vars
    has_telegram = bool(os.environ.get("TELEGRAM_BOT_TOKEN") or os.path.exists(ENV_FILE))
    checks["Telegram configured"] = has_telegram

    all_pass = True
    for check, passed in checks.items():
        if passed:
            print_success(check)
        else:
            print_error(check)
            all_pass = False

    if all_pass:
        print(colored("\n  🎉 ALL CHECKS PASSED! Your system is ready!", "green"))
    else:
        print(colored("\n  ⚠️  Some checks failed. Fix them and run again.", "yellow"))

    print("\n  Next steps:")
    print("  1. Add secrets to GitHub (Step 6 above)")
    print("  2. Enable GitHub Pages")
    print("  3. Send /start to your Telegram bot")
    print("  4. Start creating content with /newarticle")
    print("  5. Create Pinterest pins with /newpin")
    print("")

    return all_pass


# ============================================================
# Main
# ============================================================
def main():
    print("")
    print(colored("  ╔══════════════════════════════════════════╗", "bold"))
    print(colored("  ║   SmartPicks Setup Wizard               ║", "bold"))
    print(colored("  ║   Content + Affiliate + Pinterest        ║", "bold"))
    print(colored("  ║   Automation System                      ║", "bold"))
    print(colored("  ╚══════════════════════════════════════════╝", "bold"))
    print("")
    print("  This wizard will set up your entire system.")
    print("  You'll need your phone for some steps.\n")

    if "--verify" in sys.argv:
        verify_setup()
        return

    # Step 1: Telegram
    telegram_token, telegram_id = setup_telegram()

    # Step 2: Pinterest
    pinterest_token = setup_pinterest()

    # Step 3: Amazon Associates
    amazon_tag = setup_affiliate()

    # Step 4: Blog Settings
    blog = setup_blog()

    # Step 5: Save Config
    save_config(telegram_token, telegram_id, pinterest_token, amazon_tag, blog)

    # Step 6: GitHub Instructions
    github_instructions(telegram_token, telegram_id, pinterest_token)

    # Verify
    verify_setup()

    print(colored("  Setup complete! 🚀", "green"))
    print("  Run 'python setup_wizard.py --verify' anytime to check status.\n")


if __name__ == "__main__":
    main()
