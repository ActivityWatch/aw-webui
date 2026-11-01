"""Offline replay of the actual screenshot composition and posting workflow steps."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest


REPO = Path(os.environ.get("AW_SCREENSHOT_REPO", Path(__file__).resolve().parents[2]))
WORKFLOW = REPO / ".github/workflows/comment.yml"


def step(name):
    """Read a named block from this workflow's fixed six-space step structure."""
    lines = WORKFLOW.read_text().splitlines()
    start = lines.index(f"    - name: {name}") + 1
    end = next(
        (i for i in range(start, len(lines)) if lines[i].startswith("    - ")),
        len(lines),
    )
    block = lines[start:end]
    run_start = block.index("      run: |") + 1
    commands = []
    for line in block[run_start:]:
        if line and not line.startswith("        "):
            break
        commands.append(line)
    return block[:run_start], textwrap.dedent("\n".join(commands))


FAKE_CML = r"""
import json
import os
from pathlib import Path
import sys

args = sys.argv[1:]
log = Path("calls.jsonl")
previous = [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []
with log.open("a") as stream:
    stream.write(json.dumps(args) + "\n")
if args[:1] == ["publish"]:
    number = 1 + sum(row[:1] == ["publish"] for row in previous)
    if len(args) != 2 or not Path(args[1]).is_file():
        sys.exit(44)
    if number == int(os.environ.get("FAIL_AT", "0")):
        mode = os.environ["FAIL_MODE"]
        if mode == "nonzero":
            print("publisher failure", file=sys.stderr)
            sys.exit(23)
        if mode == "empty":
            sys.exit(0)
        print(os.environ.get("INVALID_URL", "not-a-url"))
    else:
        print(f"https://example.invalid/image-{number}.png")
elif args[:2] == ["comment", "create"]:
    Path("posted.md").write_text(Path(args[-1]).read_text())
else:
    sys.exit(45)
"""


class ScreenshotCommentTests(unittest.TestCase):
    def replay(self, images, mode="nonzero", fail_at=0, invalid_url="not-a-url"):
        compose_meta, compose = step("Compose comment")
        post_meta, post = step("Post screenshots in commit comment")
        # Default Actions success gating is part of the caller contract.
        self.assertFalse(any("continue-on-error:" in line for line in compose_meta))
        self.assertFalse(any(line.strip().startswith("if:") for line in post_meta))
        with tempfile.TemporaryDirectory(prefix="screenshot-comment-") as directory:
            root = Path(directory)
            shutil.copytree(REPO / ".github", root / ".github")
            for image in images:
                path = root / "screenshots" / image
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b"offline fixture")
            bindir = root / "bin"
            bindir.mkdir()
            fake = bindir / "cml"
            fake.write_text(f"#!{sys.executable}\n" + FAKE_CML)
            fake.chmod(0o755)
            env = {
                **os.environ,
                "PATH": f"{bindir}{os.pathsep}{os.environ['PATH']}",
                "FAIL_MODE": mode,
                "FAIL_AT": str(fail_at),
                "INVALID_URL": invalid_url,
                "head_sha": "fixture-sha",
                "repo_token": "offline-fixture",
            }
            result = subprocess.run(
                ["bash", "-e", "-o", "pipefail", "-c", compose],
                cwd=root,
                env=env,
                text=True,
                capture_output=True,
                timeout=20,
            )
            if result.returncode == 0:
                post = post.replace("${{ github.repository }}", "fixture/repository")
                posted = subprocess.run(
                    ["bash", "-e", "-o", "pipefail", "-c", post],
                    cwd=root,
                    env=env,
                    text=True,
                    capture_output=True,
                    timeout=20,
                )
                self.assertEqual(posted.returncode, 0, posted.stderr)
            elif (root / "comment.md").exists():
                self.assertEqual(
                    (root / "comment.md").read_text(), "", "Partial comment emitted"
                )
            log = root / "calls.jsonl"
            calls = (
                [json.loads(line) for line in log.read_text().splitlines()]
                if log.exists()
                else []
            )
            body = (
                (root / "posted.md").read_text()
                if (root / "posted.md").exists()
                else None
            )
            return result, calls, body

    def assert_refused(self, result, calls, body):
        self.assertNotEqual(
            result.returncode, 0, "Compose accepted invalid publication"
        )
        self.assertIsNone(body, "Post ran after invalid publication")
        self.assertFalse(any(call[:2] == ["comment", "create"] for call in calls))

    def test_success_posts_complete_comment(self):
        images = ["aw-server/v1/first.png", "aw-server-rust/v2/second.png"]
        result, calls, body = self.replay(images)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            [call[1] for call in calls if call[0] == "publish"],
            [f"screenshots/{image}" for image in images],
        )
        self.assertEqual(sum(call[:2] == ["comment", "create"] for call in calls), 1)
        for number in (1, 2):
            self.assertIn(f"https://example.invalid/image-{number}.png", body)
        self.assertEqual(body.count("<details>"), 2)
        self.assertEqual(body.count("</details>"), 2)

    def test_nonzero_publisher_stops_post(self):
        self.assert_refused(*self.replay(["aw-server/v1/first.png"], fail_at=1))

    def test_empty_publisher_output_stops_post(self):
        self.assert_refused(
            *self.replay(["aw-server/v1/first.png"], mode="empty", fail_at=1)
        )

    def test_invalid_url_stops_post(self):
        for url in (
            "not-a-url",
            '{"message":"Internal server error"}',
            "javascript:alert(1)",
            "https:///missing-host.png",
            "https://example.invalid:bad/image.png",
            " https://example.invalid/image.png",
            "https://example.invalid/image.png ",
            "https://example.invalid/first.png\nhttps://example.invalid/second.png",
            "https://example.invalid/image\x01.png",
            'https://example.invalid/" onerror="bad',
        ):
            with self.subTest(url=url):
                self.assert_refused(
                    *self.replay(
                        ["aw-server/v1/first.png"],
                        mode="invalid",
                        fail_at=1,
                        invalid_url=url,
                    )
                )

    def test_later_image_failure_never_posts_partial_comment(self):
        result, calls, body = self.replay(
            ["aw-server/v1/first.png", "aw-server/v1/second.png"], fail_at=2
        )
        self.assert_refused(result, calls, body)
        self.assertEqual(sum(call[0] == "publish" for call in calls), 2)

    def test_spaces_in_group_and_image_paths(self):
        image = "aw-server test/version one/screen shot.png"
        result, calls, body = self.replay([image])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            [call for call in calls if call[0] == "publish"],
            [["publish", f"screenshots/{image}"]],
        )
        self.assertIn("https://example.invalid/image-1.png", body)

    def test_empty_inventory_stops_post(self):
        self.assert_refused(*self.replay([]))

    def test_labels_and_url_query_are_html_escaped(self):
        result, calls, body = self.replay(
            ["aw-server <test>/version & one/screen.png"],
            mode="invalid",
            fail_at=1,
            invalid_url="https://example.invalid/image.png?first=1&second=2",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("aw-server &lt;test&gt; version &amp; one", body)
        self.assertIn(
            'src="https://example.invalid/image.png?first=1&amp;second=2"', body
        )
        self.assertEqual(sum(call[:2] == ["comment", "create"] for call in calls), 1)


if __name__ == "__main__":
    unittest.main()
