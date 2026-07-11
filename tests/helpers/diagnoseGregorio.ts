/**
 * Inspect the local Gregorio / GregorioTeX toolchain and explain mismatches.
 */

import { existsSync, readFileSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";

export type GregorioDiagnosis = {
  ok: boolean;
  gregoriotexVersion: string | null;
  gregorioExecutables: Array<{ path: string; version: string | null }>;
  issues: string[];
};

const GREGORIO_EXE_NAMES = [
  "gregorio-6_2_0",
  "gregorio-6_1_0",
  "gregorio",
  "miktex-gregorio",
] as const;

const COMMON_BIN_DIRS = [
  path.join(process.env.LOCALAPPDATA ?? "", "Programs", "MiKTeX", "miktex", "bin", "x64"),
  path.join(process.env.LOCALAPPDATA ?? "", "MiKTeX", "miktex", "bin", "x64"),
  path.join(process.env.ProgramFiles ?? "", "gregorio", "bin"),
  path.join(process.env["ProgramFiles(x86)"] ?? "", "gregorio", "bin"),
];

function run(command: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    encoding: "utf-8",
    shell: process.platform === "win32",
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function parseGregorioVersion(output: string): string | null {
  const match = output.match(/Gregorio\s+(\d+\.\d+(?:\.\d+)?[^\s]*)/i);
  return match?.[1] ?? null;
}

function majorMinor(version: string): string {
  const match = version.match(/^(\d+\.\d+)/);
  return match?.[1] ?? version;
}

function findGregoriotexVersion(): string | null {
  const kpse = run("kpsewhich", ["gregoriotex.lua"]);
  if (!kpse.ok || !kpse.stdout) return null;

  const luaPath = kpse.stdout.split(/\r?\n/)[0];
  if (!luaPath || !existsSync(luaPath)) return null;

  const text = readFileSync(luaPath, "utf-8");
  const match = text.match(/internalversion\s*=\s*'([^']+)'/);
  return match?.[1] ?? null;
}

function findExecutables(): Array<{ path: string; version: string | null }> {
  const found: Array<{ path: string; version: string | null }> = [];
  const seen = new Set<string>();

  for (const dir of COMMON_BIN_DIRS) {
    if (!dir || !existsSync(dir)) continue;
    for (const name of GREGORIO_EXE_NAMES) {
      for (const file of [`${name}.exe`, name]) {
        const fullPath = path.join(dir, file);
        if (!existsSync(fullPath) || seen.has(fullPath.toLowerCase())) continue;
        seen.add(fullPath.toLowerCase());
        const versionOut = run(fullPath, ["-V"]);
        found.push({
          path: fullPath,
          version: parseGregorioVersion(versionOut.stdout || versionOut.stderr),
        });
      }
    }
  }

  for (const name of GREGORIO_EXE_NAMES) {
    const where = run("where", [name]);
    if (!where.ok) continue;
    for (const line of where.stdout.split(/\r?\n/)) {
      const fullPath = line.trim();
      if (!fullPath || seen.has(fullPath.toLowerCase())) continue;
      seen.add(fullPath.toLowerCase());
      const versionOut = run(fullPath, ["-V"]);
      found.push({
        path: fullPath,
        version: parseGregorioVersion(versionOut.stdout || versionOut.stderr),
      });
    }
  }

  return found;
}

export function diagnoseGregorio(): GregorioDiagnosis {
  const issues: string[] = [];
  const gregoriotexVersion = findGregoriotexVersion();
  const gregorioExecutables = findExecutables();

  if (!gregoriotexVersion) {
    issues.push("Could not determine the installed GregorioTeX version (kpsewhich gregoriotex.lua failed).");
  }

  if (gregorioExecutables.length === 0) {
    issues.push(
      "No gregorio executable found on PATH or in common install locations. "
      + "GregorioTeX auto-compile needs a binary named gregorio-MAJOR_MINOR (e.g. gregorio-6_1_0) or gregorio.",
    );
  }

  if (gregoriotexVersion) {
    const expectedName = `gregorio-${gregoriotexVersion.replace(/\./g, "_")}`;
    const expectedMm = majorMinor(gregoriotexVersion);
    const exact = gregorioExecutables.find((exe) =>
      path.basename(exe.path, ".exe").toLowerCase() === expectedName.toLowerCase(),
    );
    const compatible = gregorioExecutables.filter(
      (exe) => exe.version && majorMinor(exe.version) === expectedMm,
    );

    if (!exact && compatible.length === 0) {
      const foundVersions = gregorioExecutables
        .map((exe) => `${path.basename(exe.path)}${exe.version ? ` (${exe.version})` : ""}`)
        .join(", ");
      issues.push(
        `GregorioTeX ${gregoriotexVersion} expects a ${expectedName} or gregorio ${expectedMm}.x binary, `
        + `but found: ${foundVersions || "none"}.`,
      );
    }

    const standaloneDir = path.join(process.env["ProgramFiles(x86)"] ?? "", "gregorio", "bin");
    const standaloneOnly = existsSync(path.join(standaloneDir, "gregorio-6_2_0.exe"))
      && !existsSync(path.join(standaloneDir, "gregorio.exe"));
    if (standaloneOnly && compatible.length === 0) {
      issues.push(
        "A standalone Gregorio 6.2 install was found, but no binary matches the active GregorioTeX version. "
        + "Upgrade MiKTeX gregoriotex or install a matching Gregorio binary.",
      );
    }
  }

  return {
    ok: issues.length === 0,
    gregoriotexVersion,
    gregorioExecutables,
    issues,
  };
}

export function formatGregorioDiagnosis(d: GregorioDiagnosis): string {
  const lines = [
    `GregorioTeX: ${d.gregoriotexVersion ?? "unknown"}`,
    "Gregorio binaries:",
  ];
  if (d.gregorioExecutables.length === 0) {
    lines.push("  (none found)");
  } else {
    for (const exe of d.gregorioExecutables) {
      lines.push(`  ${exe.path}${exe.version ? ` — ${exe.version}` : ""}`);
    }
  }
  if (d.issues.length > 0) {
    lines.push("", "Issues:");
    for (const issue of d.issues) {
      lines.push(`  - ${issue}`);
    }
  }
  return lines.join("\n");
}
