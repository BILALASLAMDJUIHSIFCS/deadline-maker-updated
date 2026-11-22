import { lazy, Suspense } from "react";
import type { ThemeId } from "../../lib/theme";
import MoltenFX from "./MoltenFX";
import BloomFX from "./BloomFX";

// Heavy engines are split out so other themes never download them.
const SphereFX = lazy(() => import("./SphereFX"));
const PixelDialFX = lazy(() => import("./PixelDialFX"));

// Full-screen background layer for themes whose signature animation lives
// behind the content. Purely decorative and pointer-transparent.
export default function ThemeFX({ theme }: { theme: ThemeId }) {
  switch (theme) {
    case "molten":
      return <MoltenFX />;
    case "bloom":
      return <BloomFX />;
    case "sphere":
      return (
        <Suspense fallback={null}>
          <SphereFX />
        </Suspense>
      );
    case "pixel":
      return (
        <Suspense fallback={null}>
          <PixelDialFX />
        </Suspense>
      );
    default:
      return null;
  }
}
