"""High-performance location matching engine with international and Turkish geo-hierarchies."""

import re
import unicodedata
from typing import Dict, List, Optional, Set, Tuple


def normalize_text(text: str) -> str:
    """Normalize text by lowercasing, folding Turkish characters, and removing diacritics."""
    if not text:
        return ""
    text = text.lower()
    # Handle Turkish specific character mappings
    tr_map = str.maketrans({
        "ı": "i", "İ": "i", "I": "i",
        "ş": "s", "Ş": "s",
        "ğ": "g", "Ğ": "g",
        "ü": "u", "Ü": "u",
        "ö": "o", "Ö": "o",
        "ç": "c", "Ç": "c",
    })
    text = text.translate(tr_map)
    # Decompose unicode characters and strip combining accents
    nfkd = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in nfkd if not unicodedata.combining(c))
    return stripped


# Comprehensive geographic aliases and hierarchical city/district mapping
GEO_ALIASES: Dict[str, Set[str]] = {
    # Turkey & Turkish Cities / Districts
    "turkey": {
        "turkey", "turkiye", "türkiye", "turkei", "turquia", "turchia", "tr",
        "adana", "adiyaman", "afyonkarahisar", "afyon", "agri", "amasya", "ankara",
        "antalya", "artvin", "aydin", "balikesir", "bilecik", "bingol", "bitlis",
        "bolu", "burdur", "bursa", "canakkale", "cankiri", "corum", "denizli",
        "diyarbakir", "edirne", "elazig", "erzincan", "erzurum", "eskisehir",
        "gaziantep", "antep", "giresun", "gumushane", "hakkari", "hatay", "antakya",
        "isparta", "mersin", "icel", "istanbul", "izmir", "kars", "kastamonu",
        "kayseri", "kirklareli", "kirsehir", "kocaeli", "izmit", "konya", "kutahya",
        "malatya", "manisa", "kahramanmaras", "maras", "mardin", "mugla", "mus",
        "nevsehir", "nigde", "ordu", "rize", "sakarya", "adapazari", "samsun",
        "siirt", "sinop", "sivas", "tekirdag", "tokat", "trabzon", "tunceli",
        "sanliurfa", "urfa", "usak", "van", "yozgat", "zonguldak", "aksaray",
        "bayburt", "karaman", "kirikkale", "batman", "sirnak", "bartin", "ardahan",
        "igdir", "yalova", "karabuk", "kilis", "osmaniye", "duzce",
        # Popular regions/districts/hubs
        "bodrum", "fethiye", "marmaris", "alanya", "cesme", "didim", "kusadasi",
        "cankaya", "kizilay", "kadikoy", "besiktas", "sisli", "beyoglu", "uskudar",
        "alsancak", "karsiyaka", "bornova"
    },
    "ankara": {
        "ankara", "angara", "06", "cankaya", "çankaya", "kizilay", "kızılay",
        "bilkent", "odtu", "odtü", "metu", "hacettepe", "yenimahalle", "etimesgut",
        "kecioren", "keçiören", "bahcelievler", "bahçelievler", "tunali", "tunalı",
        "gazi", "golbasi", "gölbaşı", "batikent", "batıkent", "mamak", "sincan",
        "eryaman", "ayranci", "ayrancı", "kavaklidere", "kavaklıdere", "gaziosmanpasa"
    },
    "istanbul": {
        "istanbul", "constantinople", "34", "kadikoy", "kadıköy", "besiktas",
        "beşiktaş", "sisli", "şişli", "beyoglu", "beyoğlu", "uskudar", "üsküdar",
        "bakirkoy", "bakırköy", "maltepe", "atasehir", "ataşehir", "bogazici",
        "boğaziçi", "boun", "itu", "itü", "taksim", "galata", "karakoy", "karaköy",
        "moda", "cihangir", "nisantasi", "nişantaşı", "levent", "maslak", "sariyer",
        "üsküdar", "fatih", "kartal", "pendik", "beykoz"
    },
    "izmir": {
        "izmir", "smyrna", "35", "alsancak", "karsiyaka", "karşıyaka", "bornova",
        "goztepe", "göztepe", "konak", "buca", "cesme", "çeşme", "alacati",
        "alaçatı", "urla", "foca", "foça", "bostanli", "bostanlı"
    },

    # United States
    "usa": {
        "usa", "united states", "us", "america", "new york", "nyc", "brooklyn",
        "los angeles", "la", "california", "chicago", "texas", "austin", "houston",
        "dallas", "san francisco", "sf", "seattle", "washington", "boston", "miami",
        "florida", "atlanta", "denver", "colorado", "philadelphia", "san diego",
        "portland", "oregon"
    },
    "uk": {
        "uk", "united kingdom", "great britain", "britain", "england", "scotland",
        "wales", "northern ireland", "london", "manchester", "birmingham",
        "edinburgh", "glasgow", "liverpool", "bristol", "leeds", "oxford", "cambridge"
    },
    "germany": {
        "germany", "deutschland", "de", "berlin", "munich", "munchen", "münchen",
        "hamburg", "frankfurt", "cologne", "koln", "köln", "stuttgart",
        "dusseldorf", "düsseldorf", "leipzig", "dortmund", "dresden", "bonn"
    },
    "france": {
        "france", "fr", "paris", "marseille", "lyon", "toulouse", "nice", "nantes",
        "strasbourg", "montpellier", "bordeaux", "lille", "rennes"
    },
    "japan": {
        "japan", "nippon", "nihon", "tokyo", "kyoto", "osaka", "yokohama",
        "nagoya", "sapporo", "kobe", "fukuoka", "shibuya", "shinjuku"
    },
    "canada": {
        "canada", "ca", "toronto", "montreal", "vancouver", "calgary", "edmonton",
        "ottawa", "quebec", "ontario", "british columbia"
    },
    "australia": {
        "australia", "au", "sydney", "melbourne", "brisbane", "perth", "adelaide"
    },
    "italy": {
        "italy", "italia", "it", "rome", "roma", "milan", "milano", "naples",
        "napoli", "turin", "torino", "florence", "firenze", "venice", "venezia",
        "bologna", "palermo"
    },
    "spain": {
        "spain", "espana", "españa", "es", "madrid", "barcelona", "valencia",
        "seville", "sevilla", "zaragoza", "malaga", "málaga", "bilbao"
    },
}


