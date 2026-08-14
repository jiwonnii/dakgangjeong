"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  LogOut,
  Mail,
  PawPrint,
  PenLine,
  Trash2,
  UserRound
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import type { BreedOption, OnboardingStatus, OptionItem } from "../lib/types";
import { ToggleRow } from "../_components/ToggleRow";

type MeResponse = { user: { id: string; email: string | null; emailVerified: boolean } };
type DogsResponse = { dogs: OnboardingStatus["dogs"]; count: number };
type GuardianForm = {
  displayName: string;
  locationPermissionAgreed: boolean;
  notificationPermissionAgreed: boolean;
  marketingAgreed: boolean;
};
type DogForm = {
  name: string;
  breed: string;
  birthDate: string;
  weightKg: string;
  socialPreference: string;
  personalityTags: string[];
};

const emptyGuardianForm: GuardianForm = {
  displayName: "",
  locationPermissionAgreed: false,
  notificationPermissionAgreed: false,
  marketingAgreed: false
};
const emptyDogForm: DogForm = {
  name: "",
  breed: "",
  birthDate: "",
  weightKg: "",
  socialPreference: "neutral",
  personalityTags: []
};

function todayDateString() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function formatOption(value: string | undefined, options: OptionItem[] | undefined) {
  if (!value) return "미입력";
  return options?.find((option) => option.value === value)?.label ?? value;
}

function formatTags(values: string[] | undefined, options: OptionItem[] | undefined) {
  if (!values?.length) return "선택한 키워드가 없어요.";
  return values.map((value) => formatOption(value, options)).join(", ");
}

function mapDogToForm(dog: OnboardingStatus["dogs"][number] | null): DogForm {
  if (!dog) return emptyDogForm;
  return {
    name: dog.name ?? "",
    breed: dog.breed ?? dog.breedInfo?.id ?? "",
    birthDate: dog.birth_date ?? "",
    weightKg: dog.weight_kg === undefined ? "" : String(dog.weight_kg),
    socialPreference: dog.social_preference ?? "neutral",
    personalityTags: dog.personality_tags ?? []
  };
}

// 카드 배경 장식용 원. meoksa_FE MyPageScreen의 BUBBLE_DOTS를 단순화해 재사용했다.
const BUBBLE_DOTS = [
  { key: "0-0", left: -10, top: -18 },
  { key: "0-1", left: 44, top: -18 },
  { key: "0-2", left: 98, top: -18 },
  { key: "1-0", left: 18, top: 30 },
  { key: "1-1", left: 72, top: 30 },
  { key: "1-2", left: 126, top: 30 }
];

type SectionCardProps = {
  title: string;
  caption: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

// meoksa_FE MyPageScreen의 SectionCard 이식 — 접고 펼 수 있는 카드 셸.
function SectionCard({ title, caption, defaultOpen = true, children }: SectionCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="rounded-[22px] border border-ms-line bg-ms-card shadow-sm">
      <button
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-[14px] px-[18px] py-[16px] text-left"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <span>
          <span className="block text-[16px] font-extrabold leading-none text-ms-ink">{title}</span>
          <span className="mt-[7px] block text-[12px] font-semibold leading-none text-ms-muted">{caption}</span>
        </span>
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-ms-sunken text-ms-secondary">
          {isOpen ? <ChevronUp size={18} strokeWidth={2.2} /> : <ChevronDown size={18} strokeWidth={2.2} />}
        </span>
      </button>
      {isOpen ? <div className="border-t border-ms-line px-[18px] py-[16px]">{children}</div> : null}
    </section>
  );
}

