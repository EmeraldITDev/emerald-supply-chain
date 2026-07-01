import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/**
 * Emits dist/version.json and injects __APP_BUILD_ID__ for deploy detection.
 */
export function versionJsonPlugin(mode: string, buildId?: string): Plugin {
  const id =
    buildId ||
    (mode === "development"
      ? "dev-local"
      : process.env.VITE_BUILD_ID || `build-${Date.now()}`);

  return {
    name: "scm-version-json",
    config() {
      return {
        define: {
          __APP_BUILD_ID__: JSON.stringify(id),
        },
      };
    },
    closeBundle() {
      if (mode !== "production") return;
      const outDir = resolve(process.cwd(), "dist");
      writeFileSync(
        resolve(outDir, "version.json"),
        `${JSON.stringify({ buildId: id, builtAt: new Date().toISOString() }, null, 2)}\n`,
      );
    },
  };
}
