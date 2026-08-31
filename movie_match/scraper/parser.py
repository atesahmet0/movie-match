"""Fast HTML parsers for Letterboxd pages using selectolax (Lexbor engine)."""

import re
from typing import Dict, List, Optional, Tuple
from selectolax.parser import HTMLParser
from movie_match.matcher.sentiment import parse_star_rating_from_class, rating_to_stars_text
from movie_match.models import FilmMetadata, UserFilmItem, UserProfile, UserProfileDetail


def extract_slug_from_input(user_input: str) -> str:
    """Extract clean film slug from full URL or plain text slug."""
    clean = user_input.strip()
    # Handle full URL e.g. https://letterboxd.com/film/vampire-hunter-d-bloodlust/
    m = re.search(r"letterboxd\.com/film/([^/?#]+)", clean)
    if m:
        return m.group(1).lower()
    # Handle slug with trailing/leading slashes
    clean = clean.strip("/")
    if "/" in clean:
        clean = clean.split("/")[-1]
    return clean.lower()


def parse_film_stats(html: str) -> Optional[int]:
    """Extract a film's watcher count from its stats fragment.

    Letterboxd serves the counts from `/csi/film/<slug>/stats/` rather than the
    film page, which is why reading them off the film page always came back
    empty. The number appears twice in that fragment — once as the tooltip's
    `title` and once as the surrounding `aria-label` — so match the text
    directly instead of depending on either element surviving a redesign.
    """
    if not html:
        return None
    m = re.search(r"Watched by\s*([\d,]+)(?:&nbsp;|&#160;|\s| )*members", html, re.I)
    if not m:
        return None
    try:
        return int(m.group(1).replace(",", ""))
    except ValueError:
        return None


def parse_film_page(html: str, slug: str) -> FilmMetadata:
    """Extract film title, year, director, rating, and poster from film page."""
    tree = HTMLParser(html)

    # Title
    title = ""
    title_el = tree.css_first("h1.headline-1.film-title, h1.headline-1, .film-title-wrapper h1")
    if title_el:
        title = title_el.text(strip=True)
    else:
        og_title = tree.css_first('meta[property="og:title"]')
        if og_title:
            title = og_title.attributes.get("content", "").split("(")[0].strip()

    # Year
    year = None
    year_el = tree.css_first(".releaseyear a, .number a, .releaseyear")
    if year_el and year_el.text(strip=True).isdigit():
        year = int(year_el.text(strip=True))

    # Director
    director = None
    dir_el = tree.css_first(".creatorlist a, p.credits a[href*='/director/']")
    if dir_el:
        director = dir_el.text(strip=True)

    # Average Rating
    rating = None
    meta_rat = tree.css_first('meta[name="twitter:data2"]')
    if meta_rat:
        rat_text = meta_rat.attributes.get("content", "").split()[0]
        try:
            rating = float(rat_text)
        except ValueError:
            pass

    # Member count is used as an optional rarity signal. Prefer a dedicated
    # statistic, then fall back to common metadata/summary text.
    member_count = None
    member_el = tree.css_first(".film-stats .members, .film-stats .count, .film-detail .members")
    member_text = member_el.text(strip=True) if member_el else ""
    if not member_text:
        desc_el = tree.css_first('meta[name="description"], meta[property="og:description"]')
        member_text = desc_el.attributes.get("content", "") if desc_el else ""
    members_match = re.search(r"([\d,.]+)\s*([kKmM])?\s*members", member_text)
    if members_match:
        try:
            member_count = int(float(members_match.group(1).replace(",", "")) * ({"k": 1000, "m": 1_000_000}.get((members_match.group(2) or "").lower(), 1)))
        except ValueError:
            member_count = None

    # 1st Priority: Clean 2:3 Vertical Theatrical Poster Element
    poster_url = None
    for sel in [
        ".film-poster img",
        ".poster img",
        "section.poster img",
        "[data-component-class='LazyPoster'] img",
        ".image img",
        "img.really-lazy-load",
        "#poster img",
    ]:
        for el in tree.css(sel):
            src = el.attributes.get("src") or el.attributes.get("data-src") or el.attributes.get("data-original")
            if src and "empty-poster" not in src:
                if src.startswith("//"):
                    src = f"https:{src}"
                if src.startswith("http"):
                    poster_url = src
                    break
        if poster_url:
            break

    # 2nd Priority: JSON-LD Structured Data Image
    if not poster_url:
        for script in tree.css('script[type="application/ld+json"]'):
            try:
                import json
                script_text = script.text()
                if script_text:
                    ld = json.loads(script_text)
                    if isinstance(ld, dict) and ld.get("image"):
                        img_cand = ld["image"]
                        if isinstance(img_cand, str) and "empty-poster" not in img_cand and img_cand.startswith("http"):
                            poster_url = img_cand
                            break
            except Exception:
                pass

    # 3rd Priority: OpenGraph / Twitter Social Share Backdrop Fallback
    if not poster_url:
        og_img = tree.css_first("meta[property='og:image'], meta[name='twitter:image']")
        if og_img and og_img.attributes.get("content"):
            content_url = og_img.attributes.get("content")
            if "empty-poster" not in content_url:
                if content_url.startswith("//"):
                    content_url = f"https:{content_url}"
                if content_url.startswith("http"):
                    poster_url = content_url

    return FilmMetadata(
        slug=slug,
        title=title or slug.replace("-", " ").title(),
        year=year,
        director=director,
        rating=rating,
        poster_url=poster_url,
        member_count=member_count,
        url=f"https://letterboxd.com/film/{slug}/",
    )


