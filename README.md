# 🎬 Movie Match (Letterboxd Geo Scout)

A high-performance, anti-bot resilient tool to find Letterboxd users from specific geographic locations (e.g. Turkey, Ankara, Istanbul, Germany, Austin) who **liked** or **disliked** a specific movie.

---

## ⚡ Key Highlights & Bleeding-Edge Stack

- **Anti-Bot Bypass with `curl_cffi`**: Emulates real Chrome 124 / Safari 17 browser TLS signatures (JA3/JA4) and HTTP/2 behavior. Bypasses Cloudflare bot detection seamlessly.
- **Ultra-Fast HTML Parsing with `selectolax`**: C-based Lexbor engine provides up to 10x faster parsing than standard Python parsers.
- **Intelligent Geo-Hierarchy & Diacritics Folding**:
  - Automatically matches regional aliases (e.g. searching `Turkey` matches `Ankara`, `İstanbul`, `İzmir`, `Antalya`, `Bursa`, `Kadıköy`, `Çankaya`, etc.).
  - Searching `Ankara` matches `Ankara`, `Çankaya`, `Kızılay`, `Bilkent`, `ODTÜ`, `METU`, etc.
  - Normalizes Turkish diacritics (`İ/i`, `ı/I`, `ş/s`, `ğ/g`, `ü/u`, `ö/o`, `ç/c`).
- **Async Concurrency & Adaptive Backoff**: High-throughput async pipeline with concurrency controls and rate-limit backoff.
- **Persistent SQLite Caching (`aiosqlite`)**: Caches user profile locations and bios with configurable TTL (default 7 days) to eliminate redundant network calls.
- **Rich CLI & Modern Web Dashboard**:
  - Beautiful terminal interface with live progress bars and color-coded match tables.
  - Interactive web UI via FastAPI (`movie-match serve`).
  - Multi-format exports: **JSON**, **CSV**, **Markdown**.

---

## 🚀 Quick Start

### Installation

Using `uv` (recommended) or `pip`:

```bash
# Clone or navigate to the directory
cd /Users/ates/Documents/projects/movie-match

# Run directly with uv
uv run movie-match --help
```

Or install in editable mode:
```bash
uv pip install -e .
```

---

## 📖 CLI Usage Examples

### 1. Find users from Turkey who liked *Vampire Hunter D: Bloodlust*
```bash
uv run movie-match find "https://letterboxd.com/film/vampire-hunter-d-bloodlust/" \
  --location "Turkey" \
  --sentiment liked \
  --max-pages 5
```

### 2. Find users specifically from Ankara who liked a movie
```bash
uv run movie-match find "vampire-hunter-d-bloodlust" \
  --location "Ankara" \
  --liked \
  --output ankara_matches.json
```

### 3. Find users from Germany who disliked a movie (0.5 - 2.0 stars)
```bash
uv run movie-match find "the-substance" \
  --location "Germany" \
  --disliked \
  --output disliked_germany.csv
```

### 4. Custom Star Rating Filter (e.g. exactly 5 stars or 4.5-5 stars)
```bash
uv run movie-match find "fight-club" \
  --location "Istanbul" \
  --rating "4.5-5" \
  --limit 20
```

### 5. Inspect a Letterboxd User Profile
```bash
uv run movie-match profile "karsten"
```

### 6. Manage Profile Cache
```bash
# View cache stats
uv run movie-match cache

# Clear cache
uv run movie-match cache --clear
```

### 7. Launch the Application (Separated Backend & Next.js Frontend)

#### Start the FastAPI Backend:
```bash
uv run movie-match serve --port 8000
# or: uv run uvicorn movie_match.web.app:app --host 127.0.0.1 --port 8000
```
Backend API and OpenAPI docs will be available at `http://127.0.0.1:8000/docs`.

#### Start the Next.js SSR Frontend:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser. All pages utilize Next.js App Router with Server-Side Rendering (SSR).

---

## 🏗️ Architecture & Separation

- **Backend (`movie_match/`)**: Python FastAPI REST API providing endpoints for geo-matching, multi-film taste soulmates, user profiles, category films, and search history caching.
- **Frontend (`frontend/`)**: Next.js App Router (TypeScript + Tailwind CSS) leveraging React Server Components for fast SSR page loads, dynamic OpenGraph/SEO metadata, responsive dark mode, and client interaction controls.

## 🧪 Running Tests

Run the automated test suite with `pytest`:

```bash
uv run pytest -v
```
