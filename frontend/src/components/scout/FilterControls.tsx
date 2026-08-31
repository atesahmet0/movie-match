"use client";

export interface FilterControlsProps {
  sentiment?: string;
  onSentimentChange?: (val: string) => void;
  maxPages?: number;
  onMaxPagesChange?: (val: number) => void;
  limit?: number;
  onLimitChange?: (val: number) => void;
  includeBio?: boolean;
  onIncludeBioChange?: (val: boolean) => void;
}

export function FilterControls() {
  return null;
}

