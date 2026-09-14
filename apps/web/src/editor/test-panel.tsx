/**
 * 시험 전력 입력. 시작 버튼은 툴바에 둔다.
 */
import { field, input, label } from "../ui/form.css.js";

export const TestPanel = (props: {
  readonly power: string;
  readonly onPower: (value: string) => void;
}) => (
  <div className={field}>
    <label className={label} htmlFor="test-power">
      시험 전력
    </label>
    <input
      className={input}
      data-testid="test-power"
      id="test-power"
      onChange={(event) => props.onPower(event.target.value)}
      type="number"
      value={props.power}
    />
  </div>
);
