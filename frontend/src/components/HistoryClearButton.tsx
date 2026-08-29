/* Hallmark · component: HistoryClearButton · genre: atmospheric · theme: Midnight Cinema
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { clearHistory } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function HistoryClearButton() {
  const router = useRouter();
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    if (!confirm("Are you sure you want to clear all previous Letterboxd search history?")) return;
    setClearing(true);
    await clearHistory();
    setClearing(false);
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={handleClear}
      isLoading={clearing}
      loadingText="Clearing..."
      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
      className="font-mono text-xs"
    >
      <span>Clear History</span>
    </Button>
  );
}
