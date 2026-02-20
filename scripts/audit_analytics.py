#!/usr/bin/env python3
"""
Audit backend/frontend code for suspicious hardcoded analytics patterns.

Usage:
    python scripts/audit_analytics.py
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


TEXT_FILE_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".json",
}

EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".turbo",
    "coverage",
    ".pytest_cache",
    "playwright-report",
    "test-results",
}

EXCLUDED_FILENAMES = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
}

ANALYTICS_PATH_HINTS = (
    "analytics",
    "insight",
    "metric",
    "score",
    "heatmap",
    "dashboard",
    "chart",
    "graph",
    "report",
)


@dataclass(frozen=True)
class Finding:
    file: str
    line: int
    rule: str
    matched_pattern: str


LINE_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("math_random", re.compile(r"\bMath\.random\s*\(")),
    ("numpy_random", re.compile(r"\b(?:np|numpy)\.random(?:\.[A-Za-z_]\w*)?\s*\(")),
    (
        "python_random",
        re.compile(r"\brandom\.(?:random|randint|uniform|choice|choices|shuffle|sample|randrange)\s*\("),
    ),
    ("faker_usage", re.compile(r"\b(?:Faker|faker)\b")),
    ("mock_usage", re.compile(r"\bmock\b", re.IGNORECASE)),
    ("todo_placeholder", re.compile(r"TODO\s*:\s*placeholder", re.IGNORECASE)),
]

# Analytics-file-only line heuristics for hardcoded score-like assignments.
HARDCODED_SCORE_RULE = re.compile(
    r"\b(?:score|focus_score|productivity_score|engagement_score|accuracy)\b[\w\s]*[:=]\s*(-?\d{2,3}(?:\.\d+)?)\b",
    re.IGNORECASE,
)

# Analytics-file-only content heuristics for constant data/series arrays.
CONSTANT_SERIES_RULES: list[tuple[str, re.Pattern[str]]] = [
    (
        "constant_series_named_assignment",
        re.compile(
            r"\b(?:series|scores?|values?|trend|data(?:_points)?)\w*\s*=\s*\[(?:[^\[\]]*?\d[^\[\]]*?,){2,}[^\[\]]*?\]",
            re.IGNORECASE | re.DOTALL,
        ),
    ),
    (
        "constant_series_object_property",
        re.compile(
            r"\b(?:series|scores?|values?|trend|data(?:_points)?)\b\s*:\s*\[(?:[^\[\]]*?\d[^\[\]]*?,){2,}[^\[\]]*?\]",
            re.IGNORECASE | re.DOTALL,
        ),
    ),
]


def is_text_candidate(path: Path) -> bool:
    return path.suffix.lower() in TEXT_FILE_EXTENSIONS


def is_test_path(path: Path) -> bool:
    name = path.name.lower()
    parts = {part.lower() for part in path.parts}
    if "tests" in parts or "__tests__" in parts:
        return True
    if name.startswith("test_") or name.endswith(".test.ts") or name.endswith(".test.tsx"):
        return True
    if name.endswith(".spec.ts") or name.endswith(".spec.tsx"):
        return True
    return False


def should_skip(path: Path, include_tests: bool) -> bool:
    if any(part in EXCLUDED_DIRS for part in path.parts):
        return True
    if path.name in EXCLUDED_FILENAMES:
        return True
    if not include_tests and is_test_path(path):
        return True
    return False


def is_analytics_path(path: Path) -> bool:
    normalized = path.as_posix().lower()
    return any(hint in normalized for hint in ANALYTICS_PATH_HINTS)


def iter_files(roots: Iterable[Path], include_tests: bool) -> Iterable[Path]:
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and is_text_candidate(path) and not should_skip(path, include_tests):
                yield path


def line_number_from_offset(content: str, offset: int) -> int:
    return content.count("\n", 0, offset) + 1


def truncate_match(value: str, limit: int = 120) -> str:
    single_line = " ".join(value.split())
    if len(single_line) <= limit:
        return single_line
    return single_line[: limit - 3] + "..."


def collect_findings(path: Path, content: str, repo_root: Path) -> list[Finding]:
    findings: list[Finding] = []
    rel = path.relative_to(repo_root).as_posix()
    analytics_file = is_analytics_path(path)
    lines = content.splitlines()

    for idx, line in enumerate(lines, start=1):
        for rule_name, rule in LINE_RULES:
            match = rule.search(line)
            if match:
                findings.append(
                    Finding(
                        file=rel,
                        line=idx,
                        rule=rule_name,
                        matched_pattern=truncate_match(match.group(0)),
                    )
                )

        if analytics_file:
            match = HARDCODED_SCORE_RULE.search(line)
            if match:
                try:
                    value = float(match.group(1))
                except ValueError:
                    value = -1
                if 20 <= value <= 100:
                    findings.append(
                        Finding(
                            file=rel,
                            line=idx,
                            rule="hardcoded_score",
                            matched_pattern=truncate_match(match.group(0)),
                        )
                    )

    if analytics_file:
        for rule_name, rule in CONSTANT_SERIES_RULES:
            for match in rule.finditer(content):
                findings.append(
                    Finding(
                        file=rel,
                        line=line_number_from_offset(content, match.start()),
                        rule=rule_name,
                        matched_pattern=truncate_match(match.group(0)),
                    )
                )

    # Deduplicate exact duplicates while preserving deterministic output.
    deduped = sorted(set(findings), key=lambda f: (f.file, f.line, f.rule, f.matched_pattern))
    return deduped


def run(paths: list[str], include_tests: bool) -> int:
    repo_root = Path(__file__).resolve().parents[1]
    roots = [repo_root / p for p in paths]
    findings: list[Finding] = []

    for file_path in iter_files(roots, include_tests):
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        findings.extend(collect_findings(file_path, content, repo_root))

    findings = sorted(findings, key=lambda f: (f.file, f.line, f.rule))

    if not findings:
        print("No suspicious analytics hardcoding patterns found.")
        return 0

    print(f"Found {len(findings)} suspicious analytics pattern(s):")
    for finding in findings:
        print(
            f"- {finding.file}:{finding.line} | {finding.rule} | {finding.matched_pattern}"
        )
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Scan backend/frontend for hardcoded or placeholder analytics patterns."
    )
    parser.add_argument(
        "--paths",
        nargs="+",
        default=["backend", "frontend"],
        help="Directories to scan (default: backend frontend)",
    )
    parser.add_argument(
        "--include-tests",
        action="store_true",
        help="Include test files in the scan (default: excluded)",
    )
    args = parser.parse_args()
    return run(args.paths, args.include_tests)


if __name__ == "__main__":
    sys.exit(main())
