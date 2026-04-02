"""Blog publisher - commits and pushes built site to gh-pages branch."""

import os
import subprocess


def publish_to_gh_pages(output_dir=None, commit_message=None):
    """Push the built site to the gh-pages branch.

    This is designed to run inside GitHub Actions where GITHUB_TOKEN
    provides authentication.

    Args:
        output_dir: Directory containing the built site (default: docs/)
        commit_message: Custom commit message
    """
    if output_dir is None:
        output_dir = os.path.join(
            os.path.dirname(__file__), "..", "docs"
        )
    output_dir = os.path.abspath(output_dir)

    if commit_message is None:
        from datetime import datetime
        commit_message = f"Deploy blog - {datetime.now().strftime('%Y-%m-%d %H:%M')}"

    repo_root = os.path.join(os.path.dirname(__file__), "..")
    repo_root = os.path.abspath(repo_root)

    # Add docs directory and push
    subprocess.run(["git", "add", "docs/"], cwd=repo_root, check=True)
    subprocess.run(
        ["git", "commit", "-m", commit_message],
        cwd=repo_root,
        check=True,
    )
    subprocess.run(
        ["git", "push", "origin", "HEAD"],
        cwd=repo_root,
        check=True,
    )

    return True
