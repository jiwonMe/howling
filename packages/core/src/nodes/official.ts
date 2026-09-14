/** v0.1 공식 노드를 한 registry에 등록한다. */
import type { MutableNodeRegistry } from "../registry/create-registry.js";
import { createRegistry } from "../registry/create-registry.js";
import { allImplementation, allSpec } from "./all.js";
import { anyImplementation, anySpec } from "./any.js";
import { conditionImplementation, conditionSpec } from "./condition.js";
import { delayImplementation, delaySpec } from "./delay.js";
import { effectImplementation, effectSpec } from "./effect.js";
import { inputImplementation, inputSpec } from "./input.js";
import { mapImplementation, mapSpec } from "./map.js";
import { rollingMeanImplementation, rollingMeanSpec } from "./rolling-mean.js";

export const registerOfficialNodes = (registry: MutableNodeRegistry): void => {
  registry.register(inputSpec, inputImplementation);
  registry.register(mapSpec, mapImplementation);
  registry.register(conditionSpec, conditionImplementation);
  registry.register(allSpec, allImplementation);
  registry.register(anySpec, anyImplementation);
  registry.register(effectSpec, effectImplementation);
  registry.register(delaySpec, delayImplementation);
  registry.register(rollingMeanSpec, rollingMeanImplementation);
};

export const createOfficialRegistry = (): MutableNodeRegistry => {
  const registry = createRegistry();
  registerOfficialNodes(registry);
  return registry;
};
