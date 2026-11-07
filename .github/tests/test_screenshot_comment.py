"""Offline replay of screenshot artifact comment composition (no upload service)."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest


REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / ".github/compose_screenshot_comment.py"


class ScreenshotCommentTests(unittest.TestCase):
    def compose(self, artifacts):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "screenshot-artifacts.json").write_text(json.dumps(artifacts))
            return subprocess.run(
                [sys.executable, str(SCRIPT)],
                cwd=root,
                env={
                    **os.environ,
                    "GITHUB_REPOSITORY": "ActivityWatch/aw-webui",
                    "SCREENSHOT_RUN_ID": "12345",
                },
                capture_output=True,
                text=True,
                timeout=10,
            )

    def test_workflow_lists_triggering_run_artifacts_without_extracting_them(self):
        workflow = (REPO / ".github/workflows/comment.yml").read_text()
        script = workflow.split("        script: |\n", 1)[1].split("\n    - name:", 1)[
            0
        ]
        script = textwrap.dedent(script)
        harness = """
const assert = require('node:assert/strict');
const context = {repo: {owner: 'ActivityWatch', repo: 'aw-webui'}};
const list = () => {};
const github = {
  rest: {actions: {listWorkflowRunArtifacts: list}},
  paginate: async (method, options) => {
    assert.equal(method, list);
    assert.deepEqual(options, {
      owner: 'ActivityWatch', repo: 'aw-webui', run_id: 12345, per_page: 100,
    });
    return [{id: 42, name: 'screenshots-aw-server-v1', expired: false}];
  },
};
"""
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run(
                ["node", "-e", harness + "\n(async () => {\n" + script + "\n})();"],
                cwd=directory,
                env={**os.environ, "SCREENSHOT_RUN_ID": "12345"},
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            artifacts = json.loads(
                (Path(directory) / "screenshot-artifacts.json").read_text()
            )
            self.assertEqual(artifacts[0]["id"], 42)
        self.assertNotIn("execSync", workflow)
        self.assertNotIn("downloadArtifact", workflow)
        self.assertNotIn("pull_request.head.sha", workflow)

    def test_links_native_artifacts_without_calling_cml_publish(self):
        result = self.compose(
            [
                {"id": 42, "name": "screenshots-aw-server-v1", "expired": False},
                {"id": 43, "name": "screenshots-aw-server-rust-v2", "expired": False},
            ]
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        for artifact_id in (42, 43):
            self.assertIn(
                f"https://github.com/ActivityWatch/aw-webui/actions/runs/12345/artifacts/{artifact_id}",
                result.stdout,
            )
        self.assertIn("GitHub sign-in", result.stdout)
        self.assertNotIn("<img", result.stdout)

    def test_unrelated_and_expired_artifacts_are_excluded(self):
        result = self.compose(
            [
                {"id": 42, "name": "screenshots-aw-server-v1", "expired": False},
                {"id": 43, "name": "screenshots-old", "expired": True},
                {"id": 44, "name": "dist", "expired": False},
            ]
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("/artifacts/42", result.stdout)
        self.assertNotIn("/artifacts/43", result.stdout)
        self.assertNotIn("/artifacts/44", result.stdout)

    def test_missing_artifacts_emit_no_partial_comment(self):
        result = self.compose([])
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")

    def test_labels_cannot_inject_comment_html(self):
        result = self.compose(
            [
                {
                    "id": 42,
                    "name": 'screenshots-<img src=x onerror="bad">',
                    "expired": False,
                },
            ]
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("<img", result.stdout)
        self.assertIn("&lt;img", result.stdout)

    def test_invalid_artifact_id_emits_no_partial_comment(self):
        result = self.compose(
            [
                {
                    "id": '42"><img src=x>',
                    "name": "screenshots-aw-server",
                    "expired": False,
                },
            ]
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")


if __name__ == "__main__":
    unittest.main()
