"""Social media posting workflow.

Called by GitHub Actions every 6 hours.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from social.scheduler import process_pending_posts


def run_social_pipeline():
    """Process all pending social media posts."""
    results = process_pending_posts()

    print("Social media posting results:")
    print(f"  Twitter: {results['twitter']} posted")
    print(f"  Medium: {results['medium']} posted")
    print(f"  Blogger: {results['blogger']} posted")
    print(f"  Errors: {results['errors']}")

    return results


if __name__ == "__main__":
    run_social_pipeline()
