/**
 * 로컬 run_events에서 필드만 고른다. 응답을 journal에 넣지 않는다.
 */
import type { DetailRequest, DetailResponse } from "@howling/contracts";
import type Database from "better-sqlite3";
import { listEvents } from "../store/events.js";
import { getRun } from "../store/runs.js";
import { asScalar, readPointer } from "./pointer.js";
import { redactValue } from "./project.js";

export const answerDetail = (db: Database.Database, request: DetailRequest): DetailResponse => {
  const run = getRun(db, request.runId);
  const events = listEvents(db, request.runId);
  if (!run && events.length === 0) {
    return { requestId: request.requestId, runId: request.runId, unavailable: "purged" };
  }
  if (events.length === 0) {
    return { requestId: request.requestId, runId: request.runId, unavailable: "purged" };
  }
  const picked = events.filter((event) => {
    if (request.sequence !== undefined && event.sequence !== request.sequence) {
      return false;
    }
    if (request.nodeId && "nodeId" in event && event.nodeId !== request.nodeId) {
      return false;
    }
    return true;
  });
  if (picked.length === 0) {
    return { requestId: request.requestId, runId: request.runId, unavailable: "purged" };
  }
  const values = picked.map((event) => {
    const source = "outputs" in event ? event.outputs : "inputs" in event ? event.inputs : event;
    if (request.field) {
      return asScalar(readPointer(source, request.field)) ?? redactValue(readPointer(source, request.field));
    }
    return redactValue(source);
  });
  return { requestId: request.requestId, runId: request.runId, value: values };
};
