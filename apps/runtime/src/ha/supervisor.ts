/**
 * HA OS Supervisor 토큰이 있으면 proxy 경로를 쓴다.
 */
export type HaEndpoint = {
  readonly url: string;
  readonly token: string;
  readonly websocketPath?: string;
};

export const resolveHaEndpoint = (input: {
  readonly supervisorToken?: string;
  readonly url?: string | null | undefined;
  readonly token?: string | null | undefined;
}): HaEndpoint | undefined => {
  if (input.supervisorToken) {
    return {
      url: "http://supervisor/core",
      token: input.supervisorToken,
      websocketPath: "/websocket",
    };
  }
  if (!input.url || !input.token) {
    return undefined;
  }
  return { url: input.url, token: input.token };
};
