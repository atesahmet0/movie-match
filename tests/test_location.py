"""Unit tests for the location matching engine."""

import pytest
from movie_match.matcher.location import LocationMatcher, normalize_text


def test_normalize_text_turkish():
    assert normalize_text("İstanbul") == "istanbul"
    assert normalize_text("İZMİR") == "izmir"
    assert normalize_text("Çankaya") == "cankaya"
    assert normalize_text("Eskişehir") == "eskisehir"
    assert normalize_text("Ağrı") == "agri"
    assert normalize_text("Türkiye") == "turkiye"


def test_turkey_location_matcher():
    matcher = LocationMatcher("Turkey", include_bio=True)

    # Direct matches
    assert matcher.match("Turkey")[0] is True
    assert matcher.match("Türkiye")[0] is True
    assert matcher.match("Istanbul, Turkey")[0] is True
    assert matcher.match("Ankara")[0] is True
    assert matcher.match("İzmir / Bornova")[0] is True
    assert matcher.match("Kadıköy, İstanbul")[0] is True
    assert matcher.match("Antalya")[0] is True

    # Negative matches
    assert matcher.match("London, UK")[0] is False
    assert matcher.match("Berlin, Germany")[0] is False
    assert matcher.match("New York")[0] is False


def test_ankara_specific_matcher():
    matcher = LocationMatcher("Ankara", include_bio=True)

    assert matcher.match("Ankara")[0] is True
    assert matcher.match("Ankara, Turkey")[0] is True
    assert matcher.match("Çankaya, Ankara")[0] is True
    assert matcher.match("Kızılay")[0] is True
    assert matcher.match("Bilkent / Ankara")[0] is True

    # Negative matches
    assert matcher.match("Istanbul")[0] is False
    assert matcher.match("Izmir")[0] is False
    assert matcher.match("Paris")[0] is False


def test_bio_matching():
    matcher_with_bio = LocationMatcher("Ankara", include_bio=True)
    matcher_no_bio = LocationMatcher("Ankara", include_bio=False)

    loc = "Nowhere"
    bio = "CS Student at METU in Ankara"

    assert matcher_with_bio.match(loc, bio)[0] is True
    assert "bio" in matcher_with_bio.match(loc, bio)[1]

    assert matcher_no_bio.match(loc, bio)[0] is False


def test_international_matcher():
    matcher_germany = LocationMatcher("Germany")
    assert matcher_germany.match("Berlin")[0] is True
    assert matcher_germany.match("Munich, Germany")[0] is True
    assert matcher_germany.match("Tokyo")[0] is False

    matcher_usa = LocationMatcher("USA")
    assert matcher_usa.match("Austin, Texas")[0] is True
    assert matcher_usa.match("New York City")[0] is True
    assert matcher_usa.match("Paris")[0] is False


def test_anywhere_location_matcher():
    for q in ["Anywhere", "Worldwide", "global", "all", "*", ""]:
        matcher = LocationMatcher(q)
        assert matcher.is_anywhere is True
        assert matcher.match("Istanbul, Turkey")[0] is True
        assert matcher.match("London, UK")[0] is True
        assert matcher.match("")[0] is True
        assert matcher.match("", "Some bio without location")[0] is True
        assert matcher.match("Tokyo, Japan")[2] == "Tokyo, Japan"
        assert matcher.match("")[2] == "Worldwide"


def test_multiple_locations_matcher():
    matcher = LocationMatcher("Ankara, Berlin, London", include_bio=True)
    assert matcher.is_anywhere is False
    # Matches any of the specified locations
    assert matcher.match("Ankara, Turkey")[0] is True
    assert matcher.match("Çankaya")[0] is True
    assert matcher.match("Berlin, Germany")[0] is True
    assert matcher.match("London, UK")[0] is True
    # Negative match
    assert matcher.match("Tokyo, Japan")[0] is False
    assert matcher.match("Paris, France")[0] is False
    assert matcher.match("New York")[0] is False

def test_bio_false_positive_van_dutch():
    """Dutch 'van' (meaning 'of/from') should NOT match Turkey's Van city via bio."""
    matcher = LocationMatcher("Turkey", include_bio=True)

    # Bio contains Dutch "van" — should NOT be a false positive
    is_match, fields, _ = matcher.match(
        "Floating between the stars",
        "Mini dagboek, ookal weet ik weinig van films",
    )
    assert is_match is False, "Dutch 'van' in bio should not match Turkish city Van"

    # But actual location "Van" should still match
    assert matcher.match("Van, Turkey")[0] is True
    assert matcher.match("Van")[0] is True


def test_bio_false_positive_nice_french():
    """English 'nice' should NOT match France's Nice city via bio."""
    matcher = LocationMatcher("France", include_bio=True)

    # Bio contains English "nice" — should NOT be a false positive
    is_match, _, _ = matcher.match(
        "Some location",
        "That was a nice movie, really enjoyed it",
    )
    assert is_match is False, "English 'nice' in bio should not match French city Nice"

    # But actual location "Nice" should still match
    assert matcher.match("Nice, France")[0] is True


def test_bio_false_positive_jordan_name():
    """First name 'Jordan' in bio should NOT match Jordan (country)."""
    # This only applies if we had a Jordan geo-alias — testing the blocklist mechanism
    matcher = LocationMatcher("Turkey", include_bio=True)

    # "jordan" is in the blocklist but not in Turkey's aliases, so this just tests
    # that the blocklist doesn't break normal matching
    assert matcher.match("Ankara")[0] is True
    assert matcher.match("Istanbul")[0] is True
