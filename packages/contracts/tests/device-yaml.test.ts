import { describe, expect, it } from "vitest";
import { parseVirtualDevicesYaml } from "../src/device-yaml.js";

describe("virtual device yaml", () => {
  it("parses howling list, products, and helper maps without entity ids", () => {
    expect(
      parseVirtualDevicesYaml(`
- name: 시험 스위치
  kind: boolean
- name: 시험 전력
  kind: 숫자
  min: 0
  max: 100
  step: 1
- name: 작업실 TV
  product: Apple TV
`),
    ).toEqual([
      { name: "시험 스위치", kind: "boolean" },
      { name: "시험 전력", kind: "number", min: 0, max: 100, step: 1 },
      { name: "작업실 TV", product: "apple_tv" },
    ]);
    expect(
      parseVirtualDevicesYaml(`
input_boolean:
  extra_switch:
    name: Extra Switch
input_number:
  extra_power:
    name: Extra Power
    min: 0
    max: 50
`),
    ).toEqual([
      { name: "Extra Switch", kind: "boolean" },
      { name: "Extra Power", kind: "number", min: 0, max: 50 },
    ]);
    expect(
      parseVirtualDevicesYaml("- name: 스위치\n  kind: input_boolean"),
    ).toEqual([{ name: "스위치", kind: "boolean" }]);
    expect(parseVirtualDevicesYaml("- name: 조명\n  kind: light")).toEqual([
      { name: "조명", kind: "light" },
    ]);
    expect(
      parseVirtualDevicesYaml(`
- name: 작업실 환경
  fields:
    - key: occupied
      type: boolean
      label: 재실
    - key: state
      type: select
      options: [sunny, cloudy, rainy]
`),
    ).toEqual([
      {
        name: "작업실 환경",
        fields: [
          { key: "occupied", type: "boolean", label: "재실" },
          { key: "state", type: "select", options: ["sunny", "cloudy", "rainy"] },
        ],
      },
    ]);
    expect(JSON.stringify(parseVirtualDevicesYaml("- name: 스위치\n  kind: switch"))).not.toContain(
      "input_boolean",
    );
  });

  it("rejects empty, unknown, dotted names, mixed product, and more than 32 items", () => {
    expect(() => parseVirtualDevicesYaml("")).toThrow("이름과 종류가 있는 기기가 없습니다.");
    expect(() => parseVirtualDevicesYaml("- name: 조명\n  kind: lamp")).toThrow("종류 또는 제품");
    expect(() => parseVirtualDevicesYaml("- name: a.b\n  kind: boolean")).toThrow("점을 넣을 수 없습니다.");
    expect(() => parseVirtualDevicesYaml("- name: TV\n  product: Apple TV\n  kind: player")).toThrow(
      "함께 넣을 수 없습니다",
    );
    expect(() =>
      parseVirtualDevicesYaml("- name: 환경\n  kind: boolean\n  fields:\n    - key: a\n      type: number"),
    ).toThrow("함께 넣을 수 없습니다");
    const many = Array.from({ length: 33 }, (_, index) => `- name: 스위치 ${index}\n  kind: boolean`).join(
      "\n",
    );
    expect(() => parseVirtualDevicesYaml(many)).toThrow("한 번에 32개까지 넣을 수 있습니다.");
  });
});
