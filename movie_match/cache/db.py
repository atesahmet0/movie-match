"""High-performance async multi-tier caching layer for Letterboxd data with PostgreSQL & SQLite dual-backend support."""

import json
import os
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import aiosqlite
from movie_match.logging import debug_tracker, get_logger
from movie_match.models import FilmMetadata, UserFilmItem, UserProfile, UserProfileDetail

try:
    import asyncpg
except ImportError:
    asyncpg = None

try:
    import redis.asyncio as redis_async
except ImportError:
    redis_async = None

logger = get_logger("cache")


DEFAULT_DB_PATH = Path.home() / ".cache" / "movie_match" / "cache.db"
DEFAULT_PROFILE_TTL = 7 * 86400  # 7 days for user profile location/bio
DEFAULT_INTERACTION_TTL = 2 * 86400  # 2 days for film interaction pages (likes, ratings)
DEFAULT_QUERY_TTL = 3600  # 1 hour for full search queries


class BaseCacheBackend(ABC):
    """Abstract interface for cache database backends."""

    @abstractmethod
    async def init(self) -> None:
        pass

    @abstractmethod
    async def close(self) -> None:
        pass

    @abstractmethod
    async def get_user_profile(self, username: str) -> Optional[UserProfile]:
        pass

    @abstractmethod
    async def get_user_profiles_batch(self, usernames: List[str]) -> Dict[str, UserProfile]:
        pass

    @abstractmethod
    async def save_user_profile(self, profile: UserProfile) -> None:
        pass

    @abstractmethod
    async def save_user_profiles_batch(self, profiles: List[UserProfile]) -> None:
        pass

    @abstractmethod
    async def get_film_page(self, slug: str, endpoint: str, page: int) -> Optional[List[Dict]]:
        pass

    @abstractmethod
    async def save_film_page(self, slug: str, endpoint: str, page: int, items: List[Dict]) -> None:
        pass

    @abstractmethod
    async def get_film_metadata(self, slug: str) -> Optional[FilmMetadata]:
        pass

    @abstractmethod
    async def save_film_metadata(self, film: FilmMetadata) -> None:
        pass

    @abstractmethod
    async def count_cached_profiles(self) -> int:
        pass

    @abstractmethod
    async def count_cached_film_pages(self) -> int:
        pass

    @abstractmethod
    async def save_search_history(
        self,
        film_slug: str,
        film_title: str,
        location_query: str,
        sentiment: str,
        matches_count: int,
        results_json: str,
        rating_range: Optional[str] = None,
    ) -> int:
        pass

    @abstractmethod
    async def get_search_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_search_history_item(self, history_id: int) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    async def clear_search_history(self) -> None:
        pass

    @abstractmethod
    async def get_saved_matched_users(
        self, limit: int = 100, location: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_user_profile_detail(self, username: str) -> Optional[UserProfileDetail]:
        pass

    @abstractmethod
    async def get_user_profile_details_batch(self, usernames: List[str]) -> Dict[str, UserProfileDetail]:
        pass

    @abstractmethod
    async def save_user_profile_detail(self, profile: UserProfileDetail) -> None:
        pass

    @abstractmethod
    async def get_user_films(self, username: str, category: str, page: int = 1) -> Optional[List[UserFilmItem]]:
        pass

    @abstractmethod
    async def save_user_films(self, username: str, category: str, page: int, films: List[UserFilmItem]) -> None:
        pass

    @abstractmethod
    async def get_query_result(self, query_key: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    async def save_query_result(self, query_key: str, data: Dict[str, Any]) -> None:
        pass

    @abstractmethod
    async def clear_cache(self) -> None:
        pass

    @abstractmethod
    async def save_waitlist_lead(self, email: str, feature: str = "") -> int:
        pass

    @abstractmethod
    async def get_waitlist_leads(self, limit: int = 100) -> List[Dict[str, Any]]:
        pass


class SqliteCacheBackend(BaseCacheBackend):
    """Persistent SQLite cache with multi-tier indexing for profiles, film pages, and queries."""

    def __init__(
        self,
        db_path: Optional[Path] = None,
        profile_ttl: float = DEFAULT_PROFILE_TTL,
        interaction_ttl: float = DEFAULT_INTERACTION_TTL,
        query_ttl: float = DEFAULT_QUERY_TTL,
        ttl_seconds: Optional[float] = None,
    ):
        self.db_path = Path(db_path) if db_path is not None else DEFAULT_DB_PATH
        self.profile_ttl = ttl_seconds if ttl_seconds is not None else profile_ttl
        self.interaction_ttl = interaction_ttl
        self.query_ttl = query_ttl
        self._conn: Optional[aiosqlite.Connection] = None
        self._mem_profiles: Dict[str, UserProfile] = {}

    async def init(self):
        """Initialize high-performance SQLite database schema and indexes."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = await aiosqlite.connect(str(self.db_path))
        await self._conn.execute("PRAGMA journal_mode = WAL;")
        await self._conn.execute("PRAGMA synchronous = NORMAL;")
        await self._conn.execute("PRAGMA cache_size = -16000;")  # 16MB in-memory SQLite cache
        await self._conn.execute("PRAGMA temp_store = MEMORY;")

        # 1. User profiles table
        await self._conn.execute("""
            CREATE TABLE IF NOT EXISTS user_profiles (
                username TEXT PRIMARY KEY,
                display_name TEXT,
                location TEXT,
                bio TEXT,
                avatar_url TEXT,
                profile_url TEXT,
                is_pro INTEGER,
                is_patron INTEGER,
                favorite_films_json TEXT,
                updated_at REAL
            )
        """)
        try:
            await self._conn.execute("ALTER TABLE user_profiles ADD COLUMN favorite_films_json TEXT")
        except Exception:
            pass

        await self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_profiles_loc ON user_profiles(location)"
        )

        # 2. Film metadata table
        await self._conn.execute("""
            CREATE TABLE IF NOT EXISTS film_metadata (
                slug TEXT PRIMARY KEY,
                title TEXT,
                year INTEGER,
                director TEXT,
                rating REAL,
                poster_url TEXT,
                member_count INTEGER,
                updated_at REAL
            )
        """)
        try:
            await self._conn.execute("ALTER TABLE film_metadata ADD COLUMN member_count INTEGER")
        except Exception:
            pass

        # 3. Film interaction page cache (likes, ratings, fans, reviews by page)
        await self._conn.execute("""
            CREATE TABLE IF NOT EXISTS film_page_cache (
                cache_key TEXT PRIMARY KEY,
                slug TEXT,
                endpoint TEXT,
                page INTEGER,
                data_json TEXT,
                updated_at REAL
            )
        """)
        await self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_film_page_slug ON film_page_cache(slug, endpoint)"
        )

        # 4. Search query results cache
        await self._conn.execute("""
            CREATE TABLE IF NOT EXISTS query_cache (
                query_key TEXT PRIMARY KEY,
                data_json TEXT,
                updated_at REAL
            )
        """)

        # 5. Search history table
        await self._conn.execute("""
            CREATE TABLE IF NOT EXISTS search_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                film_slug TEXT,
                film_title TEXT,
                location_query TEXT,
                sentiment TEXT,
                rating_range TEXT,
                matches_count INTEGER,
                results_json TEXT,
                created_at REAL
            )
        """)
        await self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_history_created ON search_history(created_at DESC)"
        )

        # 6. User profile detail cache
        await self._conn.execute("""
            CREATE TABLE IF NOT EXISTS user_detail_cache (
                username TEXT PRIMARY KEY,
                data_json TEXT,
                updated_at REAL
            )
        """)

        # 7. User films list cache
        await self._conn.execute("""
            CREATE TABLE IF NOT EXISTS user_films_cache (
                cache_key TEXT PRIMARY KEY,
                username TEXT,
                category TEXT,
                page INTEGER,
                data_json TEXT,
                updated_at REAL
            )
        """)

        # 8. Waitlist leads table
        await self._conn.execute("""
            CREATE TABLE IF NOT EXISTS waitlist_leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                feature TEXT,
                created_at REAL
            )
        """)
        await self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist_leads(created_at DESC)"
        )

        # Auto-backfill favorite_films_json from user_detail_cache if available
        try:
            cursor = await self._conn.execute("SELECT username, data_json FROM user_detail_cache")
            rows = await cursor.fetchall()
            for u, d_json in rows:
                if d_json:
                    d = json.loads(d_json)
                    favs = d.get("favorite_films", [])
                    if favs:
                        await self._conn.execute(
                            "UPDATE user_profiles SET favorite_films_json = ? WHERE username = ? AND (favorite_films_json IS NULL OR favorite_films_json = '[]')",
                            (json.dumps(favs, ensure_ascii=False), u.lower()),
                        )
        except Exception:
            pass

        await self._conn.commit()

    async def close(self):
        if self._conn:
            await self._conn.close()
            self._conn = None

    async def get_user_profile(self, username: str) -> Optional[UserProfile]:
        u_lower = username.lower()
        if u_lower in self._mem_profiles:
            p = self._mem_profiles[u_lower]
            if p.favorite_films:
                debug_tracker.record_cache_hit()
                logger.debug(f"[dim][Cache] L1 In-Memory Hit: @{username}[/dim]")
                return p

        if not self._conn:
            await self.init()
        now = time.time()
        cursor = await self._conn.execute(
            "SELECT username, display_name, location, bio, avatar_url, profile_url, is_pro, is_patron, favorite_films_json, updated_at "
            "FROM user_profiles WHERE username = ? AND updated_at >= ?",
            (u_lower, now - self.profile_ttl),
        )
        row = await cursor.fetchone()
        if row:
            favs: List[UserFilmItem] = []
            if row[8]:
                try:
                    favs = [UserFilmItem(**f) for f in json.loads(row[8])]
                except Exception:
                    pass
            if not favs:
                det_cursor = await self._conn.execute(
                    "SELECT data_json FROM user_detail_cache WHERE username = ?",
                    (u_lower,),
                )
                det_row = await det_cursor.fetchone()
                if det_row and det_row[0]:
                    try:
                        d = json.loads(det_row[0])
                        if d.get("favorite_films"):
                            favs = [UserFilmItem(**f) for f in d["favorite_films"]]
                    except Exception:
                        pass
            p = UserProfile(
                username=row[0],
                display_name=row[1] or "",
                location=row[2] or "",
                bio=row[3] or "",
                avatar_url=row[4] or "",
                profile_url=row[5] or f"https://letterboxd.com/{row[0]}/",
                is_pro=bool(row[6]),
                is_patron=bool(row[7]),
                favorite_films=favs,
                fetched_at=row[9],
            )
            self._mem_profiles[u_lower] = p
            debug_tracker.record_cache_hit()
            logger.debug(f"[dim][Cache] L2 SQLite Hit: @{username}[/dim]")
            return p
        debug_tracker.record_cache_miss()
        logger.debug(f"[dim][Cache] Miss: @{username}[/dim]")
        return None

    async def get_user_profiles_batch(self, usernames: List[str]) -> Dict[str, UserProfile]:
        if not usernames:
            return {}
        result: Dict[str, UserProfile] = {}
        missing: List[str] = []

        for u in usernames:
            u_lower = u.lower()
            if u_lower in self._mem_profiles:
                result[u_lower] = self._mem_profiles[u_lower]
            else:
                missing.append(u_lower)

        if not missing:
            debug_tracker.record_cache_hit(len(result))
            logger.debug(f"[dim][Cache] Batch user lookup: {len(usernames)} requested (all {len(result)} L1 hits)[/dim]")
            return result

        if not self._conn:
            await self.init()

        now = time.time()
        chunk_size = 500
        for i in range(0, len(missing), chunk_size):
            chunk = missing[i : i + chunk_size]
            placeholders = ",".join("?" for _ in chunk)
            query = (
                f"SELECT username, display_name, location, bio, avatar_url, profile_url, is_pro, is_patron, favorite_films_json, updated_at "
                f"FROM user_profiles WHERE username IN ({placeholders}) AND updated_at >= ?"
            )
            cursor = await self._conn.execute(query, (*chunk, now - self.profile_ttl))
            rows = await cursor.fetchall()
            for row in rows:
                favs: List[UserFilmItem] = []
                if row[8]:
                    try:
                        favs = [UserFilmItem(**f) for f in json.loads(row[8])]
                    except Exception:
                        pass
                p = UserProfile(
                    username=row[0],
                    display_name=row[1] or "",
                    location=row[2] or "",
                    bio=row[3] or "",
                    avatar_url=row[4] or "",
                    profile_url=row[5] or f"https://letterboxd.com/{row[0]}/",
                    is_pro=bool(row[6]),
                    is_patron=bool(row[7]),
                    favorite_films=favs,
                    fetched_at=row[9],
                )
                self._mem_profiles[p.username] = p
                result[p.username] = p

        hits = len(result)
        misses = len(usernames) - hits
        debug_tracker.record_cache_hit(hits)
        debug_tracker.record_cache_miss(misses)
        logger.debug(f"[dim][Cache] Batch user lookup: {len(usernames)} requested ({hits} hits, {misses} misses)[/dim]")
        return result


    async def save_user_profile(self, profile: UserProfile):
        self._mem_profiles[profile.username.lower()] = profile
        if not self._conn:
            await self.init()
        now = time.time()
        favs_json = json.dumps([f.model_dump() for f in (profile.favorite_films or [])], ensure_ascii=False)
        await self._conn.execute(
            """
            INSERT INTO user_profiles (username, display_name, location, bio, avatar_url, profile_url, is_pro, is_patron, favorite_films_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                display_name = excluded.display_name,
                location = excluded.location,
                bio = excluded.bio,
                avatar_url = excluded.avatar_url,
                profile_url = excluded.profile_url,
                is_pro = excluded.is_pro,
                is_patron = excluded.is_patron,
                favorite_films_json = excluded.favorite_films_json,
                updated_at = excluded.updated_at
            """,
            (
                profile.username.lower(),
                profile.display_name,
                profile.location,
                profile.bio,
                profile.avatar_url,
                profile.profile_url,
                1 if profile.is_pro else 0,
                1 if profile.is_patron else 0,
                favs_json,
                now,
            ),
        )
        await self._conn.commit()

    async def save_user_profiles_batch(self, profiles: List[UserProfile]):
        if not profiles:
            return
        for p in profiles:
            self._mem_profiles[p.username.lower()] = p

        if not self._conn:
            await self.init()
        now = time.time()
        data = [
            (
                p.username.lower(),
                p.display_name,
                p.location,
                p.bio,
                p.avatar_url,
                p.profile_url,
                1 if p.is_pro else 0,
                1 if p.is_patron else 0,
                json.dumps([f.model_dump() for f in (p.favorite_films or [])], ensure_ascii=False),
                now,
            )
            for p in profiles
        ]
        await self._conn.executemany(
            """
            INSERT INTO user_profiles (username, display_name, location, bio, avatar_url, profile_url, is_pro, is_patron, favorite_films_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                display_name = excluded.display_name,
                location = excluded.location,
                bio = excluded.bio,
                avatar_url = excluded.avatar_url,
                profile_url = excluded.profile_url,
                is_pro = excluded.is_pro,
                is_patron = excluded.is_patron,
                favorite_films_json = excluded.favorite_films_json,
                updated_at = excluded.updated_at
            """,
            data,
        )
        await self._conn.commit()

    async def get_film_page(self, slug: str, endpoint: str, page: int) -> Optional[List[Dict]]:
        if not self._conn:
            await self.init()
        cache_key = f"{slug.lower()}:{endpoint}:{page}"
        now = time.time()
        cursor = await self._conn.execute(
            "SELECT data_json FROM film_page_cache WHERE cache_key = ? AND updated_at >= ?",
            (cache_key, now - self.interaction_ttl),
        )
        row = await cursor.fetchone()
        if row and row[0]:
            try:
                data = json.loads(row[0])
                debug_tracker.record_cache_hit()
                logger.debug(f"[dim][Cache] Hit film page '{cache_key}' ({len(data)} items)[/dim]")
                return data
            except Exception:
                pass
        debug_tracker.record_cache_miss()
        logger.debug(f"[dim][Cache] Miss film page '{cache_key}'[/dim]")
        return None

    async def save_film_page(self, slug: str, endpoint: str, page: int, items: List[Dict]):
        if not self._conn:
            await self.init()
        cache_key = f"{slug.lower()}:{endpoint}:{page}"
        now = time.time()
        data_json = json.dumps(items, ensure_ascii=False)
        await self._conn.execute(
            """
            INSERT INTO film_page_cache (cache_key, slug, endpoint, page, data_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET
                data_json = excluded.data_json,
                updated_at = excluded.updated_at
            """,
            (cache_key, slug.lower(), endpoint, page, data_json, now),
        )
        await self._conn.commit()
        debug_tracker.record_cache_write()
        logger.debug(f"[dim][Cache] Saved film page '{cache_key}' ({len(items)} items)[/dim]")

    async def get_film_metadata(self, slug: str) -> Optional[FilmMetadata]:
        if not self._conn:
            await self.init()
        now = time.time()
        cursor = await self._conn.execute(
            "SELECT slug, title, year, director, rating, poster_url, member_count FROM film_metadata WHERE slug = ? AND updated_at >= ?",
            (slug.lower(), now - self.profile_ttl),
        )
        row = await cursor.fetchone()
        if row:
            debug_tracker.record_cache_hit()
            logger.debug(f"[dim][Cache] Hit film metadata: '{slug}'[/dim]")
            return FilmMetadata(
                slug=row[0],
                title=row[1] or "",
                year=row[2],
                director=row[3],
                rating=row[4],
                poster_url=row[5],
                member_count=row[6],
                url=f"https://letterboxd.com/film/{row[0]}/",
            )
        debug_tracker.record_cache_miss()
        logger.debug(f"[dim][Cache] Miss film metadata: '{slug}'[/dim]")
        return None

    async def save_film_metadata(self, film: FilmMetadata):
        if not self._conn:
            await self.init()
        now = time.time()
        await self._conn.execute(
            """
            INSERT INTO film_metadata (slug, title, year, director, rating, poster_url, member_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
                title = excluded.title,
                year = excluded.year,
                director = excluded.director,
                rating = excluded.rating,
                poster_url = excluded.poster_url,
                member_count = excluded.member_count,
                updated_at = excluded.updated_at
            """,
            (
                film.slug.lower(),
                film.title,
                film.year,
                film.director,
                film.rating,
                film.poster_url,
                film.member_count,
                now,
            ),
        )
        await self._conn.commit()
        debug_tracker.record_cache_write()
        logger.debug(f"[dim][Cache] Saved film metadata: '{film.slug}'[/dim]")


    async def count_cached_profiles(self) -> int:
        if not self._conn:
            await self.init()
        cursor = await self._conn.execute("SELECT COUNT(*) FROM user_profiles")
        row = await cursor.fetchone()
        return row[0] if row else 0

    async def count_cached_film_pages(self) -> int:
        if not self._conn:
            await self.init()
        cursor = await self._conn.execute("SELECT COUNT(*) FROM film_page_cache")
        row = await cursor.fetchone()
        return row[0] if row else 0

    async def save_search_history(
        self,
        film_slug: str,
        film_title: str,
        location_query: str,
        sentiment: str,
        matches_count: int,
        results_json: str,
        rating_range: Optional[str] = None,
    ) -> int:
        if not self._conn:
            await self.init()
        now = time.time()
        cursor = await self._conn.execute(
            """
            INSERT INTO search_history (film_slug, film_title, location_query, sentiment, rating_range, matches_count, results_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                film_slug.lower(),
                film_title,
                location_query,
                sentiment,
                rating_range or "",
                matches_count,
                results_json,
                now,
            ),
        )
        await self._conn.commit()
        return cursor.lastrowid or 0

    async def get_search_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        if not self._conn:
            await self.init()
        cursor = await self._conn.execute(
            """
            SELECT id, film_slug, film_title, location_query, sentiment, rating_range, matches_count, created_at
            FROM search_history
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
        history = []
        for r in rows:
            history.append({
                "id": r[0],
                "film_slug": r[1],
                "film_title": r[2],
                "location_query": r[3],
                "sentiment": r[4],
                "rating_range": r[5],
                "matches_count": r[6],
                "created_at": r[7],
            })
        return history

    async def get_search_history_item(self, history_id: int) -> Optional[Dict[str, Any]]:
        if not self._conn:
            await self.init()
        cursor = await self._conn.execute(
            """
            SELECT id, film_slug, film_title, location_query, sentiment, rating_range, matches_count, results_json, created_at
            FROM search_history
            WHERE id = ?
            """,
            (history_id,),
        )
        row = await cursor.fetchone()
        if row:
            return {
                "id": row[0],
                "film_slug": row[1],
                "film_title": row[2],
                "location_query": row[3],
                "sentiment": row[4],
                "rating_range": row[5],
                "matches_count": row[6],
                "results": json.loads(row[7]) if row[7] else [],
                "created_at": row[8],
            }
        return None

    async def clear_search_history(self):
        if not self._conn:
            await self.init()
        await self._conn.execute("DELETE FROM search_history")
        await self._conn.commit()

    async def get_saved_matched_users(
        self, limit: int = 100, location: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        if not self._conn:
            await self.init()
        if location and location.lower() != "anywhere":
            cursor = await self._conn.execute(
                """
                SELECT username, display_name, location, bio, avatar_url, profile_url, is_pro, is_patron, favorite_films_json, updated_at
                FROM user_profiles
                WHERE LOWER(location) LIKE ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (f"%{location.lower()}%", limit),
            )
        else:
            cursor = await self._conn.execute(
                """
                SELECT username, display_name, location, bio, avatar_url, profile_url, is_pro, is_patron, favorite_films_json, updated_at
                FROM user_profiles
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (limit,),
            )
        rows = await cursor.fetchall()
        users = []
        for r in rows:
            favs = []
            if r[8]:
                try:
                    favs = json.loads(r[8])
                except Exception:
                    pass
            users.append({
                "username": r[0],
                "display_name": r[1] or r[0],
                "location": r[2] or "",
                "bio": r[3] or "",
                "avatar_url": r[4] or "",
                "profile_url": r[5] or f"https://letterboxd.com/{r[0]}/",
                "is_pro": bool(r[6]),
                "is_patron": bool(r[7]),
                "favorite_films": favs,
                "saved_at": r[9],
            })
        return users

    async def get_user_profile_detail(self, username: str) -> Optional[UserProfileDetail]:
        if not self._conn:
            await self.init()
        now = time.time()
        cursor = await self._conn.execute(
            "SELECT data_json FROM user_detail_cache WHERE username = ? AND updated_at >= ?",
            (username.lower(), now - self.profile_ttl),
        )
        row = await cursor.fetchone()
        if row and row[0]:
            try:
                data = json.loads(row[0])
                return UserProfileDetail(**data)
            except Exception:
                return None
        return None

    async def get_user_profile_details_batch(self, usernames: List[str]) -> Dict[str, UserProfileDetail]:
        if not usernames:
            return {}
        if not self._conn:
            await self.init()
        unique = list(dict.fromkeys(u.lower() for u in usernames if u))
        result: Dict[str, UserProfileDetail] = {}
        now = time.time()
        for start in range(0, len(unique), 500):
            chunk = unique[start : start + 500]
            placeholders = ",".join("?" for _ in chunk)
            cursor = await self._conn.execute(
                f"SELECT username, data_json FROM user_detail_cache "
                f"WHERE username IN ({placeholders}) AND updated_at >= ?",
                (*chunk, now - self.profile_ttl),
            )
            for username, data_json in await cursor.fetchall():
                try:
                    result[username] = UserProfileDetail(**json.loads(data_json))
                except (TypeError, ValueError, json.JSONDecodeError):
                    continue
        return result

    async def save_user_profile_detail(self, profile: UserProfileDetail):
        if not self._conn:
            await self.init()
        now = time.time()
        await self.save_user_profile(profile)
        data_json = json.dumps(profile.model_dump(), ensure_ascii=False)
        await self._conn.execute(
            """
            INSERT INTO user_detail_cache (username, data_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                data_json = excluded.data_json,
                updated_at = excluded.updated_at
            """,
            (profile.username.lower(), data_json, now),
        )
        await self._conn.commit()

    async def get_user_films(self, username: str, category: str, page: int = 1) -> Optional[List[UserFilmItem]]:
        if not self._conn:
            await self.init()
        cache_key = f"{username.lower()}:{category}:{page}"
        now = time.time()
        cursor = await self._conn.execute(
            "SELECT data_json FROM user_films_cache WHERE cache_key = ? AND updated_at >= ?",
            (cache_key, now - self.interaction_ttl),
        )
        row = await cursor.fetchone()
        if row and row[0]:
            try:
                data = json.loads(row[0])
                return [UserFilmItem(**item) for item in data]
            except Exception:
                return None
        return None

    async def save_user_films(self, username: str, category: str, page: int, films: List[UserFilmItem]):
        if not self._conn:
            await self.init()
        cache_key = f"{username.lower()}:{category}:{page}"
        now = time.time()
        data_json = json.dumps([f.model_dump() for f in films], ensure_ascii=False)
        await self._conn.execute(
            """
            INSERT INTO user_films_cache (cache_key, username, category, page, data_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET
                data_json = excluded.data_json,
                updated_at = excluded.updated_at
            """,
            (cache_key, username.lower(), category, page, data_json, now),
        )
        await self._conn.commit()

    async def get_query_result(self, query_key: str) -> Optional[Dict[str, Any]]:
        if not self._conn:
            await self.init()
        cursor = await self._conn.execute(
            "SELECT data_json FROM query_cache WHERE query_key = ? AND updated_at >= ?",
            (query_key, time.time() - self.query_ttl),
        )
        row = await cursor.fetchone()
        if not row or not row[0]:
            debug_tracker.record_cache_miss()
            return None
        try:
            debug_tracker.record_cache_hit()
            return json.loads(row[0])
        except (TypeError, json.JSONDecodeError):
            return None

    async def save_query_result(self, query_key: str, data: Dict[str, Any]) -> None:
        if not self._conn:
            await self.init()
        await self._conn.execute(
            """
            INSERT INTO query_cache (query_key, data_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(query_key) DO UPDATE SET
                data_json = excluded.data_json,
                updated_at = excluded.updated_at
            """,
            (query_key, json.dumps(data, ensure_ascii=False), time.time()),
        )
        await self._conn.commit()
        debug_tracker.record_cache_write()

    async def clear_cache(self):
        self._mem_profiles.clear()
        if not self._conn:
            await self.init()
        await self._conn.execute("DELETE FROM user_profiles")
        await self._conn.execute("DELETE FROM film_metadata")
        await self._conn.execute("DELETE FROM film_page_cache")
        await self._conn.execute("DELETE FROM query_cache")
        await self._conn.execute("DELETE FROM user_detail_cache")
        await self._conn.execute("DELETE FROM user_films_cache")
        await self._conn.commit()

    async def save_waitlist_lead(self, email: str, feature: str = "") -> int:
        if not self._conn:
            await self.init()
        now = time.time()
        cursor = await self._conn.execute(
            """
            INSERT INTO waitlist_leads (email, feature, created_at)
            VALUES (?, ?, ?)
            """,
            (email.strip().lower(), feature, now),
        )
        await self._conn.commit()
        return cursor.lastrowid or 0

    async def get_waitlist_leads(self, limit: int = 100) -> List[Dict[str, Any]]:
        if not self._conn:
            await self.init()
        cursor = await self._conn.execute(
            """
            SELECT id, email, feature, created_at
            FROM waitlist_leads
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
        return [
            {"id": r[0], "email": r[1], "feature": r[2], "created_at": r[3]}
            for r in rows
        ]


class PostgresCacheBackend(BaseCacheBackend):
    """High-performance PostgreSQL cache backend using asyncpg with connection pooling and native batch arrays."""

    def __init__(
        self,
        database_url: str,
        profile_ttl: float = DEFAULT_PROFILE_TTL,
        interaction_ttl: float = DEFAULT_INTERACTION_TTL,
        query_ttl: float = DEFAULT_QUERY_TTL,
        ttl_seconds: Optional[float] = None,
        min_pool_size: int = 2,
        max_pool_size: int = 15,
    ):
        # Normalize postgres:// scheme to postgresql://
        if database_url.startswith("postgres://"):
            database_url = "postgresql://" + database_url[len("postgres://"):]
        elif database_url.startswith("postgresql+asyncpg://"):
            database_url = "postgresql://" + database_url[len("postgresql+asyncpg://"):]

        self.database_url = database_url
        self.profile_ttl = ttl_seconds if ttl_seconds is not None else profile_ttl
        self.interaction_ttl = interaction_ttl
        self.query_ttl = query_ttl
        self.min_pool_size = min_pool_size
        self.max_pool_size = max_pool_size
        self.pool: Optional[Any] = None
        self._mem_profiles: Dict[str, UserProfile] = {}

    async def init(self):
        """Initialize asyncpg connection pool and PostgreSQL tables/indexes."""
        if asyncpg is None:
            raise ImportError("asyncpg is required for PostgreSQL backend. Install with `pip install asyncpg`.")

        if not self.pool:
            self.pool = await asyncpg.create_pool(
                self.database_url,
                min_size=self.min_pool_size,
                max_size=self.max_pool_size,
            )

        async with self.pool.acquire() as conn:
            # 1. User profiles table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS user_profiles (
                    username TEXT PRIMARY KEY,
                    display_name TEXT,
                    location TEXT,
                    bio TEXT,
                    avatar_url TEXT,
                    profile_url TEXT,
                    is_pro BOOLEAN DEFAULT FALSE,
                    is_patron BOOLEAN DEFAULT FALSE,
                    favorite_films_json TEXT,
                    updated_at DOUBLE PRECISION
                );
                CREATE INDEX IF NOT EXISTS idx_user_profiles_loc ON user_profiles(location);
            """)

            # 2. Film metadata table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS film_metadata (
                    slug TEXT PRIMARY KEY,
                    title TEXT,
                    year INTEGER,
                    director TEXT,
                    rating DOUBLE PRECISION,
                    poster_url TEXT,
                    member_count INTEGER,
                    updated_at DOUBLE PRECISION
                );
                ALTER TABLE film_metadata ADD COLUMN IF NOT EXISTS member_count INTEGER;
            """)

            # 3. Film interaction page cache
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS film_page_cache (
                    cache_key TEXT PRIMARY KEY,
                    slug TEXT,
                    endpoint TEXT,
                    page INTEGER,
                    data_json TEXT,
                    updated_at DOUBLE PRECISION
                );
                CREATE INDEX IF NOT EXISTS idx_film_page_slug ON film_page_cache(slug, endpoint);
            """)

            # 4. Search query results cache
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS query_cache (
                    query_key TEXT PRIMARY KEY,
                    data_json TEXT,
                    updated_at DOUBLE PRECISION
                );
            """)

            # 5. Search history table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS search_history (
                    id BIGSERIAL PRIMARY KEY,
                    film_slug TEXT,
                    film_title TEXT,
                    location_query TEXT,
                    sentiment TEXT,
                    rating_range TEXT,
                    matches_count INTEGER,
                    results_json TEXT,
                    created_at DOUBLE PRECISION
                );
                CREATE INDEX IF NOT EXISTS idx_history_created ON search_history(created_at DESC);
            """)

            # 6. User detail cache
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS user_detail_cache (
                    username TEXT PRIMARY KEY,
                    data_json TEXT,
                    updated_at DOUBLE PRECISION
                );
            """)

            # 7. User films list cache
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS user_films_cache (
                    cache_key TEXT PRIMARY KEY,
                    username TEXT,
                    category TEXT,
                    page INTEGER,
                    data_json TEXT,
                    updated_at DOUBLE PRECISION
                );
            """)

            # 8. Waitlist leads table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS waitlist_leads (
                    id BIGSERIAL PRIMARY KEY,
                    email TEXT NOT NULL,
                    feature TEXT,
                    created_at DOUBLE PRECISION
                );
                CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist_leads(created_at DESC);
            """)

    async def close(self):
        if self.pool:
            await self.pool.close()
            self.pool = None

    async def get_user_profile(self, username: str) -> Optional[UserProfile]:
        u_lower = username.lower()
        if u_lower in self._mem_profiles:
            p = self._mem_profiles[u_lower]
            if p.favorite_films:
                return p

        if not self.pool:
            await self.init()

        now = time.time()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT username, display_name, location, bio, avatar_url, profile_url, is_pro, is_patron, favorite_films_json, updated_at
                FROM user_profiles
                WHERE username = $1 AND updated_at >= $2
                """,
                u_lower,
                now - self.profile_ttl,
            )
            if row:
                favs: List[UserFilmItem] = []
                if row["favorite_films_json"]:
                    try:
                        favs = [UserFilmItem(**f) for f in json.loads(row["favorite_films_json"])]
                    except Exception:
                        pass
                if not favs:
                    det_row = await conn.fetchrow(
                        "SELECT data_json FROM user_detail_cache WHERE username = $1",
                        u_lower,
                    )
                    if det_row and det_row["data_json"]:
                        try:
                            d = json.loads(det_row["data_json"])
                            if d.get("favorite_films"):
                                favs = [UserFilmItem(**f) for f in d["favorite_films"]]
                        except Exception:
                            pass
                p = UserProfile(
                    username=row["username"],
                    display_name=row["display_name"] or "",
                    location=row["location"] or "",
                    bio=row["bio"] or "",
                    avatar_url=row["avatar_url"] or "",
                    profile_url=row["profile_url"] or f"https://letterboxd.com/{row['username']}/",
                    is_pro=bool(row["is_pro"]),
                    is_patron=bool(row["is_patron"]),
                    favorite_films=favs,
                    fetched_at=row["updated_at"],
                )
                self._mem_profiles[u_lower] = p
                return p
        return None

    async def get_user_profiles_batch(self, usernames: List[str]) -> Dict[str, UserProfile]:
        if not usernames:
            return {}
        result: Dict[str, UserProfile] = {}
        missing: List[str] = []

        for u in usernames:
            u_lower = u.lower()
            if u_lower in self._mem_profiles:
                result[u_lower] = self._mem_profiles[u_lower]
            else:
                missing.append(u_lower)

        if not missing:
            return result

        if not self.pool:
            await self.init()

        now = time.time()
        async with self.pool.acquire() as conn:
            # Native PostgreSQL array matching for ultra-fast batch fetching
            rows = await conn.fetch(
                """
                SELECT username, display_name, location, bio, avatar_url, profile_url, is_pro, is_patron, favorite_films_json, updated_at
                FROM user_profiles
                WHERE username = ANY($1::text[]) AND updated_at >= $2
                """,
                missing,
                now - self.profile_ttl,
            )
            for row in rows:
                favs: List[UserFilmItem] = []
                if row["favorite_films_json"]:
                    try:
                        favs = [UserFilmItem(**f) for f in json.loads(row["favorite_films_json"])]
                    except Exception:
                        pass
                p = UserProfile(
                    username=row["username"],
                    display_name=row["display_name"] or "",
                    location=row["location"] or "",
                    bio=row["bio"] or "",
                    avatar_url=row["avatar_url"] or "",
                    profile_url=row["profile_url"] or f"https://letterboxd.com/{row['username']}/",
                    is_pro=bool(row["is_pro"]),
                    is_patron=bool(row["is_patron"]),
                    favorite_films=favs,
                    fetched_at=row["updated_at"],
                )
                self._mem_profiles[p.username] = p
                result[p.username] = p

        return result

    async def save_user_profile(self, profile: UserProfile):
        self._mem_profiles[profile.username.lower()] = profile
        if not self.pool:
            await self.init()
        now = time.time()
        favs_json = json.dumps([f.model_dump() for f in (profile.favorite_films or [])], ensure_ascii=False)
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO user_profiles (username, display_name, location, bio, avatar_url, profile_url, is_pro, is_patron, favorite_films_json, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (username) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    location = EXCLUDED.location,
                    bio = EXCLUDED.bio,
                    avatar_url = EXCLUDED.avatar_url,
                    profile_url = EXCLUDED.profile_url,
                    is_pro = EXCLUDED.is_pro,
                    is_patron = EXCLUDED.is_patron,
                    favorite_films_json = EXCLUDED.favorite_films_json,
                    updated_at = EXCLUDED.updated_at
                """,
                profile.username.lower(),
                profile.display_name,
                profile.location,
                profile.bio,
                profile.avatar_url,
                profile.profile_url,
                bool(profile.is_pro),
                bool(profile.is_patron),
                favs_json,
                now,
            )

    async def get_query_result(self, query_key: str) -> Optional[Dict[str, Any]]:
        if not self.pool:
            await self.init()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT data_json FROM query_cache WHERE query_key = $1 AND updated_at >= $2",
                query_key,
                time.time() - self.query_ttl,
            )
        if not row or not row["data_json"]:
            debug_tracker.record_cache_miss()
            return None
        try:
            debug_tracker.record_cache_hit()
            return json.loads(row["data_json"])
        except (TypeError, json.JSONDecodeError):
            return None

    async def save_query_result(self, query_key: str, data: Dict[str, Any]) -> None:
        if not self.pool:
            await self.init()
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO query_cache (query_key, data_json, updated_at)
                VALUES ($1, $2, $3)
                ON CONFLICT (query_key) DO UPDATE SET
                    data_json = EXCLUDED.data_json,
                    updated_at = EXCLUDED.updated_at
                """,
                query_key,
                json.dumps(data, ensure_ascii=False),
                time.time(),
            )
        debug_tracker.record_cache_write()

    async def save_user_profiles_batch(self, profiles: List[UserProfile]):
        if not profiles:
            return
        for p in profiles:
            self._mem_profiles[p.username.lower()] = p

        if not self.pool:
            await self.init()
        now = time.time()
        data = [
            (
                p.username.lower(),
                p.display_name,
                p.location,
                p.bio,
                p.avatar_url,
                p.profile_url,
                bool(p.is_pro),
                bool(p.is_patron),
                json.dumps([f.model_dump() for f in (p.favorite_films or [])], ensure_ascii=False),
                now,
            )
            for p in profiles
        ]
        async with self.pool.acquire() as conn:
            await conn.executemany(
                """
                INSERT INTO user_profiles (username, display_name, location, bio, avatar_url, profile_url, is_pro, is_patron, favorite_films_json, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (username) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    location = EXCLUDED.location,
                    bio = EXCLUDED.bio,
                    avatar_url = EXCLUDED.avatar_url,
                    profile_url = EXCLUDED.profile_url,
                    is_pro = EXCLUDED.is_pro,
                    is_patron = EXCLUDED.is_patron,
                    favorite_films_json = EXCLUDED.favorite_films_json,
                    updated_at = EXCLUDED.updated_at
                """,
                data,
            )

    async def get_film_page(self, slug: str, endpoint: str, page: int) -> Optional[List[Dict]]:
        if not self.pool:
            await self.init()
        cache_key = f"{slug.lower()}:{endpoint}:{page}"
        now = time.time()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT data_json FROM film_page_cache WHERE cache_key = $1 AND updated_at >= $2",
                cache_key,
                now - self.interaction_ttl,
            )
            if row and row["data_json"]:
                try:
                    return json.loads(row["data_json"])
                except Exception:
                    return None
        return None

    async def save_film_page(self, slug: str, endpoint: str, page: int, items: List[Dict]):
        if not self.pool:
            await self.init()
        cache_key = f"{slug.lower()}:{endpoint}:{page}"
        now = time.time()
        data_json = json.dumps(items, ensure_ascii=False)
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO film_page_cache (cache_key, slug, endpoint, page, data_json, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (cache_key) DO UPDATE SET
                    data_json = EXCLUDED.data_json,
                    updated_at = EXCLUDED.updated_at
                """,
                cache_key,
                slug.lower(),
                endpoint,
                page,
                data_json,
                now,
            )

    async def get_film_metadata(self, slug: str) -> Optional[FilmMetadata]:
        if not self.pool:
            await self.init()
        now = time.time()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT slug, title, year, director, rating, poster_url, member_count FROM film_metadata WHERE slug = $1 AND updated_at >= $2",
                slug.lower(),
                now - self.profile_ttl,
            )
            if row:
                return FilmMetadata(
                    slug=row["slug"],
                    title=row["title"] or "",
                    year=row["year"],
                    director=row["director"],
                    rating=row["rating"],
                    poster_url=row["poster_url"],
                    member_count=row["member_count"],
                    url=f"https://letterboxd.com/film/{row['slug']}/",
                )
        return None

    async def save_film_metadata(self, film: FilmMetadata):
        if not self.pool:
            await self.init()
        now = time.time()
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO film_metadata (slug, title, year, director, rating, poster_url, member_count, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (slug) DO UPDATE SET
                    title = EXCLUDED.title,
                    year = EXCLUDED.year,
                    director = EXCLUDED.director,
                    rating = EXCLUDED.rating,
                    poster_url = EXCLUDED.poster_url,
                    member_count = EXCLUDED.member_count,
                    updated_at = EXCLUDED.updated_at
                """,
                film.slug.lower(),
                film.title,
                film.year,
                film.director,
                film.rating,
                film.poster_url,
                film.member_count,
                now,
            )

    async def count_cached_profiles(self) -> int:
        if not self.pool:
            await self.init()
        async with self.pool.acquire() as conn:
            return await conn.fetchval("SELECT COUNT(*) FROM user_profiles") or 0

    async def count_cached_film_pages(self) -> int:
        if not self.pool:
            await self.init()
        async with self.pool.acquire() as conn:
            return await conn.fetchval("SELECT COUNT(*) FROM film_page_cache") or 0

    async def save_search_history(
        self,
        film_slug: str,
        film_title: str,
        location_query: str,
        sentiment: str,
        matches_count: int,
        results_json: str,
        rating_range: Optional[str] = None,
    ) -> int:
        if not self.pool:
            await self.init()
        now = time.time()
        async with self.pool.acquire() as conn:
            row_id = await conn.fetchval(
                """
                INSERT INTO search_history (film_slug, film_title, location_query, sentiment, rating_range, matches_count, results_json, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
                """,
                film_slug.lower(),
                film_title,
                location_query,
                sentiment,
                rating_range or "",
                matches_count,
                results_json,
                now,
            )
            return int(row_id or 0)

    async def get_search_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        if not self.pool:
            await self.init()
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, film_slug, film_title, location_query, sentiment, rating_range, matches_count, created_at
                FROM search_history
                ORDER BY created_at DESC
                LIMIT $1
                """,
                limit,
            )
            history = []
            for r in rows:
                history.append({
                    "id": r["id"],
                    "film_slug": r["film_slug"],
                    "film_title": r["film_title"],
                    "location_query": r["location_query"],
                    "sentiment": r["sentiment"],
                    "rating_range": r["rating_range"],
                    "matches_count": r["matches_count"],
                    "created_at": r["created_at"],
                })
            return history

    async def get_search_history_item(self, history_id: int) -> Optional[Dict[str, Any]]:
        if not self.pool:
            await self.init()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, film_slug, film_title, location_query, sentiment, rating_range, matches_count, results_json, created_at
                FROM search_history
                WHERE id = $1
                """,
                history_id,
            )
            if row:
                return {
                    "id": row["id"],
                    "film_slug": row["film_slug"],
                    "film_title": row["film_title"],
                    "location_query": row["location_query"],
                    "sentiment": row["sentiment"],
                    "rating_range": row["rating_range"],
                    "matches_count": row["matches_count"],
                    "results": json.loads(row["results_json"]) if row["results_json"] else [],
                    "created_at": row["created_at"],
                }
        return None

    async def clear_search_history(self):
        if not self.pool:
            await self.init()
        async with self.pool.acquire() as conn:
            await conn.execute("DELETE FROM search_history")

    async def get_saved_matched_users(
        self, limit: int = 100, location: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        if not self.pool:
            await self.init()
        async with self.pool.acquire() as conn:
            if location and location.lower() != "anywhere":
                rows = await conn.fetch(
                    """
                    SELECT username, display_name, location, bio, avatar_url, profile_url, is_pro, is_patron, favorite_films_json, updated_at
                    FROM user_profiles
                    WHERE LOWER(location) LIKE $1
                    ORDER BY updated_at DESC
                    LIMIT $2
                    """,
                    f"%{location.lower()}%",
                    limit,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT username, display_name, location, bio, avatar_url, profile_url, is_pro, is_patron, favorite_films_json, updated_at
                    FROM user_profiles
                    ORDER BY updated_at DESC
                    LIMIT $1
                    """,
                    limit,
                )
            users = []
            for r in rows:
                favs = []
                if r["favorite_films_json"]:
                    try:
                        favs = json.loads(r["favorite_films_json"])
                    except Exception:
                        pass
                users.append({
                    "username": r["username"],
                    "display_name": r["display_name"] or r["username"],
                    "location": r["location"] or "",
                    "bio": r["bio"] or "",
                    "avatar_url": r["avatar_url"] or "",
                    "profile_url": r["profile_url"] or f"https://letterboxd.com/{r['username']}/",
                    "is_pro": bool(r["is_pro"]),
                    "is_patron": bool(r["is_patron"]),
                    "favorite_films": favs,
                    "saved_at": r["updated_at"],
                })
            return users

    async def get_user_profile_detail(self, username: str) -> Optional[UserProfileDetail]:
        if not self.pool:
            await self.init()
        now = time.time()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT data_json FROM user_detail_cache WHERE username = $1 AND updated_at >= $2",
                username.lower(),
                now - self.profile_ttl,
            )
            if row and row["data_json"]:
                try:
                    data = json.loads(row["data_json"])
                    return UserProfileDetail(**data)
                except Exception:
                    return None
        return None

    async def get_user_profile_details_batch(self, usernames: List[str]) -> Dict[str, UserProfileDetail]:
        if not usernames:
            return {}
        if not self.pool:
            await self.init()
        unique = list(dict.fromkeys(u.lower() for u in usernames if u))
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT username, data_json FROM user_detail_cache
                WHERE username = ANY($1::text[]) AND updated_at >= $2
                """,
                unique,
                time.time() - self.profile_ttl,
            )
        result: Dict[str, UserProfileDetail] = {}
        for row in rows:
            try:
                result[row["username"]] = UserProfileDetail(**json.loads(row["data_json"]))
            except (TypeError, ValueError, json.JSONDecodeError):
                continue
        return result

    async def save_user_profile_detail(self, profile: UserProfileDetail):
        if not self.pool:
            await self.init()
        now = time.time()
        await self.save_user_profile(profile)
        data_json = json.dumps(profile.model_dump(), ensure_ascii=False)
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO user_detail_cache (username, data_json, updated_at)
                VALUES ($1, $2, $3)
                ON CONFLICT (username) DO UPDATE SET
                    data_json = EXCLUDED.data_json,
                    updated_at = EXCLUDED.updated_at
                """,
                profile.username.lower(),
                data_json,
                now,
            )

    async def get_user_films(self, username: str, category: str, page: int = 1) -> Optional[List[UserFilmItem]]:
        if not self.pool:
            await self.init()
        cache_key = f"{username.lower()}:{category}:{page}"
        now = time.time()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT data_json FROM user_films_cache WHERE cache_key = $1 AND updated_at >= $2",
                cache_key,
                now - self.interaction_ttl,
            )
            if row and row["data_json"]:
                try:
                    data = json.loads(row["data_json"])
                    return [UserFilmItem(**item) for item in data]
                except Exception:
                    return None
        return None

    async def save_user_films(self, username: str, category: str, page: int, films: List[UserFilmItem]):
        if not self.pool:
            await self.init()
        cache_key = f"{username.lower()}:{category}:{page}"
        now = time.time()
        data_json = json.dumps([f.model_dump() for f in films], ensure_ascii=False)
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO user_films_cache (cache_key, username, category, page, data_json, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (cache_key) DO UPDATE SET
                    data_json = EXCLUDED.data_json,
                    updated_at = EXCLUDED.updated_at
                """,
                cache_key,
                username.lower(),
                category,
                page,
                data_json,
                now,
            )

    async def clear_cache(self):
        self._mem_profiles.clear()
        if not self.pool:
            await self.init()
        async with self.pool.acquire() as conn:
            await conn.execute("DELETE FROM user_profiles")
            await conn.execute("DELETE FROM film_metadata")
            await conn.execute("DELETE FROM film_page_cache")
            await conn.execute("DELETE FROM query_cache")
            await conn.execute("DELETE FROM user_detail_cache")
            await conn.execute("DELETE FROM user_films_cache")

    async def save_waitlist_lead(self, email: str, feature: str = "") -> int:
        if not self.pool:
            await self.init()
        now = time.time()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO waitlist_leads (email, feature, created_at)
                VALUES ($1, $2, $3)
                RETURNING id
                """,
                email.strip().lower(),
                feature,
                now,
            )
            return row["id"] if row else 0

    async def get_waitlist_leads(self, limit: int = 100) -> List[Dict[str, Any]]:
        if not self.pool:
            await self.init()
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, email, feature, created_at
                FROM waitlist_leads
                ORDER BY created_at DESC
                LIMIT $1
                """,
                limit,
            )
            return [
                {
                    "id": r["id"],
                    "email": r["email"],
                    "feature": r["feature"],
                    "created_at": r["created_at"],
                }
                for r in rows
            ]


class CacheDB(BaseCacheBackend):
    """
    Unified database caching layer with automatic dual-backend dispatch.
    
    - If `DATABASE_URL` (or `POSTGRES_URL`) is configured, uses high-performance PostgreSQL (`asyncpg`).
    - Otherwise, falls back to local SQLite (`aiosqlite`) seamlessly.
    """

    def __init__(
        self,
        db_path: Optional[Path] = None,
        database_url: Optional[str] = None,
        profile_ttl: float = DEFAULT_PROFILE_TTL,
        interaction_ttl: float = DEFAULT_INTERACTION_TTL,
        query_ttl: float = DEFAULT_QUERY_TTL,
        ttl_seconds: Optional[float] = None,
    ):
        if database_url is not None:
            resolved_db_url = database_url
        elif db_path is not None:
            resolved_db_url = None
        else:
            resolved_db_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")

        if resolved_db_url and (
            resolved_db_url.startswith("postgres://")
            or resolved_db_url.startswith("postgresql://")
            or resolved_db_url.startswith("postgresql+asyncpg://")
        ):
            self.backend: BaseCacheBackend = PostgresCacheBackend(
                database_url=resolved_db_url,
                profile_ttl=profile_ttl,
                interaction_ttl=interaction_ttl,
                query_ttl=query_ttl,
                ttl_seconds=ttl_seconds,
            )
            self.backend_type = "postgres"
        else:
            self.backend = SqliteCacheBackend(
                db_path=db_path,
                profile_ttl=profile_ttl,
                interaction_ttl=interaction_ttl,
                query_ttl=query_ttl,
                ttl_seconds=ttl_seconds,
            )
            self.backend_type = "sqlite"
        self.db_path = db_path
        self.profile_ttl = profile_ttl
        self.interaction_ttl = interaction_ttl
        self.query_ttl = query_ttl
        self.ttl_seconds = ttl_seconds
        self._redis_url = os.getenv("REDIS_URL")
        self._redis = None

    async def init(self) -> None:
        try:
            await self.backend.init()
        except Exception as exc:
            if self.backend_type == "postgres":
                logger.warning(f"PostgreSQL connection failed ({exc}). Falling back to local SQLite cache.")
                self.backend = SqliteCacheBackend(
                    db_path=self.db_path,
                    profile_ttl=self.profile_ttl,
                    interaction_ttl=self.interaction_ttl,
                    query_ttl=self.query_ttl,
                    ttl_seconds=self.ttl_seconds,
                )
                self.backend_type = "sqlite"
                await self.backend.init()
            else:
                raise
        if self._redis_url and redis_async is not None and self._redis is None:
            candidate = redis_async.from_url(
                self._redis_url,
                decode_responses=True,
                socket_connect_timeout=0.5,
                socket_timeout=0.5,
            )
            try:
                await candidate.ping()
                self._redis = candidate
                logger.info("Distributed Redis query cache connected")
            except Exception:
                await candidate.aclose()
                logger.warning("Redis unavailable; continuing with database query cache")

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None
        await self.backend.close()

    async def get_user_profile(self, username: str) -> Optional[UserProfile]:
        return await self.backend.get_user_profile(username)

    async def get_user_profiles_batch(self, usernames: List[str]) -> Dict[str, UserProfile]:
        return await self.backend.get_user_profiles_batch(usernames)

    async def save_user_profile(self, profile: UserProfile) -> None:
        await self.backend.save_user_profile(profile)

    async def save_user_profiles_batch(self, profiles: List[UserProfile]) -> None:
        await self.backend.save_user_profiles_batch(profiles)

    async def get_film_page(self, slug: str, endpoint: str, page: int) -> Optional[List[Dict]]:
        return await self.backend.get_film_page(slug, endpoint, page)

    async def save_film_page(self, slug: str, endpoint: str, page: int, items: List[Dict]) -> None:
        await self.backend.save_film_page(slug, endpoint, page, items)

    async def get_film_metadata(self, slug: str) -> Optional[FilmMetadata]:
        return await self.backend.get_film_metadata(slug)

    async def save_film_metadata(self, film: FilmMetadata) -> None:
        await self.backend.save_film_metadata(film)

    async def count_cached_profiles(self) -> int:
        return await self.backend.count_cached_profiles()

    async def count_cached_film_pages(self) -> int:
        return await self.backend.count_cached_film_pages()

    async def save_search_history(
        self,
        film_slug: str,
        film_title: str,
        location_query: str,
        sentiment: str,
        matches_count: int,
        results_json: str,
        rating_range: Optional[str] = None,
    ) -> int:
        return await self.backend.save_search_history(
            film_slug=film_slug,
            film_title=film_title,
            location_query=location_query,
            sentiment=sentiment,
            matches_count=matches_count,
            results_json=results_json,
            rating_range=rating_range,
        )

    async def get_search_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        return await self.backend.get_search_history(limit=limit)

    async def get_search_history_item(self, history_id: int) -> Optional[Dict[str, Any]]:
        return await self.backend.get_search_history_item(history_id=history_id)

    async def clear_search_history(self) -> None:
        await self.backend.clear_search_history()

    async def get_saved_matched_users(
        self, limit: int = 100, location: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        return await self.backend.get_saved_matched_users(limit=limit, location=location)

    async def get_user_profile_detail(self, username: str) -> Optional[UserProfileDetail]:
        return await self.backend.get_user_profile_detail(username)

    async def get_user_profile_details_batch(self, usernames: List[str]) -> Dict[str, UserProfileDetail]:
        return await self.backend.get_user_profile_details_batch(usernames)

    async def save_user_profile_detail(self, profile: UserProfileDetail) -> None:
        await self.backend.save_user_profile_detail(profile)

    async def get_user_films(self, username: str, category: str, page: int = 1) -> Optional[List[UserFilmItem]]:
        return await self.backend.get_user_films(username, category, page)

    async def save_user_films(self, username: str, category: str, page: int, films: List[UserFilmItem]) -> None:
        await self.backend.save_user_films(username, category, page, films)

    async def get_query_result(self, query_key: str) -> Optional[Dict[str, Any]]:
        if self._redis is not None:
            try:
                raw = await self._redis.get(query_key)
                if raw:
                    debug_tracker.record_cache_hit()
                    return json.loads(raw)
            except Exception:
                logger.warning("Redis query cache read failed; using database cache")
        return await self.backend.get_query_result(query_key)

    async def save_query_result(self, query_key: str, data: Dict[str, Any]) -> None:
        if self._redis is not None:
            try:
                await self._redis.setex(
                    query_key,
                    max(1, int(getattr(self.backend, "query_ttl", DEFAULT_QUERY_TTL))),
                    json.dumps(data, ensure_ascii=False),
                )
            except Exception:
                logger.warning("Redis query cache write failed; database cache remains active")
        await self.backend.save_query_result(query_key, data)

    async def clear_cache(self) -> None:
        if self._redis is not None:
            keys = []
            async for key in self._redis.scan_iter(match="search:*"):
                keys.append(key)
                if len(keys) >= 250:
                    await self._redis.delete(*keys)
                    keys.clear()
            async for key in self._redis.scan_iter(match="film-search:*"):
                keys.append(key)
                if len(keys) >= 250:
                    await self._redis.delete(*keys)
                    keys.clear()
            if keys:
                await self._redis.delete(*keys)
        await self.backend.clear_cache()

    async def save_waitlist_lead(self, email: str, feature: str = "") -> int:
        return await self.backend.save_waitlist_lead(email, feature)

    async def get_waitlist_leads(self, limit: int = 100) -> List[Dict[str, Any]]:
        return await self.backend.get_waitlist_leads(limit)
