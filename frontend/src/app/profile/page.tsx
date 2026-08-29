import { Metadata } from "next";
import { fetchUserProfile, fetchUserFilms } from "@/lib/api";
import ProfileLogin from "@/components/ProfileLogin";
import ProfileHeader from "@/components/ProfileHeader";
import FavoriteFilmsSection from "@/components/FavoriteFilmsSection";
import ProfileFilmsSection from "@/components/ProfileFilmsSection";

export const dynamic = "force-dynamic";

interface ProfilePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ searchParams }: ProfilePageProps): Promise<Metadata> {
  const resolvedParams = await searchParams;
  const username = typeof resolvedParams.user === "string" ? resolvedParams.user : undefined;

  if (username) {
    return {
      title: `@${username} — MovieMatch Profile`,
      description: `View @${username}'s favorite cinema cornerstones, watched films, and matches.`,
    };
  }

  return {
    title: "My Profile — MovieMatch",
    description:
      "Connect your cinema profile to explore your 4 pinned favorites, personal film library, and find local matches.",
  };
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
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
