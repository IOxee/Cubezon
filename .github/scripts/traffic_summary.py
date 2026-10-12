"""Merge GitHub traffic into a persistent CSV and render it as a job summary.

GitHub keeps views and clones for 14 days only, so every run merges the API window
into the history carried over from the previous run (a workflow artifact).

Env: GH_TOKEN (needs Administration: read), GITHUB_REPOSITORY, HISTORY_CSV, GITHUB_STEP_SUMMARY.
"""

import csv
import json
import os
import sys
import urllib.request
from pathlib import Path

API = "https://api.github.com"
FIELDS = ["date", "views", "views_unique", "clones", "clones_unique"]
CHART_DAYS = 30
TABLE_DAYS = 30


def api(path: str):
    request = urllib.request.Request(
        f"{API}{path}",
        headers={
            "Authorization": f"Bearer {os.environ['GH_TOKEN']}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def load_history(path: Path) -> dict[str, dict[str, int]]:
    if not path.exists():
        print(f"No previous history at {path}; starting from the API window.")
        return {}
    with path.open(newline="") as handle:
        return {
            row["date"]: {key: int(row[key]) for key in FIELDS[1:]}
            for row in csv.DictReader(handle)
        }


def merge(history: dict, views: dict, clones: dict) -> dict:
    """API values win: the latest fetch of a day is the most complete one."""
    merged = {day: dict(values) for day, values in history.items()}
    for entry in views["views"]:
        day = merged.setdefault(entry["timestamp"][:10], dict.fromkeys(FIELDS[1:], 0))
        day["views"], day["views_unique"] = entry["count"], entry["uniques"]
    for entry in clones["clones"]:
        day = merged.setdefault(entry["timestamp"][:10], dict.fromkeys(FIELDS[1:], 0))
        day["clones"], day["clones_unique"] = entry["count"], entry["uniques"]
    return merged


def save_history(path: Path, history: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(FIELDS)
        for day in sorted(history):
            writer.writerow([day, *(history[day][key] for key in FIELDS[1:])])


def chart(history: dict) -> list[str]:
    days = sorted(history)[-CHART_DAYS:]
    if not days:
        return []
    labels = ", ".join(f'"{day[5:]}"' for day in days)
    views = ", ".join(str(history[day]["views"]) for day in days)
    clones = ", ".join(str(history[day]["clones"]) for day in days)
    top = max(1, *(max(history[d]["views"], history[d]["clones"]) for d in days))
    return [
        "```mermaid",
        "xychart-beta",
        f'  title "Last {len(days)} days (views = first line, clones = second)"',
        f"  x-axis [{labels}]",
        f'  y-axis "Count" 0 --> {top}',
        f"  line [{views}]",
        f"  line [{clones}]",
        "```",
    ]


def table(header: list[str], rows: list[list]) -> list[str]:
    if not rows:
        return ["_No data yet._"]
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join(str(cell) for cell in row) + " |" for row in rows]
    return lines


def render(repo_name: str, history: dict, repo: dict, referrers, paths, releases) -> str:
    total = {key: sum(day[key] for day in history.values()) for key in FIELDS[1:]}
    downloads = [
        [release["tag_name"], asset["name"], asset["download_count"]]
        for release in releases
        for asset in release["assets"]
    ]
    since = min(history) if history else "-"
    lines = [
        f"# Traffic for {repo_name}",
        "",
        f"Dates in UTC. History since **{since}**. Unique counts are per day, so they are not summed across days.",
        "",
        *table(
            ["Views", "Clones", "Stars", "Forks", "Watchers", "Release downloads"],
            [[total["views"], total["clones"], repo["stargazers_count"], repo["forks_count"],
              repo["subscribers_count"], sum(row[2] for row in downloads)]],
        ),
        "",
        *chart(history),
        "",
        "## Daily",
        "",
        *table(
            ["Date", "Views", "Unique visitors", "Clones", "Unique cloners"],
            [[day, *(history[day][key] for key in FIELDS[1:])]
             for day in sorted(history, reverse=True)[:TABLE_DAYS]],
        ),
        "",
        "## Referrers (last 14 days)",
        "",
        *table(["Source", "Views", "Unique"],
               [[r["referrer"], r["count"], r["uniques"]] for r in referrers]),
        "",
        "## Popular content (last 14 days)",
        "",
        *table(["Path", "Views", "Unique"],
               [[p["path"], p["count"], p["uniques"]] for p in paths]),
        "",
        "## Release downloads",
        "",
        *table(["Release", "Asset", "Downloads"], downloads),
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    repo_name = os.environ["GITHUB_REPOSITORY"]
    history_path = Path(os.environ["HISTORY_CSV"])
    base = f"/repos/{repo_name}"

    history = merge(
        load_history(history_path),
        api(f"{base}/traffic/views"),
        api(f"{base}/traffic/clones"),
    )
    save_history(history_path, history)

    summary = render(
        repo_name,
        history,
        api(base),
        api(f"{base}/traffic/popular/referrers"),
        api(f"{base}/traffic/popular/paths"),
        api(f"{base}/releases?per_page=100"),
    )
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as handle:
        handle.write(summary)
    print(f"Saved {len(history)} days to {history_path}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
