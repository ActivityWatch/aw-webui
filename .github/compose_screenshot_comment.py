"""Publish screenshots and emit a comment only after every publication succeeds."""

import html
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit


def publish(image: Path) -> str:
    result = subprocess.run(
        ["cml", "publish", str(image)], capture_output=True, text=True, check=False
    )
    if result.returncode:
        raise RuntimeError(
            f"Publication failed for {image} (exit {result.returncode}): "
            f"{result.stderr.strip()}"
        )
    url = result.stdout.rstrip("\r\n")
    try:
        parsed = urlsplit(url)
        valid = (
            bool(url)
            and parsed.scheme in ("http", "https")
            and bool(parsed.hostname)
            and not any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in url)
            and not any(c in url for c in '"<>')
        )
        # Accessing port validates malformed/non-numeric or out-of-range ports.
        parsed.port
    except ValueError:
        valid = False
    if not valid:
        raise RuntimeError(
            f"Publisher returned an invalid image URL for {image}: {url!r}"
        )
    return url


def compose() -> str:
    images = sorted(
        path for path in Path("screenshots").glob("aw-*/*/*.png") if path.is_file()
    )
    if not images:
        raise RuntimeError("No PNG screenshots found under screenshots/aw-*/*/")

    lines = ["Here are screenshots of this commit:", ""]
    current_group = None
    for image in images:
        group = image.parent
        if group != current_group:
            if current_group is not None:
                lines.extend(["</p>", "</details>"])
            label = html.escape(f"{group.parent.name} {group.name}")
            lines.extend(
                [
                    f"<details><summary>Screenshots using {label} (click to expand)</summary>",
                    '<p float="left">',
                ]
            )
            current_group = group
        url = html.escape(publish(image), quote=True)
        lines.append(f'<img width="45%" src="{url}"/>')
    lines.extend(["</p>", "</details>"])
    return "\n".join(lines)


if __name__ == "__main__":
    try:
        comment = compose()
    except (OSError, RuntimeError) as error:
        print(f"Screenshot comment failed: {error}", file=sys.stderr)
        sys.exit(1)
    print(comment)
