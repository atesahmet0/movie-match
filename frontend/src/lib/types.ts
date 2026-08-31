export type SentimentType = "liked" | "disliked" | "all" | "custom";

export interface UserProfile {
  username: string;
  display_name: string;
  location: string;
  bio: string;
  avatar_url: string;
  profile_url: string;
  is_pro: boolean;
  is_patron: boolean;
  fetched_at?: number | null;
}

export interface UserFilmItem {
  slug: string;
  title: string;
  year?: number | null;
  poster_url?: string | null;
  user_rating?: number | null;
  user_rating_stars: string;
  user_liked: boolean;
  film_url: string;
}

export interface UserProfileStats {
  films?: string | number;
  this_year?: string | number;
  followers?: string | number;
  following?: string | number;
  reviews?: string | number;
  lists?: string | number;
}

export interface UserProfileDetail extends UserProfile {
  stats: UserProfileStats;
  favorite_films: UserFilmItem[];
  recent_films: UserFilmItem[];
  top_rated_films?: UserFilmItem[];
  liked_films?: UserFilmItem[];
}

export interface FilmMetadata {
  title: string;
  slug: string;
  year?: number | null;
  director?: string | null;
  rating?: number | null;
  poster_url?: string | null;
  url: string;
  member_count?: number | null;
}

export interface FilmSearchResult {
  slug: string;
  title: string;
  year?: number | null;
  director?: string | null;
  film_url: string;
}

export interface FilmSearchResponse {
  status: "success" | "error";
  query: string;
  results: FilmSearchResult[];
}

export interface UserMatch {
  username: string;
  display_name: string;
  location: string;
  bio: string;
  avatar_url: string;
  profile_url: string;
  matched_location: string;
  matched_fields: string[];
  sentiment_type: SentimentType;
  user_rating?: number | null;
  user_rating_stars: string;
  user_liked?: boolean | null;
  user_review?: string | null;
  found_via: string;
}

export interface FilmInteraction {
  film_slug: string;
  film_title: string;
  user_rating?: number | null;
  user_rating_stars: string;
  user_liked?: boolean | null;
  user_review?: string | null;
  found_via: string;
  is_favorite: boolean;
  film_tier: string; // "favorite" | "top_rated" | "liked" | "recent" | "unknown"
}

export interface TasteMatchResult {
  username: string;
  display_name: string;
  location: string;
  bio: string;
  avatar_url: string;
  profile_url: string;
  matched_location: string;
  matched_fields: string[];
  shared_films: FilmInteraction[];
  shared_films_count: number;
  compatibility_score: number;
  intensity_score: number;
  affinity_score: number;
  correlation_score: number;
  /** Films rated by both members. Under 3, correlation_score is a neutral
   *  placeholder rather than a measurement — show the count, not the score. */
  correlation_pairs: number;
  confidence: number;
  ranking_score: number;
  total_target_films: number;
}

export interface ScanStats {
  film_title?: string;
  film_slug?: string;
  total_pages_scanned: number;
  total_users_discovered: number;
  profiles_fetched: number;
  cache_hits: number;
  matches_count: number;
  elapsed_seconds: number;
  time_to_first_result?: number | null;
  metadata_seconds?: number;
  cache_lookup_seconds?: number;
  parse_seconds?: number;
  upstream_requests?: number;
  cache_status?: "hit" | "miss" | string;
  partial?: boolean;
  stop_reason?:
    | "time_budget"
    | "request_budget"
    | "profile_budget"
    | "strong_match"
    | string
    | null;
}

export interface SearchResponse {
  status: "success" | "error";
  history_id?: number;
  film?: {
    title: string;
    slug: string;
  };
  stats: ScanStats;
  matches_count: number;
  matches: UserMatch[];
  detail?: string;
}

export interface TasteMatchResponse {
  status: "success" | "error";
  films: string[];
  stats: ScanStats;
  matches_count: number;
  matches: TasteMatchResult[];
  detail?: string;
}

export interface UserProfileResponse {
  status: "success" | "error";
  profile?: UserProfileDetail;
  detail?: string;
}

export interface UserFilmsResponse {
  status: "success" | "error";
  username: string;
  category: string;
  page: number;
  films_count: number;
  films: UserFilmItem[];
  detail?: string;
}

export interface SearchHistoryItem {
  id: number;
  film_slug: string;
  film_title: string;
  location_query: string;
  sentiment: string;
  rating_range?: string | null;
  matches_count: number;
  created_at: number;
  results_json?: string;
  results?: UserMatch[];
}

export interface HistoryListResponse {
  status: "success" | "error";
  history: SearchHistoryItem[];
}

export interface HistoryItemResponse {
  status: "success" | "error";
  item: SearchHistoryItem;
}

export interface SelectedFilmChip {
  slug: string;
  title: string;
  year?: number | null;
  poster_url?: string | null;
}
