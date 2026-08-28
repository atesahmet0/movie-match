"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Zap, Loader2 } from "lucide-react";
import { useTaste } from "@/lib/taste-context";

export default function ProfileLogin() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setActiveUsername } = useTaste();

  const handleConnect = (uname: string) => {
    const clean = uname.trim().replace(/^@/, "");
    if (!clean) return;
    setLoading(true);
    setActiveUsername(clean);
    router.push(`/?user=${encodeURIComponent(clean)}`);
  };

  return (
    <div className="solid-card rounded-2xl p-6 sm:p-10 max-w-2xl mx-auto text-center">
      <div className="w-14 h-14 rounded-2xl bg-brand-card border border-brand-border flex items-center justify-center mx-auto mb-4 text-brand-green">
        <Film className="w-7 h-7" />
      </div>
      <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Connect Your Letterboxd Profile</h2>
      <p className="text-brand-subtext text-xs sm:text-sm mb-6 max-w-md mx-auto">
        Enter your public Letterboxd username to load your pinned favorites, watched films, and scout locals who share your taste.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleConnect(username);
        }}
        className="space-y-4 max-w-md mx-auto"
      >
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-brand-muted font-mono text-sm">@</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="e.g. karsten or your username"
            className="w-full pl-8 pr-4 py-3 bg-brand-darker border border-brand-border rounded-xl text-white placeholder-brand-muted focus:outline-none glow-focus text-sm font-medium"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-green hover:bg-brand-greenHover disabled:opacity-50 text-black font-bold py-3 px-6 rounded-xl transition duration-150 flex items-center justify-center space-x-2 text-sm cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting Letterboxd...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span>Load My Movies & Profile</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-brand-border">
        <p className="text-xs text-brand-muted mb-2">Quick test profiles:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {["karsten", "davidehrlich", "letterboxd"].map((user) => (
            <button
              key={user}
              onClick={() => handleConnect(user)}
              className="text-xs px-3 py-1 bg-brand-darker border border-brand-border rounded-lg text-gray-300 hover:text-brand-green hover:border-brand-green transition cursor-pointer"
            >
              @{user}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
