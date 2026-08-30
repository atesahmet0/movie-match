"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchFilmInfo,
  fetchUserProfile,
  fetchUserFilms,
  fetchHistory,
  fetchHistoryItem,
  clearHistory,
  searchFilms,
} from "@/lib/api";
import { FilmMetadata, FilmSearchResult, UserProfileResponse, UserFilmsResponse, HistoryListResponse, HistoryItemResponse } from "@/lib/types";

export const queryKeys = {
  filmInfo: (slug: string) => ["filmInfo", slug.toLowerCase()] as const,
  filmSearch: (query: string, limit: number) => ["filmSearch", query.toLowerCase(), limit] as const,
  userProfile: (username: string) => ["userProfile", username.toLowerCase()] as const,
  userFilms: (username: string, category: string, page: number) =>
    ["userFilms", username.toLowerCase(), category, page] as const,
  historyList: (limit: number) => ["searchHistory", limit] as const,
  historyItem: (id: string | number) => ["searchHistoryItem", String(id)] as const,
};

/**
 * Fetch and cache film metadata by slug with automatic deduplication.
 */
export function useFilmInfo(slug: string) {
  const cleanSlug = (slug || "").trim().toLowerCase();
  return useQuery<FilmMetadata | null>({
    queryKey: queryKeys.filmInfo(cleanSlug),
    queryFn: () => fetchFilmInfo(cleanSlug),
    enabled: Boolean(cleanSlug),
    staleTime: 10 * 60 * 1000, // 10 minutes cache
  });
}

/**
 * Fetch and cache film search suggestions with query deduplication.
 */
export function useFilmSearch(query: string, limit = 8) {
  const cleanQuery = (query || "").trim().toLowerCase();
  return useQuery<FilmSearchResult[]>({
    queryKey: queryKeys.filmSearch(cleanQuery, limit),
    queryFn: ({ signal }) => searchFilms(cleanQuery, limit, signal),
    enabled: cleanQuery.length >= 2,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
}

/**
 * Fetch and cache full Letterboxd user profile.
 */
export function useUserProfile(username: string) {
  const cleanUser = (username || "").trim().toLowerCase().replace(/^@/, "");
  return useQuery<UserProfileResponse | null>({
    queryKey: queryKeys.userProfile(cleanUser),
    queryFn: () => fetchUserProfile(cleanUser),
    enabled: Boolean(cleanUser),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch and cache paginated user films.
 */
export function useUserFilms(username: string, category = "films", page = 1) {
  const cleanUser = (username || "").trim().toLowerCase().replace(/^@/, "");
  return useQuery<UserFilmsResponse | null>({
    queryKey: queryKeys.userFilms(cleanUser, category, page),
    queryFn: () => fetchUserFilms(cleanUser, category, page),
    enabled: Boolean(cleanUser),
    staleTime: 3 * 60 * 1000,
  });
}

/**
 * Fetch search history.
 */
export function useSearchHistory(limit = 50) {
  return useQuery<HistoryListResponse | null>({
    queryKey: queryKeys.historyList(limit),
    queryFn: () => fetchHistory(limit),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Fetch single search history item.
 */
export function useSearchHistoryItem(id: string | number) {
  return useQuery<HistoryItemResponse | null>({
    queryKey: queryKeys.historyItem(id),
    queryFn: () => fetchHistoryItem(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Clear search history mutation with query cache invalidation.
 */
export function useClearHistoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["searchHistory"] });
    },
  });
}
