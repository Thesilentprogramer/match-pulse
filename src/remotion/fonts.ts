import { loadFont as loadBarlow } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";

export const display = loadBarlow("normal", {
  weights: ["600", "700"],
  subsets: ["latin"],
});

export const body = loadOutfit("normal", {
  weights: ["400", "600"],
  subsets: ["latin"],
});
