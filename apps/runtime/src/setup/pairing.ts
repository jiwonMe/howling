/**
 * API pairing 생성과 완료 polling.
 */
import { writeSecret } from "../secrets/store.js";

export interface PairingSnapshot {
  readonly status: string;
  readonly code?: string;
  readonly pairingId?: string;
}

export interface PairingState {
  readonly snapshot: () => PairingSnapshot;
  readonly set: (next: PairingSnapshot) => void;
}

export interface PairingDeps {
  readonly apiHttpUrl: string;
  readonly secretRoot: string;
  readonly onCredential: (input: {
    readonly token: string;
    readonly runtimeId: string;
    readonly siteId: string;
  }) => void;
}

export const createPairingState = (): PairingState => {
  let current: PairingSnapshot = { status: "idle" };
  return {
    snapshot: () => current,
    set: (next) => {
      current = next;
    },
  };
};

export const requestPairing = async (
  deps: PairingDeps,
  state: PairingState,
): Promise<void> => {
  const created = await fetch(`${deps.apiHttpUrl}/api/v1/runtime-pairings`, {
    method: "POST",
  });
  if (!created.ok) {
    state.set({ status: "error" });
    return;
  }
  const body = (await created.json()) as {
    pairingId: string;
    code: string;
    runtimeSecret: string;
  };
  state.set({ status: "pending", code: body.code, pairingId: body.pairingId });
  void pollPairing(deps, state, body);
};

const pollPairing = async (
  deps: PairingDeps,
  state: PairingState,
  body: { readonly pairingId: string; readonly code: string; readonly runtimeSecret: string },
): Promise<void> => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const poll = await fetch(`${deps.apiHttpUrl}/api/v1/runtime-pairings/${body.pairingId}`, {
      headers: { "x-runtime-secret": body.runtimeSecret },
    });
    if (!poll.ok) {
      continue;
    }
    const next = (await poll.json()) as {
      status: string;
      token?: string;
      runtimeId?: string;
      siteId?: string;
    };
    if (next.status === "claimed" && next.token && next.runtimeId && next.siteId) {
      writeSecret(deps.secretRoot, "runtime-token", next.token);
      await fetch(`${deps.apiHttpUrl}/api/v1/runtime-pairings/${body.pairingId}/ack`, {
        method: "POST",
        headers: { "x-runtime-secret": body.runtimeSecret },
      });
      state.set({ status: "ready", pairingId: body.pairingId, code: body.code });
      deps.onCredential({
        token: next.token,
        runtimeId: next.runtimeId,
        siteId: next.siteId,
      });
      return;
    }
  }
  state.set({ status: "timeout", code: body.code, pairingId: body.pairingId });
};
