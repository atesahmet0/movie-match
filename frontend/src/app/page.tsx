import { Metadata } from "next";
import { fetchUserProfile, fetchUserFilms } from "@/lib/api";
import ProfileLogin from "@/components/ProfileLogin";
import ProfileHeader from "@/components/ProfileHeader";
import FavoriteFilmsSection from "@/components/FavoriteFilmsSection";
import ProfileFilmsSection from "@/components/ProfileFilmsSection";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const resolvedParams = await searchParams;
  const username = typeof resolvedParams.user === "string" ? resolvedParams.user : undefined;

  if (username) {
    return {
      title: `@${username} on Letterboxd Movie Matcher`,
      description: `View @${username}'s Letterboxd favorites, watched films, and taste matches.`,
    };
  }

  return {
    title: "Letterboxd Movie Matcher - Scout & Match by Taste",
    description:
      "Connect your Letterboxd profile to scout and match with film lovers in your area based on shared movie tastes.",
  };
}

export default async function HomePage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const username = typeof resolvedParams.user === "string" ? resolvedParams.user.trim() : "";
  const category = typeof resolvedParams.category === "string" ? resolvedParams.category : "films";

  let profile = null;
  let categoryFilms = null;

  if (username) {
    const profileRes = await fetchUserProfile(username);
    if (profileRes?.profile) {
      profile = profileRes.profile;
      if (category === "films" && profile.recent_films && profile.recent_films.length > 0) {
        categoryFilms = profile.recent_films;
      } else {
        const filmsRes = await fetchUserFilms(username, category, 1);
        categoryFilms = filmsRes?.films || [];
      }
    }
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <ProfileLogin />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connected Profile Dashboard */}
      <ProfileHeader profile={profile} />

      {/* 4 Pinned Favorites */}
      {profile.favorite_films && profile.favorite_films.length > 0 && (
        <FavoriteFilmsSection
          username={profile.username}
          favoriteFilms={profile.favorite_films}
          userLocation={profile.location}
        />
      )}

      {/* Personal Library Browser */}
      <ProfileFilmsSection
        username={profile.username}
        initialCategory={category}
        initialFilms={categoryFilms || profile.recent_films || []}
      />
    </div>
  );
}
