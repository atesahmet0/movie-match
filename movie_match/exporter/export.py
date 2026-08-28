"""Exporters for search results: Rich console table, JSON, CSV, Markdown."""

import csv
import json
from pathlib import Path
from typing import List, Optional
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from movie_match.models import ScanStats, UserMatch


def render_rich_table(matches: List[UserMatch], stats: ScanStats, console: Optional[Console] = None):
    """Render a clean terminal table of results."""
    console = console or Console()

    # Summary Panel
    summary_text = Text()
    summary_text.append(f"Film: ", style="bold cyan")
    summary_text.append(f"{stats.film_title} ({stats.film_slug})\n", style="bold white")
    summary_text.append(f"Location Matches: ", style="bold green")
    summary_text.append(f"{len(matches)} users found  ", style="bold white")
    summary_text.append(f"Candidates Scanned: ", style="bold yellow")
    summary_text.append(f"{stats.total_users_discovered} (Cache hits: {stats.cache_hits})  ", style="dim white")
    summary_text.append(f"Time: ", style="bold magenta")
    summary_text.append(f"{stats.elapsed_seconds:.2f}s", style="white")

    console.print(Panel(summary_text, title="Movie Match Summary", border_style="cyan"))

    if not matches:
        console.print("[yellow]No matching users found for this location and criteria.[/yellow]")
        return

    table = Table(
        title="Matching Letterboxd Users",
        header_style="bold magenta",
        border_style="dim white",
        show_lines=True,
    )

    table.add_column("#", justify="right", style="dim", width=4)
    table.add_column("User", style="bold cyan", width=22)
    table.add_column("Location / Match", style="green", width=24)
    table.add_column("Rating / Sentiment", justify="center", style="yellow", width=18)
    table.add_column("Bio / Review Snippet", style="white", width=45)
    table.add_column("Profile Link", style="blue underline", width=32)

    for idx, m in enumerate(matches, 1):
        user_cell = Text()
        user_cell.append(f"{m.display_name}\n", style="bold white")
        user_cell.append(f"@{m.username}", style="dim cyan")

        loc_cell = Text()
        if m.location:
            loc_cell.append(f"{m.location}\n", style="bold green")
        if "bio" in m.matched_fields:
            loc_cell.append(f"[{m.matched_location}]", style="dim italic green")

        rating_cell = Text()
        if m.user_rating_stars:
            rating_cell.append(f"{m.user_rating_stars}\n", style="bold gold1")
        if m.user_liked:
            rating_cell.append("Liked  ", style="bold red")
        if m.found_via:
            rating_cell.append(f"({m.found_via})", style="dim white")

        snippet_cell = Text()
        if m.user_review:
            snippet_cell.append(f"\"{m.user_review[:120]}...\"\n", style="italic white")
        elif m.bio:
            snippet_cell.append(f"{m.bio[:120]}", style="dim white")
        else:
            snippet_cell.append("-", style="dim")

        table.add_row(
            str(idx),
            user_cell,
            loc_cell,
            rating_cell,
            snippet_cell,
            m.profile_url,
        )

    console.print(table)


def export_to_json(matches: List[UserMatch], stats: ScanStats, output_path: Path):
    """Export results to JSON."""
    data = {
        "stats": stats.model_dump(),
        "matches_count": len(matches),
        "matches": [m.model_dump() for m in matches],
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def export_to_csv(matches: List[UserMatch], output_path: Path):
    """Export results to CSV."""
    if not matches:
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["username", "display_name", "location", "matched_location", "rating", "liked", "profile_url", "bio", "review"])
        return

    fieldnames = [
        "username",
        "display_name",
        "location",
        "matched_location",
        "user_rating",
        "user_rating_stars",
        "user_liked",
        "profile_url",
        "found_via",
        "bio",
        "user_review",
    ]
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for m in matches:
            d = m.model_dump()
            # remove unneeded keys for CSV
            d.pop("avatar_url", None)
            d.pop("matched_fields", None)
            d.pop("sentiment_type", None)
            writer.writerow(d)


def export_to_markdown(matches: List[UserMatch], stats: ScanStats, output_path: Path):
    """Export results to a Markdown document."""
    lines = [
        f"# Letterboxd Movie Matches: {stats.film_title}",
        "",
        f"- **Film Slug**: `{stats.film_slug}`",
        f"- **Matches Found**: `{len(matches)}`",
        f"- **Candidates Scanned**: `{stats.total_users_discovered}`",
        f"- **Scan Time**: `{stats.elapsed_seconds:.2f}s`",
        "",
        "## Matching Users",
        "",
        "| # | User | Location | Rating / Likes | Bio / Review | Profile Link |",
        "|---|------|----------|----------------|--------------|--------------|",
    ]
    for idx, m in enumerate(matches, 1):
        stars = m.user_rating_stars or ("Liked" if m.user_liked else "-")
        review = (m.user_review or m.bio or "-").replace("\n", " ").replace("|", "\\|")[:100]
        lines.append(
            f"| {idx} | **{m.display_name}** (`@{m.username}`) | {m.location or m.matched_location} | {stars} | {review} | [{m.username}]({m.profile_url}) |"
        )
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
