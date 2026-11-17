"""Link GitHub screenshot artifacts without a third-party image upload service."""

import html
import json
import os
from pathlib import Path
import sys


def compose() -> str:
    artifacts = json.loads(Path("screenshot-artifacts.json").read_text())
    screenshots = sorted(
        (
            artifact
            for artifact in artifacts
            if artifact["name"].startswith("screenshots-") and not artifact["expired"]
        ),
        key=lambda artifact: artifact["name"],
    )
    if not screenshots:
        raise RuntimeError("No unexpired screenshot artifacts found for this build")

    repository = os.environ["GITHUB_REPOSITORY"]
    run_id = int(os.environ["SCREENSHOT_RUN_ID"])
    lines = [
        "Here are the screenshot archives for this commit:",
        "",
        "GitHub sign-in is required to download artifacts; links expire with the build artifacts.",
        "",
    ]
    for artifact in screenshots:
        artifact_id = artifact["id"]
        if type(artifact_id) is not int or artifact_id <= 0:
            raise ValueError("Invalid screenshot artifact ID")
        url = f"https://github.com/{repository}/actions/runs/{run_id}/artifacts/{artifact_id}"
        label = html.escape(artifact["name"])
        lines.append(f'<a href="{url}">{label}</a><br/>')
    return "\n".join(lines)


if __name__ == "__main__":
    try:
        comment = compose()
    except (OSError, RuntimeError, ValueError, KeyError) as error:
        print(f"Screenshot comment failed: {error}", file=sys.stderr)
        sys.exit(1)
    print(comment)
