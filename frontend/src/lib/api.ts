import { captureException } from "./analytics";
import {
  FilmMetadata,
  FilmSearchResponse,
  FilmSearchResult,
  HistoryItemResponse,
  HistoryListResponse,
  SearchResponse,
  TasteMatchResponse,
  UserFilmsResponse,
  UserProfileResponse,
} from "./types";

const getBaseUrl = () => {
  if (typeof window === "undefined") {
    // Server-side
    return process.env.BACKEND_API_URL || "http://127.0.0.1:8000";
  }
  // Client-side: use relative URL which Next.js rewrites to backend
  return "";
};

export async function fetchUserProfile(username: string): Promise<UserProfileResponse | null> {
  const clean = username.trim().replace(/^@/, "");
  if (!clean) return null;

  try {
    const res = await fetch(`${getBaseUrl()}/api/user/${encodeURIComponent(clean)}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      const err = await res.json().catch(() => ({}));
      const errorMsg = err.detail || `Profile lookup failed (HTTP ${res.status})`;
      captureException(new Error(errorMsg), {
        endpoint: "/api/user",
        username: clean,
        status: res.status,
      });
      throw new Error(errorMsg);
    }

    return await res.json();
  } catch (error) {
    console.warn("fetchUserProfile error:", error);
    captureException(error, { endpoint: "/api/user", username: clean });
    throw error;
  }
}


export async function fetchUserFilms(
  username: string,
  category = "films",
  page = 1
): Promise<UserFilmsResponse | null> {
  const clean = username.trim().replace(/^@/, "");
  if (!clean) return null;

  try {
    const res = await fetch(
      `${getBaseUrl()}/api/user/${encodeURIComponent(clean)}/films?category=${category}&page=${page}`,
      { cache: "no-store" }
    );

    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("fetchUserFilms error:", error);
    return null;
  }
}

export async function fetchSingleSearch(params: {
  film: string;
  location?: string;
  sentiment?: string;
  rating?: string;
  max_pages?: number;
  limit?: number;
  include_bio?: boolean;
}): Promise<SearchResponse | null> {
  if (!params.film.trim()) return null;

  const url = new URL(
    "/api/search",
    typeof window === "undefined" ? getBaseUrl() : window.location.origin
  );
  url.searchParams.set("film", params.film.trim());
  url.searchParams.set("location", params.location?.trim() || "Anywhere");
  url.searchParams.set("sentiment", params.sentiment || "liked");
  if (params.rating) url.searchParams.set("rating", params.rating);
  url.searchParams.set("max_pages", String(params.max_pages || 2));
  url.searchParams.set("limit", String(params.limit || 10));
  url.searchParams.set("include_bio", String(params.include_bio ?? false));

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errorMsg = err.detail || `Search failed (HTTP ${res.status})`;
      captureException(new Error(errorMsg), {
        endpoint: "/api/search",
        film: params.film,
        status: res.status,
      });
      throw new Error(errorMsg);
    }
    return await res.json();
  } catch (error) {
    console.error("fetchSingleSearch error:", error);
    captureException(error, { endpoint: "/api/search", film: params.film });
    throw error;
  }
}

export async function fetchTasteMatch(params: {
  films: string[];
  location_query?: string;
  min_shared_films?: number;
  sentiment?: string;
  max_pages_per_film?: number;
  limit_matches?: number;
  include_bio?: boolean;
  source_username?: string;
}): Promise<TasteMatchResponse | null> {
  if (!params.films || params.films.length === 0) return null;

  const uniqueFilms = Array.from(
    new Set(params.films.map((f) => f.trim().toLowerCase().replace(/\/+$/, "").split("/").pop()).filter(Boolean) as string[])
  );
  if (uniqueFilms.length === 0) return null;

  try {
    const res = await fetch(`${getBaseUrl()}/api/taste-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        films: uniqueFilms,
        location_query: params.location_query?.trim() || "Anywhere",
        min_shared_films: params.min_shared_films || 1,
        sentiment: params.sentiment || "liked",
        max_pages_per_film: params.max_pages_per_film || 6,
        limit_matches: params.limit_matches || 10,
        include_bio: params.include_bio ?? false,
        source_username: params.source_username || undefined,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(200_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errorMsg = err.detail || `Taste match failed (HTTP ${res.status})`;
      captureException(new Error(errorMsg), {
        endpoint: "/api/taste-match",
        film_count: uniqueFilms.length,
        status: res.status,
      });
      throw new Error(errorMsg);
    }

    return await res.json();
  } catch (error) {
    console.error("fetchTasteMatch error:", error);
    captureException(error, {
      endpoint: "/api/taste-match",
      film_count: uniqueFilms.length,
      location: params.location_query,
    });
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.message.toLowerCase().includes("timeout"));
    throw new Error(
      isTimeout
        ? "This search took too long. Try a narrower location or different film titles."
        : "The search service is temporarily unavailable. Please try again."
    );
  }
}

