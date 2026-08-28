"""Unit tests for HTML parsers and slug extraction."""

import pytest
from movie_match.matcher.sentiment import parse_star_rating_from_class, rating_to_stars_text
from movie_match.scraper.parser import (
    extract_slug_from_input,
    parse_film_page,
    parse_user_profile_page,
    parse_users_from_rating_or_like_page,
    parse_users_from_reviews_page,
)


def test_extract_slug():
    assert extract_slug_from_input("https://letterboxd.com/film/vampire-hunter-d-bloodlust/") == "vampire-hunter-d-bloodlust"
    assert extract_slug_from_input("https://letterboxd.com/film/fight-club/reviews/") == "fight-club"
    assert extract_slug_from_input("vampire-hunter-d-bloodlust") == "vampire-hunter-d-bloodlust"
    assert extract_slug_from_input("/film/interstellar/") == "interstellar"


def test_star_rating_parsing():
    assert parse_star_rating_from_class(["rating", "rated-10"]) == 5.0
    assert parse_star_rating_from_class(["rating", "rated-9"]) == 4.5
    assert parse_star_rating_from_class(["rating", "rated-8"]) == 4.0
    assert parse_star_rating_from_class(["rating", "rated-1"]) == 0.5

    assert rating_to_stars_text(5.0) == "★★★★★"
    assert rating_to_stars_text(4.5) == "★★★★½"
    assert rating_to_stars_text(0.5) == "½"


def test_parse_film_page():
    mock_html = """
    <html>
      <head>
        <meta property="og:title" content="Vampire Hunter D: Bloodlust (2000)" />
        <meta name="twitter:data1" content="Yoshiaki Kawajiri" />
        <meta name="twitter:data2" content="4.0 out of 5" />
        <meta property="og:image" content="https://img.ltrbxd.com/poster.jpg" />
      </head>
      <body>
        <h1 class="headline-1 film-title">Vampire Hunter D: Bloodlust</h1>
        <div class="releaseyear"><a>2000</a></div>
        <div class="creatorlist"><a href="/director/yoshiaki-kawajiri/">Yoshiaki Kawajiri</a></div>
      </body>
    </html>
    """
    film = parse_film_page(mock_html, "vampire-hunter-d-bloodlust")
    assert film.slug == "vampire-hunter-d-bloodlust"
    assert film.title == "Vampire Hunter D: Bloodlust"
    assert film.year == 2000
    assert film.director == "Yoshiaki Kawajiri"
    assert film.rating == 4.0


def test_parse_users_from_rating_page():
    mock_html = """
    <div>
      <ul class="avatar-list">
        <li>
          <a class="watchedstate-avatar" href="/cinephile1/film/vampire-hunter-d-bloodlust/activity/" title="Rated by cinephile1">
            <span class="rating rated-10">★★★★★</span>
          </a>
        </li>
        <li>
          <a class="watchedstate-avatar" href="/cinephile2/film/vampire-hunter-d-bloodlust/activity/" title="Rated by cinephile2">
            <span class="rating rated-8">★★★★</span>
          </a>
        </li>
      </ul>
    </div>
    """
    users = parse_users_from_rating_or_like_page(mock_html)
    assert len(users) == 2
    assert users[0]["username"] == "cinephile1"
    assert users[0]["user_rating"] == 5.0
    assert users[1]["username"] == "cinephile2"
    assert users[1]["user_rating"] == 4.0


def test_parse_user_profile():
    mock_html = """
    <div class="profile-header">
      <div class="profile-summary">
        <div class="profile-avatar">
          <img src="https://img.ltrbxd.com/avatar.jpg" />
        </div>
        <h1 class="person-display-name">
          <span class="label">Ahmet Yilmaz</span>
          <span class="badge -pro">Pro</span>
        </h1>
        <div class="profile-metadata">
          <div class="metadatum -has-label">
            <span class="label">Ankara, Turkey</span>
          </div>
        </div>
      </div>
      <section class="profile-bio">
        <p>Filmmaker & Anime Enthusiast</p>
      </section>
    </div>
    """
    profile = parse_user_profile_page(mock_html, "ahmetyilmaz")
    assert profile.username == "ahmetyilmaz"
    assert profile.display_name == "Ahmet Yilmaz"
    assert profile.location == "Ankara, Turkey"
    assert profile.bio == "Filmmaker & Anime Enthusiast"
    assert profile.is_pro is True


def test_parse_user_profile_detail():
    mock_html = """
    <div class="profile-header">
      <div class="profile-summary">
        <h1 class="person-display-name"><span class="label">Cinephile Dev</span></h1>
        <div class="profile-metadata"><div class="metadatum"><span class="label">Berlin, Germany</span></div></div>
      </div>
      <section class="profile-stats">
        <div class="profile-statistic"><span class="value">350</span><span class="definition">Films</span></div>
        <div class="profile-statistic"><span class="value">42</span><span class="definition">This year</span></div>
      </section>
      <section id="favourites">
        <div class="react-component" data-component-class="LazyPoster" data-item-name="Alien (1979)" data-item-slug="alien" data-target-link="/cinephile/film/alien/">
          <div class="poster film-poster"><img src="https://img.ltrbxd.com/alien.jpg" alt="Alien" /></div>
        </div>
        <div class="react-component" data-component-class="LazyPoster" data-item-name="Interstellar (2014)" data-item-slug="interstellar">
          <div class="poster film-poster"><img src="https://img.ltrbxd.com/interstellar.jpg" alt="Interstellar" /></div>
        </div>
      </section>
    </div>
    """
    from movie_match.scraper.parser import parse_user_profile_detail
    prof_detail = parse_user_profile_detail(mock_html, "cinephile")
    assert prof_detail.username == "cinephile"
    assert prof_detail.display_name == "Cinephile Dev"
    assert prof_detail.location == "Berlin, Germany"
    assert prof_detail.stats.get("films") == "350"
    assert len(prof_detail.favorite_films) == 2
    assert prof_detail.favorite_films[0].slug == "alien"
    assert prof_detail.favorite_films[0].title == "Alien"
    assert prof_detail.favorite_films[0].year == 1979
    assert prof_detail.favorite_films[1].slug == "interstellar"


def test_parse_user_films_page():
    mock_html = """
    <ul class="poster-list">
      <li class="poster-container">
        <div class="react-component" data-component-class="LazyPoster" data-item-name="The Odyssey (2026)" data-item-slug="the-odyssey-2026">
          <div class="poster film-poster"><img src="https://img.ltrbxd.com/odyssey.jpg" alt="The Odyssey" /></div>
        </div>
        <p class="poster-viewingdata">
          <span class="rating rated-8">★★★★</span>
          <span class="like has-liked">Liked</span>
        </p>
      </li>
      <li class="poster-container">
        <div class="react-component" data-component-class="LazyPoster" data-item-name="Arrival (2016)" data-item-slug="arrival">
          <div class="poster film-poster"><img src="https://img.ltrbxd.com/arrival.jpg" alt="Arrival" /></div>
        </div>
        <p class="poster-viewingdata">
          <span class="rating rated-10">★★★★★</span>
        </p>
      </li>
    </ul>
    """
    from movie_match.scraper.parser import parse_user_films_page
    films = parse_user_films_page(mock_html)
    assert len(films) == 2
    assert films[0].slug == "the-odyssey-2026"
    assert films[0].title == "The Odyssey"
    assert films[0].year == 2026
    assert films[0].user_rating == 4.0
    assert films[0].user_liked is True

    assert films[1].slug == "arrival"
    assert films[1].user_rating == 5.0
    assert films[1].user_liked is False

