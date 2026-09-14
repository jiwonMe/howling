/** command 중복 판별용 digest. 같은 id에 다른 payload가 오면 충돌로 거부한다. */
import type { EngineCommand } from "../contracts/command.js";
import { canonicalizeJson } from "../json/canonical.js";
import { fnv1a64 } from "../json/hash.js";

export const commandDigest = (command: EngineCommand): string =>
  fnv1a64(canonicalizeJson(command as unknown as import("../contracts/json.js").JsonValue));
