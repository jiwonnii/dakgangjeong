import { PawPrint } from "lucide-react";

const TRAIL_STEPS = [
  { left: "86%", rotate: 186, top: "2%" },
  { left: "73%", rotate: 174, top: "12%" },
  { left: "63%", rotate: 186, top: "26%" },
  { left: "50%", rotate: 174, top: "38%" },
  { left: "39%", rotate: 186, top: "52%" },
  { left: "26%", rotate: 174, top: "64%" },
  { left: "15%", rotate: 186, top: "78%" },
  { left: "4%", rotate: 174, top: "90%" }
];

const CYCLE_MS = 6400;
const STEP_DELAY_MS = 550;

/**
 * 오른쪽 위에서 왼쪽 아래로 한 걸음씩 찍히는 발자국 로딩 트레일.
 * `paw-step` 키프레임은 globals.css에 정의돼 있다 (meoksa_FE 이식, 이전엔 미사용).
 * 회전은 바깥 wrapper에 고정으로 걸어서 keyframe의 translateY/scale 애니메이션과 합성한다.
 */
export function PawTrailLoader() {
  return (
    <div aria-hidden className="relative mt-[10px] h-[110px] w-full">
      {TRAIL_STEPS.map((step, index) => (
        <div
          className="absolute"
          key={index}
          style={{ left: step.left, top: step.top, transform: `rotate(${step.rotate}deg)` }}
        >
          <PawPrint
            className="text-ms-muted"
            fill="currentColor"
            size={16}
            strokeWidth={0}
            style={{
              animation: `paw-step ${CYCLE_MS}ms ease-in-out ${index * STEP_DELAY_MS}ms infinite`,
              opacity: 0
            }}
          />
        </div>
      ))}
    </div>
  );
}
