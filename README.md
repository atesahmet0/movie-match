# 🎬 Movie Match (Letterboxd Geo Scout & Taste Soulmates)

A high-performance, anti-bot resilient tool and web platform to scout Letterboxd users by geographic location (e.g. Turkey, Ankara, Istanbul, Germany, Austin) and match cinephiles by shared movie tastes and sentiment.

---

## ⚡ Key Highlights & Bleeding-Edge Stack

- **Anti-Bot Bypass & Rotating Proxy (`curl_cffi`)**: Emulates real Chrome 124 / Safari 17 browser TLS signatures (JA3/JA4) and HTTP/2 behavior with adaptive exponential backoff on 403 / 429 / 5xx responses. Bypasses Cloudflare bot detection seamlessly.
- **Ultra-Fast HTML Parsing (`selectolax`)**: C-based Lexbor engine provides up to 10x faster parsing than standard Python parsers.
- **Multi-User PostgreSQL & SQLite Caching (`asyncpg` / `aiosqlite`)**:
  - **PostgreSQL**: Production-ready connection pooling with native array lookups (`ANY($1::text[])`) and zero lock contention under concurrent multi-user searches.
  - **SQLite Fallback**: Zero-config local development and offline CLI caching when `DATABASE_URL` is omitted.
- **Multi-Film Taste Soulmate Matching**: Weighted algorithm computing taste compatibility, genre breadth, rating correlation, and affinity scores across multiple films and user libraries.
- **Intelligent Geo-Hierarchy & Diacritics Folding**:
  - Automatically matches regional aliases (e.g. searching `Turkey` matches `Ankara`, `İstanbul`, `İzmir`, `Antalya`, `Bursa`, `Kadıköy`, `Çankaya`, etc.).
  - Searching `Ankara` matches `Ankara`, `Çankaya`, `Kızılay`, `Bilkent`, `ODTÜ`, `METU`, etc.
  - Normalizes Turkish diacritics (`İ/i`, `ı/I`, `ş/s`, `ğ/g`, `ü/u`, `ö/o`, `ç/c`).
- **Rich CLI & Modern Next.js Web Dashboard**:
  - Beautiful terminal interface with live progress bars and color-coded match tables.
  - Interactive Next.js SSR frontend with dark mode, film search autocomplete, taste soulmate matching, and history inspection.

---

## 🚀 Quick Start

### 1. Prerequisites & Environment Setup

Copy or configure your `.env` file in the project root:

```bash
# Proxy configuration for Letterboxd scraping
PROXY_URL="http://username:password@proxy-host:port"

# PostgreSQL database configuration (optional; falls back to local SQLite if omitted)
DATABASE_URL="postgresql://postgres:password@localhost:5432/movie_match"
```

### 2. Start PostgreSQL (Docker)

If using PostgreSQL locally, spin up the container with Docker Compose:

```bash
docker compose up -d
```

### 3. Installation

Using `uv` (recommended) or `pip`:

```bash
# Sync dependencies with uv
uv sync
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

### 4. Custom Star Rating Filter (e.g. 4.5-5 stars)
```bash
uv run movie-match find "fight-club" \
  --location "Istanbul" \
  --rating "4.5-5" \
  --limit 20
```

### 5. Multi-Film Taste Match (Soulmates)
```bash
uv run movie-match taste-match "alien" "interstellar" "the-substance" \
  --location "Turkey" \
  --min-shared 2
```

### 6. Inspect a Letterboxd User Profile
```bash
uv run movie-match profile "karsten"
```

### 7. Manage Profile Cache
```bash
# View cache stats
uv run movie-match cache

# Clear cache
uv run movie-match cache --clear
```

---

## 🌐 Running the Web Application

### Step 1: Start the FastAPI Backend
```bash
uv run movie-match serve --port 8000
# or: uv run uvicorn movie_match.web.app:app --host 127.0.0.1 --port 8000
```
* Interactive OpenAPI documentation: `http://127.0.0.1:8000/docs`
* Health check: `http://127.0.0.1:8000/health`

### Step 2: Start the Next.js SSR Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🏗️ Architecture

- **Backend (`movie_match/`)**: Python FastAPI async REST API providing endpoints for geo-matching, multi-film taste soulmates, user profiles, category films, and search history caching.
- **Database Layer (`movie_match/cache/db.py`)**: Dual-backend support with PostgreSQL connection pooling (`asyncpg`) and SQLite fallback (`aiosqlite`).
- **Frontend (`frontend/`)**: Next.js App Router (TypeScript + Tailwind CSS) leveraging React Server Components for fast SSR page loads, dynamic OpenGraph/SEO metadata, responsive dark mode, and client interaction controls.

---

## 🧪 Running Tests

Run the automated test suite with `pytest`:

```bash
uv run pytest -v
```