export async function fetchHistory(limit = 50): Promise<HistoryListResponse | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/history?limit=${limit}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `History lookup failed (HTTP ${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error("fetchHistory error:", error);
    return null;
  }
}

export async function fetchHistoryItem(id: number | string): Promise<HistoryItemResponse | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/history/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `History item lookup failed (HTTP ${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error("fetchHistoryItem error:", error);
    return null;
  }
}

export async function fetchFilmInfo(film: string): Promise<FilmMetadata | null> {
  if (!film.trim()) return null;
  try {
    const res = await fetch(`${getBaseUrl()}/api/film-info?film=${encodeURIComponent(film.trim())}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Film lookup failed (HTTP ${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error("fetchFilmInfo error:", error);
    throw error;
  }
}

export async function clearHistory(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/history`, {
      method: "DELETE",
    });
    return res.ok;
  } catch (error) {
    console.error("clearHistory error:", error);
    return false;
  }
}

export async function searchFilms(
  query: string,
  limit = 10,
  signal?: AbortSignal
): Promise<FilmSearchResult[]> {
  const clean = query.trim();
  if (!clean) return [];

  try {
    const res = await fetch(
      `${getBaseUrl()}/api/films/search?q=${encodeURIComponent(clean)}&limit=${limit}`,
      { signal }
    );
    if (!res.ok) return [];
    const data: FilmSearchResponse = await res.json();
    return data.results || [];
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    console.error("searchFilms error:", error);
    return [];
  }
}

export async function submitWaitlistEmail(
  email: string,
  feature = "extended_tier"
): Promise<{ success: boolean; message: string }> {
  const clean = email.trim();
  if (!clean) return { success: false, message: "Email is required." };

  try {
    const res = await fetch(`${getBaseUrl()}/api/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: clean, feature }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        message: data.detail || "Failed to submit email. Please try again.",
      };
    }

    return {
      success: true,
      message: data.message || "You're on the early access waitlist!",
    };
  } catch (error) {
    console.error("submitWaitlistEmail error:", error);
    return {
      success: false,
      message: "Network error submitting email. Please try again.",
    };
  }
}

export async function subscribeNewsletter(
  email: string,
  options: { feature?: string; source?: string } = {}
): Promise<{ success: boolean; message: string }> {
  const clean = email.trim();
  if (!clean) return { success: false, message: "Email is required." };
  if (!clean.includes("@") || !clean.includes(".")) {
    return { success: false, message: "Please enter a valid email address." };
  }

  const { feature = "newsletter", source = "web" } = options;

  try {
    const res = await fetch(`${getBaseUrl()}/api/newsletter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: clean, feature, source }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        message: data.detail || "Failed to subscribe. Please try again.",
      };
    }

    return {
      success: true,
      message: data.message || "Thank you! You're subscribed to MovieMatch updates.",
    };
  } catch (error) {
    console.error("subscribeNewsletter error:", error);
    return {
      success: false,
      message: "Network error submitting email. Please try again.",
    };
  }
}

