"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import type { BreedOption, OnboardingStatus, OptionItem } from "../lib/types";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "../ui";

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

export default function MyTabPage() {
  const router = useRouter();
  const { api, isRestored, options, primaryDog, refreshStatus, signOut, status, token } = useAuth();
  const [email, setEmail] = useState("");
  const [dogs, setDogs] = useState<OnboardingStatus["dogs"]>([]);
  const [guardianForm, setGuardianForm] = useState<GuardianForm>(emptyGuardianForm);
  const [dogForm, setDogForm] = useState<DogForm>(emptyDogForm);
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
    return <div className="p-4 text-sm font-bold text-muted-foreground">마이페이지를 불러오는 중이에요.</div>;
  }
  if (!token) {
    return <div className="p-4 text-sm font-bold text-muted-foreground">로그인이 필요해요.</div>;
  }

  return (
    <main className="grid gap-4 p-4 pb-24">
      <header className="grid gap-1">
        <h1 className="text-2xl font-black">마이페이지</h1>
        <p className="text-sm font-semibold text-muted-foreground">내 정보와 함께 지내는 강아지 정보를 관리해요.</p>
      </header>
      {message ? <p className="rounded-md bg-primary/10 p-3 text-sm font-extrabold text-primary">{message}</p> : null}
      {errorMessage ? <p className="rounded-md bg-destructive/10 p-3 text-sm font-extrabold text-destructive">{errorMessage}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>보호자 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={submitGuardian}>
            <label className="grid gap-1 text-sm font-extrabold">
              이름
              <Input
                value={guardianForm.displayName}
                onChange={(event) => setGuardianForm((current) => ({ ...current, displayName: event.target.value }))}
                required
                maxLength={40}
              />
            </label>
            <div className="grid gap-1 text-sm font-extrabold">
              이메일
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm font-bold">{email}</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                checked={guardianForm.locationPermissionAgreed}
                onChange={(event) => setGuardianForm((current) => ({ ...current, locationPermissionAgreed: event.target.checked }))}
                type="checkbox"
              />
              위치 권한 동의
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                checked={guardianForm.notificationPermissionAgreed}
                onChange={(event) => setGuardianForm((current) => ({ ...current, notificationPermissionAgreed: event.target.checked }))}
                type="checkbox"
              />
              알림 권한 동의
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                checked={guardianForm.marketingAgreed}
                onChange={(event) => setGuardianForm((current) => ({ ...current, marketingAgreed: event.target.checked }))}
                type="checkbox"
              />
              마케팅 수신 동의
            </label>
            <Button disabled={isSavingGuardian} type="submit">
              {isSavingGuardian ? "저장 중" : "보호자 정보 저장"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>강아지 정보</CardTitle>
        </CardHeader>
        <CardContent>
          {!activeDog ? (
            <p className="text-sm font-bold text-muted-foreground">등록된 강아지가 없어요.</p>
          ) : (
            <form className="grid gap-3" onSubmit={submitDog}>
              <p className="rounded-md bg-muted p-3 text-sm font-bold">
                산책 성격: {formatOption(activeDog.social_preference, socialPreferences)} / {formatTags(activeDog.personality_tags, personalityTags)}
              </p>
              <label className="grid gap-1 text-sm font-extrabold">
                이름
                <Input
                  value={dogForm.name}
                  onChange={(event) => setDogForm((current) => ({ ...current, name: event.target.value }))}
                  required
                  maxLength={40}
                />
              </label>
              <label className="grid gap-1 text-sm font-extrabold">
                견종
                <select
                  className="h-11 w-full rounded-md border border-border bg-white px-3 text-sm font-semibold outline-none"
                  value={dogForm.breed}
                  onChange={(event) => setDogForm((current) => ({ ...current, breed: event.target.value }))}
                  required
                >
                  <option value="">견종을 선택해 주세요</option>
                  {breeds.map((breed: BreedOption) => (
                    <option key={breed.id} value={breed.id}>
                      {breed.nameKo}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-extrabold">
                생년월일
                <Input
                  value={dogForm.birthDate}
                  onChange={(event) => setDogForm((current) => ({ ...current, birthDate: event.target.value }))}
                  type="date"
                  min="1990-01-01"
                  max={birthDateMax}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-extrabold">
                체중(kg)
                <Input
                  value={dogForm.weightKg}
                  onChange={(event) => setDogForm((current) => ({ ...current, weightKg: event.target.value }))}
                  inputMode="decimal"
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  required
                />
              </label>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-extrabold">Q1. 다른 강아지를 만나면 어떤가요?</legend>
                <div className="grid grid-cols-3 gap-2">
                  {socialPreferences.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={dogForm.socialPreference === option.value ? "default" : "outline"}
                      onClick={() => setDogForm((current) => ({ ...current, socialPreference: option.value }))}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-extrabold">성격 키워드</legend>
                <div className="grid gap-2">
                  {personalityTags.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm font-bold">
                      <input
                        checked={dogForm.personalityTags.includes(option.value)}
                        onChange={() => toggleTag(option.value)}
                        type="checkbox"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button disabled={isSavingDog} type="submit">
                {isSavingDog ? "저장 중" : "강아지 정보 저장"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>계정</CardTitle>
        </CardHeader>
        <CardContent>
          <Button disabled={isSigningOut} variant="outline" onClick={handleSignOut}>
            {isSigningOut ? "로그아웃 중" : "로그아웃"}
          </Button>
          <Button disabled={isDeleting} variant="destructive" onClick={handleDeleteAccount}>
            {isDeleting ? "탈퇴 중" : "회원 탈퇴"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
