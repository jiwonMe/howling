/**
 * 노드 타입 → 아이콘. 팔레트와 카드가 같은 그림을 쓴다.
 */
import type { ReactElement, SVGProps } from "react";
import {
  ArrowRightFromLineOutline18,
  BoltOutline18,
  BracketsCurlyOutline18,
  ChartLineOutline18,
  ClockOutline18,
  MergeOutline18,
  NodesOutline18,
  SplitOutline18,
  ThreeWayArrowMergeOutline18,
} from "../ui/icons/index.js";

type IconProps = SVGProps<SVGSVGElement> & { strokeWidth?: number | string };

const ICONS: Record<string, (props: IconProps) => ReactElement> = {
  "core.input": ArrowRightFromLineOutline18,
  "analysis.rolling-mean": ChartLineOutline18,
  "core.map": BracketsCurlyOutline18,
  "core.condition": SplitOutline18,
  "core.all": ThreeWayArrowMergeOutline18,
  "core.any": MergeOutline18,
  "core.delay": ClockOutline18,
  "core.effect": BoltOutline18,
};

export const NodeIcon = (props: IconProps & { readonly type: string }) => {
  const { type, ...rest } = props;
  const Icon = ICONS[type] ?? NodesOutline18;
  return <Icon aria-hidden {...rest} />;
};
