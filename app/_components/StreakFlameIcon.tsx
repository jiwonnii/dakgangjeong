type Props = {
  size?: number;
  className?: string;
};

/**
 * 연속 산책 스트릭에 쓰는 불꽃 아이콘. 사용자가 준 실제 이미지(public/불꽃.png)를 그대로 쓴다.
 * 래스터 이미지라서 currentColor로 색이 안 바뀐다 — 항상 검정 실루엣으로 보인다.
 */
export function StreakFlameIcon({ size = 17, className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className={className} height={size} src="/불꽃.png" width={size} />
  );
}
