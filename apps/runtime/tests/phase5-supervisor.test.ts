import { describe, expect, it } from "vitest";
import { resolveHaEndpoint } from "../src/ha/supervisor.js";

describe("HA OS supervisor endpoint", () => {
  it("uses supervisor proxy when a token is present", () => {
    const endpoint = resolveHaEndpoint({
      supervisorToken: "hassio",
      url: "http://localhost:8123",
      token: "llat",
    });
    expect(endpoint).toEqual({
      url: "http://supervisor/core",
      token: "hassio",
      websocketPath: "/websocket",
    });
  });

  it("falls back to local setup secrets", () => {
    const endpoint = resolveHaEndpoint({
      url: "http://homeassistant:8123",
      token: "llat",
    });
    expect(endpoint).toEqual({
      url: "http://homeassistant:8123",
      token: "llat",
    });
  });

  it("returns nothing when neither supervisor nor secrets exist", () => {
    expect(resolveHaEndpoint({})).toBeUndefined();
  });
});
