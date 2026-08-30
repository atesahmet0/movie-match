"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { SelectedFilmChip } from "./types";

interface TasteContextType {
  selectedFilms: SelectedFilmChip[];
  addFilm: (film: SelectedFilmChip) => void;
  removeFilm: (slug: string) => void;
  toggleFilm: (film: SelectedFilmChip) => void;
  isFilmSelected: (slug: string) => boolean;
  clearFilms: () => void;
  activeUsername: string;
  setActiveUsername: (username: string) => void;
}

const TasteContext = createContext<TasteContextType | undefined>(undefined);

export function TasteProvider({ children }: { children: React.ReactNode }) {
  const [selectedFilms, setSelectedFilms] = useState<SelectedFilmChip[]>([]);
  const [activeUsername, setActiveUsernameState] = useState<string>("");

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("mm_username");
      if (savedUser) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveUsernameState(savedUser);
      }

      const savedFilms = localStorage.getItem("mm_selected_films");
      if (savedFilms) {
        setSelectedFilms(JSON.parse(savedFilms));
      }
    } catch (e) {
      console.warn("Could not read localStorage:", e);
    }
  }, []);

  const setActiveUsername = (username: string) => {
    setActiveUsernameState(username);
    if (username) {
      localStorage.setItem("mm_username", username);
    } else {
      localStorage.removeItem("mm_username");
    }
  };

  const addFilm = (film: SelectedFilmChip) => {
    setSelectedFilms((prev) => {
      if (prev.some((f) => f.slug === film.slug)) return prev;
      const updated = [...prev, film];
      localStorage.setItem("mm_selected_films", JSON.stringify(updated));
      return updated;
    });
  };

  const removeFilm = (slug: string) => {
    setSelectedFilms((prev) => {
      const updated = prev.filter((f) => f.slug !== slug);
      localStorage.setItem("mm_selected_films", JSON.stringify(updated));
      return updated;
    });
  };

  const toggleFilm = (film: SelectedFilmChip) => {
    setSelectedFilms((prev) => {
      let updated: SelectedFilmChip[];
      if (prev.some((f) => f.slug === film.slug)) {
        updated = prev.filter((f) => f.slug !== film.slug);
      } else {
        updated = [...prev, film];
      }
      localStorage.setItem("mm_selected_films", JSON.stringify(updated));
      return updated;
    });
  };

  const isFilmSelected = (slug: string) => {
    return selectedFilms.some((f) => f.slug === slug);
  };

  const clearFilms = () => {
    setSelectedFilms([]);
    localStorage.removeItem("mm_selected_films");
  };

  return (
    <TasteContext.Provider
      value={{
        selectedFilms,
        addFilm,
        removeFilm,
        toggleFilm,
        isFilmSelected,
        clearFilms,
        activeUsername,
        setActiveUsername,
      }}
    >
      {children}
    </TasteContext.Provider>
  );
}

export function useTaste() {
  const context = useContext(TasteContext);
  if (!context) {
    throw new Error("useTaste must be used within a TasteProvider");
  }
  return context;
}
