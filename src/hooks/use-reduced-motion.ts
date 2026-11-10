import { useState } from "react";

export function usePrefersReducedMotion(): boolean {
  const [reduce] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  return reduce;
}
