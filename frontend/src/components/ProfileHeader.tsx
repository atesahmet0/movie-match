"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ExternalLink, RefreshCw } from "lucide-react";
import { UserProfileDetail } from "@/lib/types";
import { useTaste } from "@/lib/taste-context";

interface ProfileHeaderProps {
  profile: UserProfileDetail;
}

export default function ProfileHeader({ profile }: ProfileHeaderProps) {
  const [avatarError, setAvatarError] = useState(false);
  const router = useRouter();
  const { setActiveUsername } = useTaste();

  const handleSwitchUser = () => {
    setActiveUsername("");
    router.push("/");
  };

  const avatarUrl =
    profile.avatar_url && !avatarError
      ? profile.avatar_url
      : "https://s.ltrbxd.com/static/img/avatar80-CTtJ8HSs.png";

  return (
    <div className="solid-card rounded-2xl p-6 sm:p-7">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* User Info */}
        <div className="flex items-start sm:items-center space-x-4">
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={profile.display_name || profile.username}
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl object-cover border-2 border-brand-border"
            />
            {(profile.is_pro || profile.is_patron) && (
              <span className="absolute -bottom-2 -right-2 text-[9px] font-bold px-2 py-0.5 rounded bg-brand-orange text-black uppercase tracking-wider">
                {profile.is_patron ? "PATRON" : "PRO"}
              </span>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {profile.display_name || profile.username}
              </h1>
              <a
                href={profile.profile_url || `https://letterboxd.com/${profile.username}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-xs font-mono text-brand-blue hover:underline"
              >
                <span>@{profile.username}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <div className="inline-flex items-center space-x-1.5 text-xs bg-brand-darker px-3 py-1 rounded-lg border border-brand-border">
                <MapPin className="w-3.5 h-3.5 text-brand-muted" />
                <span className="text-gray-300 font-medium">
                  {profile.location || "No location specified"}
                </span>
                {profile.location && (
                  <button
                    onClick={() => {
                      router.push(`/scout?location=${encodeURIComponent(profile.location)}`);
                    }}
                    className="ml-1.5 text-[10px] text-brand-green hover:underline font-semibold cursor-pointer"
                  >
                    Scout locally
                  </button>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="text-xs text-brand-subtext mt-2 max-w-2xl line-clamp-2">
                {profile.bio}
              </p>
            )}
          </div>
        </div>

        {/* Stats and Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 bg-brand-darker p-3 rounded-xl border border-brand-border">
            <div className="text-center px-2">
              <span className="block text-base font-bold text-brand-green font-mono">
                {profile.stats?.films || profile.recent_films?.length || "0"}
              </span>
              <span className="text-[10px] text-brand-muted uppercase tracking-wider font-semibold">
                Films
              </span>
            </div>
            <div className="h-6 w-px bg-brand-border"></div>
            <div className="text-center px-2">
              <span className="block text-base font-bold text-white font-mono">
                {profile.stats?.this_year || "0"}
              </span>
              <span className="text-[10px] text-brand-muted uppercase tracking-wider font-semibold">
                This Year
              </span>
            </div>
            <div className="h-6 w-px bg-brand-border"></div>
            <div className="text-center px-2">
              <span className="block text-base font-bold text-brand-blue font-mono">
                {profile.stats?.followers || "0"}
              </span>
              <span className="text-[10px] text-brand-muted uppercase tracking-wider font-semibold">
                Followers
              </span>
            </div>
          </div>

          <button
            onClick={handleSwitchUser}
            className="px-3.5 py-2 rounded-xl bg-brand-card hover:bg-brand-cardHover border border-brand-border text-xs text-gray-300 hover:text-white transition flex items-center space-x-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Switch User</span>
          </button>
        </div>
      </div>
    </div>
  );
}