def parse_users_from_rating_or_like_page(html: str) -> List[Dict]:
    """
    Parse usernames and their interaction data from ratings/likes/fans/members pages.
    Returns list of dicts with username, rating, liked, title.
    """
    tree = HTMLParser(html)
    results = []
    seen = set()

    for a in tree.css("a.watchedstate-avatar, a.avatar, .avatar-list a, .poster-list li a"):
        href = a.attributes.get("href", "")
        m = re.match(r"^/([^/]+)/", href)
        if not m:
            continue
        username = m.group(1).lower()
        if username in ["film", "films", "tag", "members", "reviews", "lists", "stats", "search", "actor", "director"]:
            continue
        if username in seen:
            continue
        seen.add(username)

        # Rating extraction from class or title
        title_attr = a.attributes.get("title", "")
        rating = None
        rating_span = a.css_first("span.rating, span.rated")
        if rating_span:
            rating = parse_star_rating_from_class(rating_span.attributes.get("class", "").split())

        results.append({
            "username": username,
            "user_rating": rating,
            "user_rating_stars": rating_to_stars_text(rating),
            "interaction_title": title_attr,
        })

    return results


def parse_users_from_reviews_page(html: str) -> List[Dict]:
    """
    Parse usernames, ratings, and reviews from reviews page.
    """
    tree = HTMLParser(html)
    results = []
    seen = set()

    for item in tree.css("article.production-viewing, div.listitem, div.js-review"):
        u_link = item.css_first("a.avatar, a.name, [data-person]")
        if not u_link:
            continue
        href = u_link.attributes.get("href", "")
        m = re.match(r"^/([^/]+)/", href)
        if not m:
            continue
        username = m.group(1).lower()
        if username in seen or username in ["film", "films", "tag", "members", "reviews"]:
            continue
        seen.add(username)

        # Rating
        rating = None
        rating_svg = item.css_first("svg.glyph.-rating, svg[aria-label*='★']")
        if rating_svg:
            label = rating_svg.attributes.get("aria-label", "")
            # Count stars
            full_stars = label.count("★")
            half_star = 0.5 if "½" in label else 0.0
            rating = float(full_stars) + half_star

        # Liked indicator
        liked = False
        if item.css_first("svg.inline-liked, .inline-liked, span.like, svg[aria-label='Liked']"):
            liked = True

        # Review snippet
        review_text = ""
        body_el = item.css_first(".body-text p, .body-text, .js-review-body")
        if body_el:
            review_text = body_el.text(strip=True)

        results.append({
            "username": username,
            "user_rating": rating,
            "user_rating_stars": rating_to_stars_text(rating),
            "user_liked": liked,
            "user_review": review_text[:300] if review_text else None,
        })

    return results


