type Props = {
  size?: number;
  strokeWidth?: number;
  className?: string;
};

/**
 * 반려동물 사료 그릇 아이콘. 사용자가 준 실제 이미지(public/사료.png)를 그대로 쓴다.
 * 래스터 이미지라서 currentColor로 색이 안 바뀐다 — 항상 검정선으로 보인다.
 * strokeWidth는 다른 아이콘과 props 시그니처를 맞추기 위해 남겨뒀을 뿐 쓰이지 않는다.
 */
export function PetBowlIcon({ size = 20, className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className={className} height={size} src="/사료.png" width={size} />
  );
}
