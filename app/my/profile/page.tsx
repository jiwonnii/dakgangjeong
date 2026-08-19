"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useAuth } from "../../auth-context";
import type { BreedOption, OnboardingStatus, OptionItem } from "../../lib/types";
import { ToggleRow } from "../../_components/ToggleRow";

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

/**
 * "라벨 + 값 + >" 한 줄 행. 참고 디자인(Mego "My Profile")의 리스트 행 비율을 따랐다:
 * 56px 높이, 20px 좌우 패딩, 아래쪽 얇은 구분선. 값 자리에는 실제 입력 컨트롤이 들어가서
 * 탭하면 바로 그 자리에서 고칠 수 있다 — 별도 화면으로 이동하지 않는다.
 */
function ProfileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-[12px] border-b border-ms-line px-[20px] last:border-b-0">
      <span className="shrink-0 text-[14px] font-bold text-ms-ink">{label}</span>
      <div className="flex flex-1 items-center justify-end">{children}</div>
    </div>
  );
}

const rowValueClassName = "w-full truncate text-right text-[14px] font-semibold text-ms-secondary outline-none";

export default function MyProfilePage() {
  const { api, options, primaryDog, refreshStatus, status, token } = useAuth();
  const [email, setEmail] = useState("");
  const [dogs, setDogs] = useState<OnboardingStatus["dogs"]>([]);
  const [guardianForm, setGuardianForm] = useState<GuardianForm>(emptyGuardianForm);
  const [dogForm, setDogForm] = useState<DogForm>(emptyDogForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
    if (!token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    Promise.all([api<MeResponse>("/api/auth/me"), loadDogs()])
      .then(([me]) => setEmail(me.user.email ?? "이메일 정보가 없어요."))
      .catch(() => setErrorMessage("정보를 불러오지 못했어요."))
      .finally(() => setIsLoading(false));
  }, [api, loadDogs, token]);

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

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await api("/api/onboarding/guardian-profile", {
        method: "PUT",
        body: JSON.stringify(guardianForm)
      });

      if (activeDog) {
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
      }

      await Promise.all([refreshStatus(), loadDogs()]);
      setMessage("저장했어요.");
    } catch {
      setErrorMessage(
        "저장하지 못했어요. 생년월일은 1990-01-01부터 오늘까지, 체중은 소수점 1자리까지 입력해 주세요."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-ms-page px-6 text-sm font-bold text-ms-muted">
        불러오는 중이에요.
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full justify-center bg-ms-page text-ms-ink">
      <form className="w-full max-w-[375px] pb-[104px]" onSubmit={handleSave}>
        <header className="flex h-[56px] items-center justify-between px-[20px]">
          <Link
            aria-label="마이페이지로 돌아가기"
            className="grid h-[34px] w-[34px] place-items-center rounded-full text-ms-ink"
            href="/my"
          >
            <ChevronLeft size={22} strokeWidth={2.2} />
          </Link>
          <h1 className="text-[16px] font-extrabold leading-none">보호자 · 강아지 정보</h1>
          <button
            className="flex h-[32px] items-center justify-center rounded-full bg-ms-brand px-[16px] text-[13px] font-extrabold text-ms-on-brand disabled:opacity-55"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "저장 중" : "저장"}
          </button>
        </header>

        {message ? (
          <p className="mx-[20px] mt-[10px] rounded-[14px] bg-ms-ok-bg px-[14px] py-[10px] text-[13px] font-extrabold text-ms-ok-fg">
            {message}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="mx-[20px] mt-[10px] rounded-[14px] bg-ms-warn-bg px-[14px] py-[10px] text-[13px] font-extrabold text-ms-warn-fg">
            {errorMessage}
          </p>
        ) : null}

        <p className="px-[20px] pb-[8px] pt-[20px] text-[12px] font-bold text-ms-muted">보호자</p>
        <div className="mx-[20px] overflow-hidden rounded-[18px] border border-ms-line bg-ms-card">
          <ProfileRow label="이름">
            <input
              className={rowValueClassName}
              maxLength={40}
              onChange={(event) => setGuardianForm((current) => ({ ...current, displayName: event.target.value }))}
              required
              value={guardianForm.displayName}
            />
          </ProfileRow>
          <ProfileRow label="이메일">
            <span className="truncate text-[14px] font-semibold text-ms-muted">{email}</span>
          </ProfileRow>
          <ProfileRow label="위치 권한 동의">
            <ToggleRow
              checked={guardianForm.locationPermissionAgreed}
              label=""
              onChange={(checked) => setGuardianForm((current) => ({ ...current, locationPermissionAgreed: checked }))}
            />
          </ProfileRow>
          <ProfileRow label="알림 권한 동의">
            <ToggleRow
              checked={guardianForm.notificationPermissionAgreed}
              label=""
              onChange={(checked) =>
                setGuardianForm((current) => ({ ...current, notificationPermissionAgreed: checked }))
              }
            />
          </ProfileRow>
          <ProfileRow label="마케팅 수신 동의">
            <ToggleRow
              checked={guardianForm.marketingAgreed}
              label=""
              onChange={(checked) => setGuardianForm((current) => ({ ...current, marketingAgreed: checked }))}
            />
          </ProfileRow>
        </div>

        {!activeDog ? (
          <p className="mx-[20px] mt-[20px] rounded-[18px] border border-ms-line bg-ms-card px-[16px] py-[16px] text-[13px] font-bold text-ms-muted">
            등록된 강아지가 없어요.
          </p>
        ) : (
          <>
            <p className="px-[20px] pb-[8px] pt-[20px] text-[12px] font-bold text-ms-muted">{activeDog.name}</p>
            <div className="mx-[20px] overflow-hidden rounded-[18px] border border-ms-line bg-ms-card">
              <ProfileRow label="이름">
                <input
                  className={rowValueClassName}
                  maxLength={40}
                  onChange={(event) => setDogForm((current) => ({ ...current, name: event.target.value }))}
                  required
                  value={dogForm.name}
                />
              </ProfileRow>
              <ProfileRow label="견종">
                <select
                  className={rowValueClassName}
                  onChange={(event) => setDogForm((current) => ({ ...current, breed: event.target.value }))}
                  required
                  value={dogForm.breed}
                >
                  <option value="">선택해 주세요</option>
                  {breeds.map((breed: BreedOption) => (
                    <option key={breed.id} value={breed.id}>
                      {breed.nameKo}
                    </option>
                  ))}
                </select>
              </ProfileRow>
              <ProfileRow label="생년월일">
                <input
                  className={rowValueClassName}
                  max={birthDateMax}
                  min="1990-01-01"
                  onChange={(event) => setDogForm((current) => ({ ...current, birthDate: event.target.value }))}
                  required
                  type="date"
                  value={dogForm.birthDate}
                />
              </ProfileRow>
              <ProfileRow label="체중(kg)">
                <input
                  className={rowValueClassName}
                  inputMode="decimal"
                  max="100"
                  min="0.1"
                  onChange={(event) => setDogForm((current) => ({ ...current, weightKg: event.target.value }))}
                  required
                  step="0.1"
                  type="number"
                  value={dogForm.weightKg}
                />
              </ProfileRow>
              <ProfileRow label="다른 강아지를 만나면">
                <select
                  className={rowValueClassName}
                  onChange={(event) => setDogForm((current) => ({ ...current, socialPreference: event.target.value }))}
                  value={dogForm.socialPreference}
                >
                  {socialPreferences.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </ProfileRow>
            </div>

            <p className="px-[20px] pb-[8px] pt-[20px] text-[12px] font-bold text-ms-muted">
              산책 성격 키워드 (최대 3개)
            </p>
            <div className="mx-[20px] flex flex-wrap gap-[8px] rounded-[18px] border border-ms-line bg-ms-card px-[16px] py-[16px]">
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
            <p className="px-[20px] pt-[8px] text-[11px] font-semibold leading-[1.5] text-ms-muted">
              {formatOption(dogForm.socialPreference, socialPreferences)} · 반려견 추가·삭제는 MVP에서 제외
            </p>
          </>
        )}
      </form>
    </main>
  );
}