def extract_favorite_films_from_tree(tree: HTMLParser) -> List[UserFilmItem]:
    """Extract up to 4 pinned favorite films from user profile HTML."""
    favorite_films: List[UserFilmItem] = []
    seen_favs = set()
    for item in tree.css(
        "#favourites [data-component-class='LazyPoster'], "
        "section#favourites [data-component-class='LazyPoster'], "
        "#favourites .film-poster, "
        ".favourites .film-poster, "
        "#favourites li, "
        "section#favourites li"
    ):
        slug = item.attributes.get("data-item-slug") or item.attributes.get("data-film-slug")
        if not slug:
            target = item.attributes.get("data-target-link", "")
            m = re.search(r"/film/([^/?#]+)", target)
            if m:
                slug = m.group(1)
        if not slug:
            a_el = item.css_first("a[href*='/film/']")
            if a_el:
                m = re.search(r"/film/([^/?#]+)", a_el.attributes.get("href", ""))
                if m:
                    slug = m.group(1)
        if not slug:
            continue
        slug = slug.lower().strip()
        if slug in seen_favs:
            continue
        seen_favs.add(slug)

        name = item.attributes.get("data-item-name", "")
        img = item.css_first("img")
        if not name and img:
            name = img.attributes.get("alt", "")

        title = name
        year = None
        m = re.match(r"^(.*?)(?:\s*\((\d{4})\))?$", name)
        if m:
            title = m.group(1).strip() or name
            if m.group(2):
                year = int(m.group(2))

        poster_url = None
        if img:
            p_src = img.attributes.get("src") or img.attributes.get("data-src") or img.attributes.get("data-original") or ""
            if p_src and "empty-poster" not in p_src:
                if p_src.startswith("//"):
                    p_src = f"https:{p_src}"
                if p_src.startswith("http"):
                    poster_url = p_src

        favorite_films.append(UserFilmItem(
            slug=slug,
            title=title or slug.replace("-", " ").title(),
            year=year,
            poster_url=poster_url,
            user_liked=True,
            film_url=f"https://letterboxd.com/film/{slug}/",
        ))

    return favorite_films


def parse_user_profile_page(html: str, username: str) -> UserProfile:
    """Extract location, bio, display name, avatar, badges, and favorite films from user profile HTML."""
    tree = HTMLParser(html)

    # Display name
    name_el = tree.css_first("h1.person-display-name .label, .displayname .label, .profile-name h1, .title-1")
    display_name = name_el.text(strip=True) if name_el else username

    # Location
    location = ""
    for meta in tree.css(".profile-metadata .metadatum, .profile-metadata div, .person-summary .location, .has-icon .location"):
        if meta.css_first("a"):
            continue
        label_span = meta.css_first("span.label, span")
        text = label_span.text(strip=True) if label_span else meta.text(strip=True)
        if text and not text.startswith("@") and not "." in text:
            location = text
            break
        elif text:
            location = text

    # Bio
    bio = ""
    bio_el = tree.css_first(".profile-bio, section.profile-bio, .person-bio, .bio")
    if bio_el:
        bio = bio_el.text(strip=True)

    # Avatar
    avatar_url = ""
    avatar_el = tree.css_first(".profile-avatar img, .avatar.-large img, .avatar img")
    if avatar_el:
        avatar_url = avatar_el.attributes.get("src", "")

    # Badges
    is_pro = bool(tree.css_first(".badge.-pro"))
    is_patron = bool(tree.css_first(".badge.-patron"))

    # 4 Pinned Favorite Films
    favorite_films = extract_favorite_films_from_tree(tree)

    return UserProfile(
        username=username.lower(),
        display_name=display_name,
        location=location,
        bio=bio,
        avatar_url=avatar_url,
        profile_url=f"https://letterboxd.com/{username.lower()}/",
        is_pro=is_pro,
        is_patron=is_patron,
        favorite_films=favorite_films,
    )


