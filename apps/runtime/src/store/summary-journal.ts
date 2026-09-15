/**
 * Summary stream cursor. raw·observe는 sync-journal을 쓴다.
 */
import type Database from "better-sqlite3";
import { ackJournal, appendJournal, listUnacked, type JournalRow } from "./sync-journal.js";

export type SummaryJournalRow = JournalRow;

export const appendSummaryJournal = (
  db: Database.Database,
  runId: string,
  item: unknown,
): number => appendJournal(db, "summary", runId, item);

export const listUnackedSummary = (db: Database.Database): JournalRow[] =>
  listUnacked(db, "summary");

export const ackSummary = (db: Database.Database, syncSeq: number): void => {
  ackJournal(db, "summary", syncSeq);
};