SHORT_ABBREVIATIONS: Set[str] = {
    "tr", "us", "la", "de", "fr", "ca", "it", "es", "au", "06", "34", "35"
}


class LocationMatcher:
    """Matches user profile locations and bios against target queries with intelligent geo-aliasing."""

    def __init__(self, query: str, include_bio: bool = True):
        self.raw_query = query.strip()
        self.include_bio = include_bio
        self.normalized_query = normalize_text(self.raw_query)
        self.location_tokens: Set[str] = self._build_target_tokens()
        # For bio matching, exclude short 2-letter abbreviations that collide with common words
        self.bio_tokens: Set[str] = {t for t in self.location_tokens if len(t) > 2 and t not in SHORT_ABBREVIATIONS}

        self.loc_pattern = self._compile_pattern(self.location_tokens)
        self.bio_pattern = self._compile_pattern(self.bio_tokens) if self.bio_tokens else None

    def _build_target_tokens(self) -> Set[str]:
        tokens: Set[str] = {self.normalized_query}
        # Check if query matches known geo key (e.g. turkey, ankara, istanbul, usa, etc.)
        for key, aliases in GEO_ALIASES.items():
            norm_key = normalize_text(key)
            if self.normalized_query == norm_key or self.normalized_query in {normalize_text(a) for a in aliases}:
                # If searching for country, include all its cities/aliases
                if self.normalized_query == norm_key:
                    tokens.update(normalize_text(a) for a in aliases)
                else:
                    # If searching for specific city/district, add its exact aliases
                    tokens.add(self.normalized_query)
                    if self.normalized_query in GEO_ALIASES:
                        tokens.update(normalize_text(a) for a in GEO_ALIASES[self.normalized_query])
        return {t for t in tokens if t}

    def _compile_pattern(self, tokens: Set[str]) -> Optional[re.Pattern]:
        if not tokens:
            return None
        sorted_tokens = sorted(tokens, key=len, reverse=True)
        escaped_tokens = [re.escape(t) for t in sorted_tokens]
        pattern_str = r"(?:^|[^\w])(" + "|".join(escaped_tokens) + r")(?:[^\w]|$)"
        return re.compile(pattern_str, re.IGNORECASE)

    def match(self, location: str, bio: str = "") -> Tuple[bool, List[str], str]:
        """
        Check if user's location or bio matches the target.
        Returns: (is_match, matched_fields, matched_text)
        """
        norm_loc = normalize_text(location)
        matched_fields = []
        matched_text = ""

        # 1. Primary check: Location field
        if norm_loc and self.loc_pattern:
            m = self.loc_pattern.search(norm_loc)
            if m:
                matched_fields.append("location")
                matched_text = location.strip()
                return True, matched_fields, matched_text

        # 2. Secondary check: Bio text (if enabled)
        if self.include_bio and bio and self.bio_pattern:
            norm_bio = normalize_text(bio)
            m = self.bio_pattern.search(norm_bio)
            if m:
                matched_fields.append("bio")
                matched_text = f"Bio: {m.group(1)}"
                return True, matched_fields, matched_text

        return False, [], ""