def parse_user_profile_detail(html: str, username: str) -> UserProfileDetail:
    """Extract full user profile including 4 pinned favorite films and profile statistics."""
    base_profile = parse_user_profile_page(html, username)
    tree = HTMLParser(html)

    # Stats
    stats = {}
    for stat_el in tree.css(".profile-stats .profile-statistic, .stats-list .profile-statistic"):
        val_el = stat_el.css_first(".value")
        desc_el = stat_el.css_first(".definition")
        if val_el and desc_el:
            val_txt = val_el.text(strip=True).replace(",", "")
            desc_txt = desc_el.text(strip=True).lower().replace(" ", "_")
            stats[desc_txt] = val_txt

    return UserProfileDetail(
        username=base_profile.username,
        display_name=base_profile.display_name,
        location=base_profile.location,
        bio=base_profile.bio,
        avatar_url=base_profile.avatar_url,
        profile_url=base_profile.profile_url,
        is_pro=base_profile.is_pro,
        is_patron=base_profile.is_patron,
        favorite_films=base_profile.favorite_films,
        stats=stats,
    )


def parse_user_films_page(html: str) -> List[UserFilmItem]:
    """
    Parse films from a user's films/likes/ratings/watchlist page.
    Returns list of UserFilmItem with ratings and liked indicators.
    """
    tree = HTMLParser(html)
    films: List[UserFilmItem] = []
    seen = set()

    for item in tree.css("[data-component-class='LazyPoster'], div[data-item-slug], div[data-film-slug]"):
        slug = item.attributes.get("data-item-slug") or item.attributes.get("data-film-slug")
        if not slug:
            continue
        slug = slug.lower().strip()
        if slug in seen:
            continue
        seen.add(slug)

        name = item.attributes.get("data-item-name", "")
        img = item.css_first("img")
        if not name and img:
            name = img.attributes.get("alt", "")

        title = name
        year = None
        m = re.match(r"^(.*?)(?:\s*\((\d{4})\))?$", name)
        if m:
            title = m.group(1).strip() or name
            if m.group(2):
                year = int(m.group(2))

        poster_url = None
        if img:
            p_src = img.attributes.get("src") or img.attributes.get("data-src") or img.attributes.get("data-original") or ""
            if p_src and "empty-poster" not in p_src:
                if p_src.startswith("//"):
                    p_src = f"https:{p_src}"
                if p_src.startswith("http"):
                    poster_url = p_src

        # Find enclosing li for rating & liked
        parent = item.parent
        rating = None
        rating_stars = ""
        liked = False

        while parent and parent.tag != "li" and parent.tag != "body":
            parent = parent.parent

        if parent:
            r_el = parent.css_first("span.rating, span.rated, p.poster-viewingdata span.rating")
            if r_el:
                classes = r_el.attributes.get("class", "").split()
                rating = parse_star_rating_from_class(classes)
                if rating is None and r_el.text():
                    txt = r_el.text(strip=True)
                    full_stars = txt.count("★")
                    half_star = 0.5 if "½" in txt else 0.0
                    if full_stars or half_star:
                        rating = float(full_stars) + half_star
                rating_stars = rating_to_stars_text(rating)

            if parent.css_first("span.like, svg.inline-liked, .has-liked, span.icon-liked, svg[aria-label*='Liked']"):
                liked = True

        films.append(UserFilmItem(
            slug=slug,
            title=title or slug.replace("-", " ").title(),
            year=year,
            poster_url=poster_url,
            user_rating=rating,
            user_rating_stars=rating_stars,
            user_liked=liked,
            film_url=f"https://letterboxd.com/film/{slug}/",
        ))

    return films
