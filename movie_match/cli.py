"""Rich CLI interface for movie-match powered by Typer and Rich."""

import asyncio
from pathlib import Path
from typing import Optional
import typer
from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from movie_match.cache.db import CacheDB
from movie_match.exporter.export import (
    export_to_csv,
    export_to_json,
    export_to_markdown,
    render_rich_table,
)
from movie_match.models import SearchQuery, SentimentType
from movie_match.scraper.letterboxd import LetterboxdScraper
from movie_match.scraper.parser import extract_slug_from_input


app = typer.Typer(
    name="movie-match",
    help="🎬 Find Letterboxd users from specific locations who liked or disliked movies.",
    add_completion=False,
)
console = Console()


@app.command(name="find")
def find_command(
    film: str = typer.Argument(
        ...,
        help="Letterboxd film URL (e.g. https://letterboxd.com/film/vampire-hunter-d-bloodlust/) or slug.",
    ),
    location: str = typer.Option(
        ...,
        "--location",
        "-l",
        help="Target location to match (e.g. 'Turkey', 'Ankara', 'Istanbul', 'Germany', 'USA', etc.).",
    ),
    sentiment: SentimentType = typer.Option(
        SentimentType.LIKED,
        "--sentiment",
        "-s",
        help="Sentiment filter: 'liked' (4-5 stars/likes/fans), 'disliked' (0.5-2 stars), 'all'.",
    ),
    rating: Optional[str] = typer.Option(
        None,
        "--rating",
        "-r",
        help="Specific rating or range (e.g. '5', '4.5', '4-5', '0.5-2'). Overrides sentiment.",
    ),
    liked: bool = typer.Option(
        False,
        "--liked",
        help="Shortcut to find users who liked/gave high rating to the movie.",
    ),
    disliked: bool = typer.Option(
        False,
        "--disliked",
        help="Shortcut to find users who disliked/gave low rating to the movie.",
    ),
    max_pages: int = typer.Option(
        5,
        "--max-pages",
        "-p",
        help="Maximum pages to scan per interaction endpoint.",
    ),
    limit: int = typer.Option(
        50,
        "--limit",
        "-n",
        help="Stop search after finding this many location matches.",
    ),
    concurrency: int = typer.Option(
        15,
        "--concurrency",
        "-c",
        help="Number of concurrent anti-bot requests.",
    ),
    include_bio: bool = typer.Option(
        True,
        "--include-bio/--no-bio",
        help="Search user bio text in addition to the location metadata field.",
    ),
    output: Optional[Path] = typer.Option(
        None,
        "--output",
        "-o",
        help="Export results to a file (.json, .csv, or .md).",
    ),
):
    """Find users from LOCATION who liked or disliked FILM on Letterboxd."""
    # Resolve sentiment flags
    active_sentiment = sentiment
    if liked:
        active_sentiment = SentimentType.LIKED
    elif disliked:
        active_sentiment = SentimentType.DISLIKED

    query = SearchQuery(
        film_input=film,
        location_query=location,
        sentiment=active_sentiment,
        rating_range=rating,
        include_bio=include_bio,
        max_pages=max_pages,
        limit_matches=limit,
        concurrency=concurrency,
    )

    async def run():
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TimeElapsedColumn(),
            console=console,
        ) as progress:
            task_id = progress.add_task(f"Searching Letterboxd for '{location}'...", total=None)

            def update_progress(desc: str, pages: int, candidates: int, matches: int):
                progress.update(
                    task_id,
                    description=f"[cyan]{desc}[/cyan] | [yellow]{candidates} candidates[/yellow] | [green]{matches} matches[/green]",
                )

            async with LetterboxdScraper(concurrency=concurrency) as scraper:
                matches, stats = await scraper.find_users(query, progress_callback=update_progress)

        render_rich_table(matches, stats, console=console)

        if output:
            ext = output.suffix.lower()
            if ext == ".json":
                export_to_json(matches, stats, output)
                console.print(f"[green]✓ Exported {len(matches)} results to {output}[/green]")
            elif ext == ".csv":
                export_to_csv(matches, output)
                console.print(f"[green]✓ Exported {len(matches)} results to {output}[/green]")
            elif ext in [".md", ".markdown"]:
                export_to_markdown(matches, stats, output)
                console.print(f"[green]✓ Exported {len(matches)} results to {output}[/green]")
            else:
                console.print(f"[red]Unsupported file format: {ext}. Use .json, .csv, or .md[/red]")

    asyncio.run(run())


@app.command(name="profile")
def profile_command(
    username: str = typer.Argument(..., help="Letterboxd username to inspect"),
):
    """Inspect a Letterboxd user profile and its location metadata."""
    async def run():
        async with LetterboxdScraper() as scraper:
            with console.status(f"Fetching @{username}..."):
                profile = await scraper.fetch_user_profile(username)
            if not profile:
                console.print(f"[red]Could not fetch profile for @{username}[/red]")
                return

            console.print(f"[bold cyan]User:[/bold cyan] {profile.display_name} (@{profile.username})")
            console.print(f"[bold green]Location:[/bold green] {profile.location or '(not set)'}")
            console.print(f"[bold yellow]Bio:[/bold yellow] {profile.bio or '(empty)'}")
            console.print(f"[bold blue]Profile Link:[/bold blue] {profile.profile_url}")
            if profile.is_pro:
                console.print("[bold orange1]Badge: PRO[/bold orange1]")
            if profile.is_patron:
                console.print("[bold magenta]Badge: PATRON[/bold magenta]")

    asyncio.run(run())


@app.command(name="cache")
def cache_command(
    clear: bool = typer.Option(False, "--clear", help="Clear all cached profiles and metadata"),
):
    """View or clear the local SQLite cache."""
    async def run():
        cache = CacheDB()
        await cache.init()
        if clear:
            await cache.clear_cache()
            console.print("[green]✓ Local cache cleared successfully.[/green]")
        else:
            count = await cache.count_cached_profiles()
            console.print(f"[cyan]Local cache database:[/cyan] {cache.db_path}")
            console.print(f"[bold green]Cached user profiles:[/bold green] {count}")
        await cache.close()

    asyncio.run(run())


@app.command(name="serve")
def serve_command(
    host: str = typer.Option("127.0.0.1", "--host", "-h", help="Host address to bind to"),
    port: int = typer.Option(8000, "--port", "-p", help="Port number"),
):
    """Launch the modern web UI dashboard and REST API."""
    import uvicorn
    console.print(f"[bold green]🚀 Starting Movie Match Web Server on http://{host}:{port}[/bold green]")
    uvicorn.run("movie_match.web.app:app", host=host, port=port, reload=False)


def main():
    app()


if __name__ == "__main__":
    main()
