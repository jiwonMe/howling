/**
 * type+version 명시 등록.
 * 중복 등록을 거부하고 실행 중 구현을 교체하지 않는다.
 */
import type { NodeImplementation, NodeSpec, RegisteredNode } from "../contracts/node.js";

export interface NodeRegistry {
  readonly get: (type: string, version: number) => RegisteredNode | undefined;
  readonly list: () => readonly RegisteredNode[];
}

export interface MutableNodeRegistry extends NodeRegistry {
  readonly register: (spec: NodeSpec, implementation: NodeImplementation) => void;
}

const keyOf = (type: string, version: number): string => `${type}@${version}`;

export const createRegistry = (): MutableNodeRegistry => {
  const nodes = new Map<string, RegisteredNode>();
  return {
    register: (spec, implementation) => {
      const key = keyOf(spec.type, spec.version);
      if (nodes.has(key)) {
        throw new Error(`duplicate node registration: ${key}`);
      }
      nodes.set(key, { spec, implementation });
    },
    get: (type, version) => nodes.get(keyOf(type, version)),
    list: () => [...nodes.values()],
  };
};
