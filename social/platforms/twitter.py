"""Twitter/X posting using Tweepy."""

import os
import yaml


def _get_config():
    """Load Twitter config."""
    config_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "config", "settings.yaml"
    )
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            config = yaml.safe_load(f)
        return config.get("social", {}).get("twitter", {})
    return {}


def _get_client():
    """Create a Tweepy client."""
    config = _get_config()

    api_key = os.environ.get("TWITTER_API_KEY", config.get("api_key", ""))
    api_secret = os.environ.get("TWITTER_API_SECRET", config.get("api_secret", ""))
    access_token = os.environ.get("TWITTER_ACCESS_TOKEN", config.get("access_token", ""))
    access_secret = os.environ.get(
        "TWITTER_ACCESS_TOKEN_SECRET", config.get("access_token_secret", "")
    )

    if not all([api_key, api_secret, access_token, access_secret]):
        return None

    import tweepy
    client = tweepy.Client(
        consumer_key=api_key,
        consumer_secret=api_secret,
        access_token=access_token,
        access_token_secret=access_secret,
    )
    return client


def post_tweet(text):
    """Post a single tweet.

    Returns tweet ID on success, None on failure.
    """
    client = _get_client()
    if not client:
        return None

    response = client.create_tweet(text=text[:280])
    return response.data.get("id") if response.data else None


def post_thread(tweets):
    """Post a thread of tweets.

    Args:
        tweets: List of tweet texts

    Returns list of tweet IDs.
    """
    client = _get_client()
    if not client:
        return None

    tweet_ids = []
    reply_to = None

    for tweet_text in tweets:
        kwargs = {"text": tweet_text[:280]}
        if reply_to:
            kwargs["in_reply_to_tweet_id"] = reply_to

        response = client.create_tweet(**kwargs)
        if response.data:
            tweet_id = response.data.get("id")
            tweet_ids.append(tweet_id)
            reply_to = tweet_id

    return tweet_ids


def post_latest_article():
    """Post the most recent article to Twitter."""
    import glob

    articles_dir = os.path.join(
        os.path.dirname(__file__), "..", "..", "data", "articles"
    )
    articles = sorted(glob.glob(os.path.join(articles_dir, "*.md")), reverse=True)

    if not articles:
        return None

    import frontmatter
    with open(articles[0], "r") as f:
        post = frontmatter.load(f)

    title = post.get("title", "New article")
    description = post.get("description", "")[:100]
    category = post.get("category", "")

    config = _get_config()
    hashtags = " ".join(
        config.get("hashtag_groups", {}).get(category, ["#BestDeals", "#India"])
    )

    tweet = f"📝 {title}\n\n{description}\n\n{hashtags}"

    return post_tweet(tweet)
