/* Hallmark · component: ProfileHeader · genre: atmospheric · theme: Midnight Cinema
 * motion: spring-entrance · hover-sheen · stats-counter
 */
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ExternalLink, RefreshCw, Film, Calendar, Users, Compass } from "lucide-react";
import { UserProfileDetail } from "@/lib/types";
import { useTaste } from "@/lib/taste-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card p-6 sm:p-7 relative overflow-hidden rounded-3xl border border-brand-border/90 shadow-2xl"
    >
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-brand-green/5 blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        {/* User Info */}
        <div className="flex items-start sm:items-center space-x-4 sm:space-x-5">
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={profile.display_name || profile.username}
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-brand-border shadow-2xl"
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

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight font-display truncate">
                {profile.display_name || profile.username}
              </h1>
              <a
                href={profile.profile_url || `https://letterboxd.com/${profile.username}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-xs font-mono text-brand-blue hover:text-brand-green transition"
              >
                <span>@{profile.username}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className="inline-flex items-center space-x-1.5 text-xs bg-brand-darker px-3 py-1 rounded-xl border border-brand-border">
                <MapPin className="w-3.5 h-3.5 text-brand-green" />
                <span className="text-white font-medium">
                  {profile.location || "No location specified"}
                </span>
                {profile.location && (
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/scout?location=${encodeURIComponent(profile.location)}`);
                    }}
                    className="ml-2 text-[11px] text-brand-green hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Compass className="w-3 h-3" />
                    <span>Scout city &rarr;</span>
                  </button>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="text-xs text-brand-subtext mt-2.5 max-w-2xl line-clamp-2 leading-relaxed">
                {profile.bio}
              </p>
            )}
          </div>
        </div>

        {/* Stats and Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-brand-darker/90 p-2.5 rounded-2xl border border-brand-border">
            <div className="text-center px-2 sm:px-3 py-1">
              <span className="block text-base sm:text-lg font-extrabold text-brand-green font-mono">
                {profile.stats?.films || profile.recent_films?.length || "0"}
              </span>
              <span className="text-[10px] text-brand-muted uppercase tracking-wider font-semibold font-mono">
                Films
              </span>
            </div>
            <div className="text-center px-2 sm:px-3 py-1 border-x border-brand-border">
              <span className="block text-base sm:text-lg font-extrabold text-white font-mono">
                {profile.stats?.this_year || "0"}
              </span>
              <span className="text-[10px] text-brand-muted uppercase tracking-wider font-semibold font-mono">
                This Year
              </span>
            </div>
            <div className="text-center px-2 sm:px-3 py-1">
              <span className="block text-base sm:text-lg font-extrabold text-brand-blue font-mono">
                {profile.stats?.followers || "0"}
              </span>
              <span className="text-[10px] text-brand-muted uppercase tracking-wider font-semibold font-mono">
                Followers
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={handleSwitchUser}
            className="h-auto py-2.5 px-4 rounded-xl"
            leftIcon={<RefreshCw className="w-3.5 h-3.5 text-brand-orange" />}
          >
            <span>Switch User</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