export default function MyTabPage() {
  const router = useRouter();
  const { api, isRestored, options, primaryDog, refreshStatus, signOut, status, token } = useAuth();
  const [email, setEmail] = useState("");
  const [dogs, setDogs] = useState<OnboardingStatus["dogs"]>([]);
  const [guardianForm, setGuardianForm] = useState<GuardianForm>(emptyGuardianForm);
  const [dogForm, setDogForm] = useState<DogForm>(emptyDogForm);
  const [isEditingDog, setIsEditingDog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingGuardian, setIsSavingGuardian] = useState(false);
  const [isSavingDog, setIsSavingDog] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const activeDog = dogs[0] ?? primaryDog ?? null;
  const birthDateMax = useMemo(() => todayDateString(), []);
  const breeds = options?.breeds ?? [];
  const socialPreferences = options?.socialPreferences ?? [];
  const personalityTags = options?.personalityTags ?? [];

  const loadDogs = useCallback(async () => {
    const payload = await api<DogsResponse>("/api/dogs");
    setDogs(payload.dogs);
    setDogForm(mapDogToForm(payload.dogs[0] ?? null));
  }, [api]);

  useEffect(() => {
    if (!status?.guardianProfile) {
      setGuardianForm(emptyGuardianForm);
      return;
    }
    setGuardianForm({
      displayName: status.guardianProfile.display_name ?? "",
      locationPermissionAgreed: Boolean(status.guardianProfile.location_permission_agreed),
      notificationPermissionAgreed: Boolean(status.guardianProfile.notification_permission_agreed),
      marketingAgreed: Boolean(status.guardianProfile.marketing_agreed)
    });
  }, [status?.guardianProfile]);

  useEffect(() => {
    if (!isRestored || !token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    Promise.all([api<MeResponse>("/api/auth/me"), loadDogs()])
      .then(([me]) => setEmail(me.user.email ?? "이메일 정보가 없어요."))
      .catch(() => setErrorMessage("마이페이지 정보를 불러오지 못했어요."))
      .finally(() => setIsLoading(false));
  }, [api, isRestored, loadDogs, token]);

  async function submitGuardian(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingGuardian(true);
    setMessage("");
    setErrorMessage("");
    try {
      await api("/api/onboarding/guardian-profile", {
        method: "PUT",
        body: JSON.stringify(guardianForm)
      });
      await refreshStatus();
      setMessage("보호자 정보를 저장했어요.");
    } catch {
      setErrorMessage("보호자 정보를 저장하지 못했어요.");
    } finally {
      setIsSavingGuardian(false);
    }
  }

  function startDogEdit() {
    setDogForm(mapDogToForm(activeDog));
    setIsEditingDog(true);
  }

  function cancelDogEdit() {
    setDogForm(mapDogToForm(activeDog));
    setIsEditingDog(false);
  }

  async function submitDog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeDog) {
      setErrorMessage("수정할 강아지 정보가 없어요.");
      return;
    }
    setIsSavingDog(true);
    setMessage("");
    setErrorMessage("");
    try {
      await api(`/api/dogs/${activeDog.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: dogForm.name,
          breed: dogForm.breed,
          birthDate: dogForm.birthDate,
          weightKg: Number(dogForm.weightKg),
          socialPreference: dogForm.socialPreference,
          personalityTags: dogForm.personalityTags
        })
      });
      await Promise.all([refreshStatus(), loadDogs()]);
      setMessage("강아지 정보를 저장했어요.");
      setIsEditingDog(false);
    } catch {
      setErrorMessage(
        "강아지 정보를 저장하지 못했어요. 생년월일은 1990-01-01부터 오늘까지, 체중은 소수점 1자리까지 입력해 주세요."
      );
    } finally {
      setIsSavingDog(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setErrorMessage("");
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // 서버 세션 정리에 실패해도 이 기기의 로그인 상태는 지운다.
    } finally {
      signOut();
      router.replace("/");
      setIsSigningOut(false);
    }
  }

  async function handleDeleteAccount() {
    if (!window.confirm("정말 탈퇴하시겠어요? 계정과 연결된 정보가 삭제돼요.")) return;
    setIsDeleting(true);
    setErrorMessage("");
    try {
      await api("/api/auth/account", { method: "DELETE" });
      signOut();
      router.replace("/");
    } catch {
      setErrorMessage("회원 탈퇴를 완료하지 못했어요.");
      setIsDeleting(false);
    }
  }

  function toggleTag(value: string) {
    setDogForm((current) => {
      if (current.personalityTags.includes(value)) {
        return { ...current, personalityTags: current.personalityTags.filter((tag) => tag !== value) };
      }
      if (current.personalityTags.length >= 3) {
        setErrorMessage("성격 키워드는 최대 3개까지 고를 수 있어요.");
        return current;
      }
      setErrorMessage("");
      return { ...current, personalityTags: [...current.personalityTags, value] };
    });
  }

  if (!isRestored || isLoading) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-ms-page px-6 text-sm font-bold text-ms-muted">
        마이페이지를 불러오는 중이에요.
      </main>
    );
  }
  if (!token) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-ms-page px-6 text-sm font-bold text-ms-muted">
        로그인이 필요해요.
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full justify-center bg-ms-page text-ms-ink">
      <div className="w-full max-w-[354px] pb-[112px]">
        <section className="px-[14px] pb-[26px] pt-[60px]">
          <div className="flex items-center justify-between">
            <h1 className="text-[35px] font-extrabold leading-none tracking-[0]">Insight</h1>
            <a
              aria-label="보호자 정보로 이동"
              className="grid h-[42px] w-[42px] place-items-center rounded-full border border-ms-line bg-ms-card text-ms-emphasis shadow-sm"
              href="#guardian-section"
            >
              <UserRound size={23} fill="currentColor" strokeWidth={1.8} />
            </a>
          </div>

          <div className="mt-[34px] flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold leading-none">내 활동 요약</h2>
            <Link className="flex items-center gap-[1px] text-[12px] font-bold text-ms-emphasis" href="/records">
              모두 보기
              <ChevronRight size={15} strokeWidth={2.4} />
            </Link>
          </div>

          {/*
            meoksa_FE는 여기서 4주치 잠금 카드 + 유료 "월간" 카드를 보여줬지만,
            백엔드에는 그런 결제/잠금 개념이 없다. 대신 실제 산책 기록이 있는
            /records로 바로 연결되는 카드 하나로 단순화했다. 시각적 언어(둥근
            모서리, 버블 장식, 카드 톤)는 FE 것을 그대로 가져왔다.
          */}
          <Link
            aria-label="산책 기록 보기"
            className="relative mt-[16px] block h-[130px] w-full overflow-hidden rounded-[24px] bg-ms-card shadow-sm"
            href="/records"
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                maskImage: "linear-gradient(125deg, transparent 12%, black 60%)",
                WebkitMaskImage: "linear-gradient(125deg, transparent 12%, black 60%)"
              }}
            >
              {BUBBLE_DOTS.map((dot) => (
                <span
                  className="absolute h-[46px] w-[46px] rounded-full bg-ms-sunken"
                  key={dot.key}
                  style={{ left: dot.left, top: dot.top }}
                />
              ))}
            </div>
            <div className="relative flex h-full flex-col justify-between p-[18px]">
              <span className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-ms-sunken text-ms-emphasis">
                <CalendarDays size={18} strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-[17px] font-extrabold leading-none">내 산책 기록 보기</p>
                <p className="mt-[7px] text-[12px] font-semibold text-ms-muted">
                  캘린더, 연속 기록, 지난 산책을 한눈에 확인해요
                </p>
              </div>
            </div>
          </Link>
        </section>

        {message ? (
          <p className="mx-[24px] rounded-[14px] bg-ms-ok-bg px-[14px] py-[10px] text-[13px] font-extrabold text-ms-ok-fg">
            {message}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="mx-[24px] mt-[8px] rounded-[14px] bg-ms-warn-bg px-[14px] py-[10px] text-[13px] font-extrabold text-ms-warn-fg">
            {errorMessage}
          </p>
        ) : null}

        <section className="px-[20px]" id="guardian-section">
          <div className="border-t border-ms-line pt-[22px]">
            <h2 className="text-[18px] font-extrabold leading-none">계정 정보</h2>
            <p className="mt-[11px] text-[14px] font-semibold leading-[1.5] text-ms-muted">
              보호자와 {activeDog?.name ?? "반려견"}의 기본 정보를 확인하고 수정할 수 있어요.
            </p>
          </div>
        </section>

        <div className="mt-[20px] space-y-[10px] px-[24px]">
          <SectionCard caption="이름, 이메일, 동의 항목 3종" defaultOpen title="보호자 정보">
            <form className="grid gap-[14px]" onSubmit={submitGuardian}>
              <label className="block">
                <span className="flex items-center gap-[8px] text-[12px] font-bold leading-none text-ms-muted">
                  <UserRound size={14} strokeWidth={2.2} />
                  이름
                </span>
                <input
                  className="mt-[7px] h-[44px] w-full rounded-[15px] border border-ms-line bg-ms-card px-[13px] text-[14px] font-extrabold text-ms-ink outline-none focus:border-ms-line-strong focus:ring-4 focus:ring-ms-line"
                  maxLength={40}
                  onChange={(event) =>
                    setGuardianForm((current) => ({ ...current, displayName: event.target.value }))
                  }
                  required
                  value={guardianForm.displayName}
                />
              </label>
              <div className="block">
                <span className="flex items-center gap-[8px] text-[12px] font-bold leading-none text-ms-muted">
                  <Mail size={14} strokeWidth={2.2} />
                  이메일
                </span>
                <p className="mt-[7px] flex h-[44px] items-center truncate rounded-[15px] bg-ms-sunken px-[13px] text-[14px] font-extrabold text-ms-ink">
                  {email}
                </p>
              </div>

              <div className="grid gap-[6px] rounded-[15px] bg-ms-sunken px-[13px]">
                <ToggleRow
                  checked={guardianForm.locationPermissionAgreed}
                  label="위치 권한 동의"
                  onChange={(checked) =>
                    setGuardianForm((current) => ({ ...current, locationPermissionAgreed: checked }))
                  }
                />
                <div className="h-px bg-ms-line" />
                <ToggleRow
                  checked={guardianForm.notificationPermissionAgreed}
                  label="알림 권한 동의"
                  onChange={(checked) =>
                    setGuardianForm((current) => ({ ...current, notificationPermissionAgreed: checked }))
                  }
                />
                <div className="h-px bg-ms-line" />
                <ToggleRow
                  checked={guardianForm.marketingAgreed}
                  label="마케팅 수신 동의"
                  onChange={(checked) => setGuardianForm((current) => ({ ...current, marketingAgreed: checked }))}
                />
              </div>

              <button
                className="flex h-[46px] w-full items-center justify-center rounded-full bg-ms-brand text-[14px] font-extrabold text-ms-on-brand transition active:bg-ms-brand-pressed disabled:opacity-55"
                disabled={isSavingGuardian}
                type="submit"
              >
                {isSavingGuardian ? "저장 중" : "보호자 정보 저장"}
              </button>
            </form>
          </SectionCard>

          <SectionCard caption="조회·수정 가능" defaultOpen title="강아지 정보">
            {!activeDog ? (
              <p className="text-[13px] font-bold text-ms-muted">등록된 강아지가 없어요.</p>
            ) : (
              <form className="contents" onSubmit={submitDog}>
                <div className="flex items-start justify-between gap-[12px]">
                  <div className="flex items-center gap-[10px]">
                    <span className="grid h-[40px] w-[40px] place-items-center rounded-[15px] bg-ms-sunken text-ms-emphasis">
                      <PawPrint size={20} fill="currentColor" strokeWidth={1.8} />
                    </span>
                    <div>
                      <p className="text-[17px] font-extrabold leading-none">{activeDog.name}</p>
                      <p className="mt-[7px] text-[12px] font-semibold text-ms-muted">
                        반려견 추가·삭제는 MVP에서 제외
                      </p>
                    </div>
                  </div>
                  {isEditingDog ? (
                    <div className="flex gap-[6px]">
                      <button
                        className="h-[34px] rounded-full bg-ms-sunken px-[11px] text-[12px] font-extrabold text-ms-secondary"
                        onClick={cancelDogEdit}
                        type="button"
                      >
                        취소
                      </button>
                      <button
                        className="h-[34px] rounded-full bg-ms-brand px-[11px] text-[12px] font-extrabold text-ms-on-brand disabled:opacity-55"
                        disabled={isSavingDog}
                        type="submit"
                      >
                        {isSavingDog ? "저장 중" : "저장"}
                      </button>
                    </div>
                  ) : (
                    <button
                      aria-label="강아지 정보 수정"
                      className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-ms-sunken text-ms-secondary"
                      onClick={startDogEdit}
                      type="button"
                    >
                      <PenLine size={15} strokeWidth={2.2} />
                    </button>
                  )}
                </div>

                <div className="mt-[16px] grid gap-[9px]">
                  <label className="block">
                    <span className="text-[12px] font-bold leading-none text-ms-muted">이름</span>
                    {isEditingDog ? (
                      <input
                        className="mt-[7px] h-[44px] w-full rounded-[15px] border border-ms-line bg-ms-card px-[13px] text-[14px] font-extrabold text-ms-ink outline-none focus:border-ms-line-strong focus:ring-4 focus:ring-ms-line"
                        maxLength={40}
                        onChange={(event) => setDogForm((current) => ({ ...current, name: event.target.value }))}
                        required
                        value={dogForm.name}
                      />
                    ) : (
                      <span className="mt-[7px] flex min-h-[44px] items-center rounded-[15px] bg-ms-sunken px-[13px] text-[14px] font-extrabold text-ms-ink">
                        {dogForm.name || "미입력"}
                      </span>
                    )}
                  </label>

                  <label className="block">
                    <span className="text-[12px] font-bold leading-none text-ms-muted">견종</span>
                    {isEditingDog ? (
                      <select
                        className="mt-[7px] h-[44px] w-full rounded-[15px] border border-ms-line bg-ms-card px-[13px] text-[14px] font-extrabold text-ms-ink outline-none focus:border-ms-line-strong focus:ring-4 focus:ring-ms-line"
                        onChange={(event) => setDogForm((current) => ({ ...current, breed: event.target.value }))}
                        required
                        value={dogForm.breed}
                      >
                        <option value="">견종을 선택해 주세요</option>
                        {breeds.map((breed: BreedOption) => (
                          <option key={breed.id} value={breed.id}>
                            {breed.nameKo}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="mt-[7px] flex min-h-[44px] items-center rounded-[15px] bg-ms-sunken px-[13px] text-[14px] font-extrabold text-ms-ink">
                        {breeds.find((breed) => breed.id === dogForm.breed)?.nameKo ?? dogForm.breed ?? "미입력"}
                      </span>
                    )}
                  </label>

                  <label className="block">
                    <span className="text-[12px] font-bold leading-none text-ms-muted">생년월일</span>
                    {isEditingDog ? (
                      <input
                        className="mt-[7px] h-[44px] w-full rounded-[15px] border border-ms-line bg-ms-card px-[13px] text-[14px] font-extrabold text-ms-ink outline-none focus:border-ms-line-strong focus:ring-4 focus:ring-ms-line"
                        max={birthDateMax}
                        min="1990-01-01"
                        onChange={(event) =>
                          setDogForm((current) => ({ ...current, birthDate: event.target.value }))
                        }
                        required
                        type="date"
                        value={dogForm.birthDate}
                      />
                    ) : (
                      <span className="mt-[7px] flex min-h-[44px] items-center rounded-[15px] bg-ms-sunken px-[13px] text-[14px] font-extrabold text-ms-ink">
                        {dogForm.birthDate || "미입력"}
                      </span>
                    )}
                  </label>

                  <label className="block">
                    <span className="text-[12px] font-bold leading-none text-ms-muted">체중</span>
                    {isEditingDog ? (
                      <input
                        className="mt-[7px] h-[44px] w-full rounded-[15px] border border-ms-line bg-ms-card px-[13px] text-[14px] font-extrabold text-ms-ink outline-none focus:border-ms-line-strong focus:ring-4 focus:ring-ms-line"
                        inputMode="decimal"
                        max="100"
                        min="0.1"
                        onChange={(event) =>
                          setDogForm((current) => ({ ...current, weightKg: event.target.value }))
                        }
                        required
                        step="0.1"
                        type="number"
                        value={dogForm.weightKg}
                      />
                    ) : (
                      <span className="mt-[7px] flex min-h-[44px] items-center rounded-[15px] bg-ms-sunken px-[13px] text-[14px] font-extrabold text-ms-ink">
                        {dogForm.weightKg ? `${dogForm.weightKg}kg` : "미입력"}
                      </span>
                    )}
                  </label>

                  <div className="block">
                    <span className="text-[12px] font-bold leading-none text-ms-muted">
                      다른 강아지를 만나면 어떤가요?
                    </span>
                    {isEditingDog ? (
                      <div className="mt-[7px] grid grid-cols-3 gap-[8px]">
                        {socialPreferences.map((option) => {
                          const active = dogForm.socialPreference === option.value;
                          return (
                            <button
                              className={`flex h-[40px] items-center justify-center rounded-[13px] text-[12px] font-extrabold transition ${
                                active ? "bg-ms-brand text-ms-on-brand" : "bg-ms-sunken text-ms-secondary"
                              }`}
                              key={option.value}
                              onClick={() =>
                                setDogForm((current) => ({ ...current, socialPreference: option.value }))
                              }
                              type="button"
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="mt-[7px] flex min-h-[44px] items-center rounded-[15px] bg-ms-sunken px-[13px] text-[14px] font-extrabold text-ms-ink">
                        {formatOption(dogForm.socialPreference, socialPreferences)}
                      </span>
                    )}
                  </div>

                  <div className="block">
                    <span className="text-[12px] font-bold leading-none text-ms-muted">
                      산책 성격 키워드 (최대 3개)
                    </span>
                    {isEditingDog ? (
                      <div className="mt-[7px] flex flex-wrap gap-[8px]">
                        {personalityTags.map((option) => {
                          const active = dogForm.personalityTags.includes(option.value);
                          return (
                            <button
                              className={`flex h-[34px] items-center rounded-full px-[12px] text-[12px] font-extrabold transition ${
                                active ? "bg-ms-brand text-ms-on-brand" : "bg-ms-sunken text-ms-secondary"
                              }`}
                              key={option.value}
                              onClick={() => toggleTag(option.value)}
                              type="button"
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="mt-[7px] flex min-h-[44px] items-center rounded-[15px] bg-ms-sunken px-[13px] text-[14px] font-extrabold text-ms-ink">
                        {formatTags(dogForm.personalityTags, personalityTags)}
                      </span>
                    )}
                  </div>
                </div>
              </form>
            )}
          </SectionCard>

          <SectionCard caption="로그아웃 및 회원 탈퇴" defaultOpen={false} title="계정">
            <div className="grid gap-[8px]">
              <button
                className="flex h-[48px] items-center justify-between rounded-[16px] bg-ms-sunken px-[14px] text-[14px] font-extrabold text-ms-ink disabled:opacity-55"
                disabled={isSigningOut}
                onClick={handleSignOut}
                type="button"
              >
                <span className="flex items-center gap-[8px]">
                  <LogOut size={17} strokeWidth={2.2} />
                  {isSigningOut ? "로그아웃 중" : "로그아웃"}
                </span>
                <span className="text-[12px] font-bold text-ms-muted">현재 기기에서 나가기</span>
              </button>
              <button
                className="flex h-[48px] items-center justify-between rounded-[16px] border border-ms-line bg-ms-card px-[14px] text-[14px] font-extrabold text-ms-emphasis disabled:opacity-55"
                disabled={isDeleting}
                onClick={handleDeleteAccount}
                type="button"
              >
                <span className="flex items-center gap-[8px]">
                  <Trash2 size={17} strokeWidth={2.2} />
                  {isDeleting ? "탈퇴 중" : "회원 탈퇴"}
                </span>
                <span className="text-[12px] font-bold text-ms-muted">계정 삭제</span>
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
