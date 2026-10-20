import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  width?: number;
  height?: number;
};

/**
 * App-theme logo: teal glyph in light mode, white glyph in dark mode.
 * Uses the app ThemeProvider (class), not prefers-color-scheme.
 */
export function BrandLogo({
  className,
  width = 32,
  height = 32,
}: BrandLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch: default to light-mode (DARK glyph) until mounted.
  const isDark = mounted && resolvedTheme === "dark";
  const src = isDark
    ? "/brand/EMERALD_Scm_LIGHT_png.png"
    : "/brand/EMERALD_Scm_DARK_png.png";

  return (
    <img
      src={src}
      alt="Emerald SCM"
      width={width}
      height={height}
      className={cn("object-contain", className)}
      decoding="async"
    />
  );
}
