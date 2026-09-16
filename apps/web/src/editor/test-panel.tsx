/**
 * 시험 전력 입력. 시작 버튼은 툴바에 둔다.
 */
import { field, input, label } from "../ui/form.css.js";
import { muted, panelSection } from "../ui/editor.css.js";

export const TestPanel = (props: {
  readonly power: string;
  readonly onPower: (value: string) => void;
}) => (
  <section className={panelSection}>
    <div className={field}>
      <label className={label} htmlFor="test-power">
        시험 입력 값 (power)
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
    <p className={muted}>「시험」과 「실행」 버튼이 이 값을 입력으로 씁니다. 실제 기기는 시험에서 움직이지 않습니다.</p>
  </section>
);
