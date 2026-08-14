type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/**
 * meoksa_FE/src/components/ToggleRow.tsx 이식.
 * 원본은 legacy `brand-500`/`pet-*` 팔레트를 썼지만, 이 저장소 tailwind.config.ts에는
 * 그 이름들이 없어서 `ms-brand`(켜짐)/`ms-sunken`+`ms-line`(꺼짐)로 다시 매핑했다.
 */
export function ToggleRow({ label, checked, onChange }: Props) {
  return (
    <label className="flex h-[56px] items-center justify-between">
      <span className="text-[14px] font-bold leading-6 tracking-normal text-ms-ink">{label}</span>
      <button
        aria-pressed={checked}
        className="relative mr-[2px] h-[36px] w-[60px] shrink-0"
        onClick={() => onChange(!checked)}
        type="button"
      >
        <span
          className={`absolute left-[6px] top-[3px] h-[30px] w-[48px] rounded-[26px] transition-colors ${
            checked ? "bg-ms-brand" : "border border-ms-line bg-ms-sunken"
          }`}
        />
        <span
          className={`absolute left-0 top-0 h-[32px] w-[32px] rounded-full bg-ms-card shadow-[0_8px_18px_rgba(12,12,12,0.18),0_2px_4px_rgba(12,12,12,0.12)] transition-transform ${
            checked ? "translate-x-[28px]" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}
