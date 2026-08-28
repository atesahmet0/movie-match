"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ExternalLink, RefreshCw, Film, Calendar, Users } from "lucide-react";
import { UserProfileDetail } from "@/lib/types";
import { useTaste } from "@/lib/taste-context";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass-card p-6 sm:p-7 relative overflow-hidden"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        {/* User Info */}
        <div className="flex items-start sm:items-center space-x-4">
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={profile.display_name || profile.username}
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-[#2c3440] shadow-xl"
            />
            {profile.is_patron && (
              <Badge variant="patron" className="absolute -bottom-2 -right-2">
                PATRON
              </Badge>
            )}
            {profile.is_pro && !profile.is_patron && (
              <Badge variant="pro" className="absolute -bottom-2 -right-2">
                PRO
              </Badge>
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
                className="inline-flex items-center space-x-1 text-xs font-mono text-[#40bcf4] hover:text-[#00e054] transition"
              >
                <span>@{profile.username}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className="inline-flex items-center space-x-1.5 text-xs bg-[#14181c] px-3 py-1.5 rounded-xl border border-[#2c3440]">
                <MapPin className="w-3.5 h-3.5 text-[#00e054]" />
                <span className="text-[#e1e7ed] font-medium">
                  {profile.location || "No location specified"}
                </span>
                {profile.location && (
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/scout?location=${encodeURIComponent(profile.location)}`);
                    }}
                    className="ml-2 text-[11px] text-[#00e054] hover:underline font-semibold cursor-pointer"
                  >
                    Scout city &rarr;
                  </button>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="text-xs text-[#99aabb] mt-2.5 max-w-2xl line-clamp-2 leading-relaxed">
                {profile.bio}
              </p>
            )}
          </div>
        </div>

        {/* Stats and Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 bg-[#14181c] p-3 rounded-2xl border border-[#2c3440]">
            <div className="text-center px-3">
              <span className="block text-base font-extrabold text-[#00e054] font-mono">
                {profile.stats?.films || profile.recent_films?.length || "0"}
              </span>
              <span className="text-[10px] text-[#667788] uppercase tracking-wider font-semibold">
                Films
              </span>
            </div>
            <div className="h-6 w-px bg-[#2c3440]"></div>
            <div className="text-center px-3">
              <span className="block text-base font-extrabold text-white font-mono">
                {profile.stats?.this_year || "0"}
              </span>
              <span className="text-[10px] text-[#667788] uppercase tracking-wider font-semibold">
                This Year
              </span>
            </div>
            <div className="h-6 w-px bg-[#2c3440]"></div>
            <div className="text-center px-3">
              <span className="block text-base font-extrabold text-[#40bcf4] font-mono">
                {profile.stats?.followers || "0"}
              </span>
              <span className="text-[10px] text-[#667788] uppercase tracking-wider font-semibold">
                Followers
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSwitchUser}
            className="px-4 py-2.5 rounded-xl bg-[#1b2228] hover:bg-[#222b33] border border-[#2c3440] hover:border-[#3d4957] text-xs text-[#e1e7ed] hover:text-white transition flex items-center space-x-2 cursor-pointer font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#ff8000]" />
            <span>Switch User</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
