type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/**
 * meoksa_FE/src/components/ToggleRow.tsx 이식.
 * 스위치 모양은 Mobbin 참고 디자인(켜짐=초록 꽉 찬 필, 꺼짐=진한 회색 꽉 찬 필)을
 * 그대로 가져왔다. 색은 새로 뽑지 않고 기존 토큰만 썼다: 켜짐 `ms-action-green`,
 * 꺼짐 `ms-muted`(= --text-muted, 이 저장소에서 이미 쓰이던 진회색).
 */
export function ToggleRow({ label, checked, onChange }: Props) {
  return (
    <label className="flex h-[56px] items-center justify-between">
      <span className="text-[14px] font-bold leading-6 tracking-normal text-ms-ink">{label}</span>
      <button
        aria-pressed={checked}
        className={`relative h-[32px] w-[54px] shrink-0 rounded-full transition-colors ${
          checked ? "bg-ms-action-green" : "bg-ms-muted"
        }`}
        onClick={() => onChange(!checked)}
        type="button"
      >
        <span
          className={`absolute left-0 top-[3px] h-[26px] w-[26px] rounded-full bg-white shadow-[0_2px_4px_rgba(12,12,12,0.25)] transition-transform ${
            checked ? "translate-x-[25px]" : "translate-x-[3px]"
          }`}
        />
      </button>
    </label>
  );
}
