"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { clearHistory } from "@/lib/api";

export default function HistoryClearButton() {
  const router = useRouter();
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    if (!confirm("Clear all previous search history?")) return;
    setClearing(true);
    await clearHistory();
    setClearing(false);
    router.refresh();
  };

  return (
    <button
      onClick={handleClear}
      disabled={clearing}
      className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
    >
      {clearing ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
      <span>Clear History</span>
    </button>
  );
}
