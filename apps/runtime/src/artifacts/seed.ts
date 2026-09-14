/**
 * 단계 1 시드 artifact. 공식 registry로 compile한다.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkflowDefinition } from "@howling/core";
import type Database from "better-sqlite3";
import { upsertArtifact } from "../store/artifacts.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../../fixtures");

export const seedArtifacts = (db: Database.Database): void => {
  for (const name of ["power-alert", "delay-effect"] as const) {
    const definition = JSON.parse(
      readFileSync(join(fixtures, `${name}.json`), "utf8"),
    ) as WorkflowDefinition;
    upsertArtifact(db, { id: name, definition });
  }
};
