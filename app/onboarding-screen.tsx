"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, ChevronDown, Dog, Info, ListChecks, MapPin, Megaphone, UserRound, Users } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "./auth-context";
import {
  buildTimes,
  CARE_LABELS,
  CARE_TITLES,
  defaultDrafts,
  nextKstDateKey,
  SHARING_CARE_KINDS,
  type RoutineDraft,
  type SharingCareKind
} from "./sharing/care-utils";

const guardianSchema = z.object({
  displayName: z.string().trim().min(1, "보호자 이름을 입력해 주세요."),
  locationPermissionAgreed: z.boolean().refine((value) => value, "위치 권한에 동의해 주세요."),
  notificationPermissionAgreed: z.boolean().refine((value) => value, "알림 권한에 동의해 주세요."),
  marketingAgreed: z.boolean()
});

const dogSchema = z.object({
  name: z.string().trim().min(1, "강아지 이름을 입력해 주세요."),
  breed: z.string().trim().min(1),
  birthDate: z.string().trim().min(1),
  weightKg: z.number().positive().max(120),
  socialPreference: z.enum(["likes_dogs", "avoids_dogs", "neutral"]),
  personalityTags: z.array(z.string()).max(3)
});

type Drafts = Record<SharingCareKind, RoutineDraft>;
type OnboardingFlowStep = "invite" | "dog" | "care";
const CARE_COUNT_OPTIONS = [0, 1, 2, 3];
const UNCHECKED = false;
const CONSENT_FIELDS = [
  { name: "locationPermissionAgreed", label: "위치 권한에 동의해요", required: true, icon: MapPin },
  { name: "notificationPermissionAgreed", label: "알림 권한에 동의해요", required: true, icon: Bell },
  { name: "marketingAgreed", label: "마케팅 수신에 동의해요", required: false, icon: Megaphone }
] as const;

/**
 * 강아지를 아직 등록하지 않은 계정이 보는 화면.
 * 어느 탭에 있든 이 화면이 탭 내용을 대신한다 (탭 바 자체는 보인다).
 */
export function OnboardingScreen() {
  const { api, options, refreshStatus, status } = useAuth();
  const [flowStep, setFlowStep] = useState<OnboardingFlowStep>("invite");
  const [inviteCode, setInviteCode] = useState("");
  const [createdDogId, setCreatedDogId] = useState("");
  const [drafts, setDrafts] = useState<Drafts>(() => defaultDrafts());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const guardianForm = useForm<z.infer<typeof guardianSchema>>({
    resolver: zodResolver(guardianSchema),
    defaultValues: {
      displayName: "",
      locationPermissionAgreed: UNCHECKED,
      notificationPermissionAgreed: UNCHECKED,
      marketingAgreed: UNCHECKED
    }
  });
  const dogForm = useForm<z.infer<typeof dogSchema>>({
    resolver: zodResolver(dogSchema),
    defaultValues: {
      name: "",
      breed: "maltese",
      birthDate: "2020-01-01",
      weightKg: 5,
      socialPreference: "neutral",
      personalityTags: []
    }
  });

  const selectedPersonalityTags = dogForm.watch("personalityTags") ?? [];
  const selectedSocialPreference = dogForm.watch("socialPreference");
  const guardianErrors = guardianForm.formState.errors;
  const guardianErrorMessage =
    guardianErrors.displayName?.message ||
    guardianErrors.locationPermissionAgreed?.message ||
    guardianErrors.notificationPermissionAgreed?.message;

  function updateCareCount(kind: SharingCareKind, count: number) {
    setDrafts((current) => ({
      ...current,
      [kind]: {
        count,
        times: buildTimes(kind, count, current[kind].times)
      }
    }));
  }

  function togglePersonalityTag(value: string) {
    const current = dogForm.getValues("personalityTags") ?? [];

    if (current.includes(value)) {
      dogForm.setValue(
        "personalityTags",
        current.filter((tag) => tag !== value),
        { shouldDirty: true, shouldValidate: true }
      );
      return;
    }

    if (current.length >= 3) {
      return;
    }

    dogForm.setValue("personalityTags", [...current, value], { shouldDirty: true, shouldValidate: true });
  }

  async function submitGuardian(values: z.infer<typeof guardianSchema>) {
    setIsBusy(true);
    setError("");
    setMessage("");

    try {
      await api("/api/onboarding/guardian-profile", {
        method: "PUT",
        body: JSON.stringify({
          displayName: values.displayName,
          locationPermissionAgreed: values.locationPermissionAgreed,
          notificationPermissionAgreed: values.notificationPermissionAgreed,
          marketingAgreed: values.marketingAgreed
        })
      });
      await refreshStatus();
      setMessage("프로필을 저장했어요.");
    } catch (err) {
      setError("프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsBusy(false);
    }
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const trimmedCode = inviteCode.trim();

    if (!trimmedCode) {
      setFlowStep("dog");
      setMessage("초대 코드 없이 새 강아지를 등록할게요.");
      return;
    }

    setIsBusy(true);

    try {
      await api("/api/onboarding/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode: trimmedCode })
      });
      await refreshStatus();
      setMessage("가족의 강아지에 합류했어요.");
    } catch (err) {
      setError("초대 코드를 찾을 수 없어요. 코드를 확인해 주세요.");
    } finally {
      setIsBusy(false);
    }
  }

  async function submitDog(values: z.infer<typeof dogSchema>) {
    setIsBusy(true);
    setError("");
    setMessage("");

    try {
      const payload = await api<{ dog: { id: string } }>("/api/onboarding/dogs", {
        method: "POST",
        body: JSON.stringify(values)
      });
      setCreatedDogId(payload.dog.id);
      setFlowStep("care");
      setMessage("강아지를 등록했어요. 하루 케어 횟수를 정해 주세요.");
    } catch (err) {
      setError("강아지를 등록하지 못했어요. 입력한 내용을 확인해 주세요.");
    } finally {
      setIsBusy(false);
    }
  }

  async function submitCareRoutines() {
    if (!createdDogId) {
      setError("강아지 등록을 먼저 완료해 주세요.");
      return;
    }

    const startDate = nextKstDateKey(0);
    setIsBusy(true);
    setError("");
    setMessage("");

    try {
      for (const kind of SHARING_CARE_KINDS) {
        const draft = drafts[kind];
        const enabled = draft.count > 0;

        await api("/api/care/routines", {
          method: "POST",
          body: JSON.stringify({
            dogId: createdDogId,
            taskType: kind,
            title: CARE_TITLES[kind],
            frequency: "daily",
            intervalCount: 1,
            daysOfWeek: [],
            daysOfMonth: [],
            timesOfDay: enabled ? draft.times.slice(0, draft.count) : ["09:00"],
            startDate,
            timezone: "Asia/Seoul",
            reminderMinutesBefore: [],
            isActive: enabled
          })
        });
      }

      await refreshStatus();
      setMessage("온보딩을 완료했어요. 오늘 체크리스트에 바로 반영돼요.");
    } catch (err) {
      setError("케어 루틴을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full justify-center bg-ms-page text-ms-ink">
      <div className="relative min-h-screen w-full max-w-[375px] bg-ms-page px-6 pb-24 pt-5">
        <header className="flex h-12 items-center gap-3">
          <img alt="산책가개" className="h-10 w-10 rounded-[12px] object-cover shadow-sm" src="/logo.png" />
          <div>
            <p className="text-[12px] font-semibold leading-none text-ms-muted">시작하기 전에</p>
            <h1 className="mt-1 text-[18px] font-extrabold leading-none text-ms-ink">프로필 설정</h1>
          </div>
        </header>

        <div className="mt-5 rounded-[18px] bg-ms-sunken px-4 py-3.5 text-[13px] font-bold leading-[1.5] text-ms-emphasis">
          강아지를 먼저 등록해주세요. 등록하면 산책 추천과 기록을 쓸 수 있어요.
        </div>

        {status?.nextStep === "guardian-profile" && (
          <section className="mt-8">
            <p className="text-[15px] font-bold leading-none text-ms-emphasis">보호자 정보</p>
            <h2 className="mt-3 text-[26px] font-extrabold leading-[1.22] text-ms-ink">
              보호자 프로필을
              <br />
              등록해주세요.
            </h2>
            <p className="mt-3 text-[15px] font-medium leading-[1.55] text-ms-secondary">
              산책 기록과 셰어링 체크리스트에 표시될 기본 정보만 받아요.
            </p>

            <form className="mt-7 space-y-4" onSubmit={guardianForm.handleSubmit(submitGuardian)}>
              <label className="block">
                <span className="text-[14px] font-bold leading-none text-ms-secondary">이름</span>
                <span className="mt-2 flex h-14 items-center gap-3 rounded-[18px] border border-ms-line bg-ms-card px-4 focus-within:border-ms-line-strong focus-within:ring-4 focus-within:ring-[rgba(250,125,56,0.14)]">
                  <UserRound className="shrink-0 text-ms-muted" size={19} strokeWidth={2.1} />
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent text-[17px] font-extrabold text-ms-ink outline-none placeholder:text-ms-muted"
                    placeholder="보호자 이름"
                    {...guardianForm.register("displayName")}
                  />
                </span>
              </label>

              <div className="space-y-2.5">
                {CONSENT_FIELDS.map((field) => {
                  const Icon = field.icon;
                  return (
                    <label
                      className="flex items-start gap-3 rounded-[18px] border border-ms-line bg-ms-card px-4 py-3.5"
                      key={field.name}
                    >
                      <Icon className="mt-0.5 shrink-0 text-ms-muted" size={18} strokeWidth={2.1} />
                      <span className="flex-1 text-[14px] font-bold leading-[1.45] text-ms-ink">
                        {field.label}{" "}
                        <span className={field.required ? "font-extrabold text-ms-warn-fg" : "font-medium text-ms-muted"}>
                          {field.required ? "(필수)" : "(선택)"}
                        </span>
                      </span>
                      <input
                        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]"
                        type="checkbox"
                        {...guardianForm.register(field.name)}
                      />
                    </label>
                  );
                })}
              </div>

              {guardianErrorMessage && (
                <p className="rounded-[16px] bg-ms-warn-bg px-4 py-3 text-[13px] font-bold text-ms-warn-fg">
                  {guardianErrorMessage}
                </p>
              )}

              <button
                className="flex h-14 w-full items-center justify-center rounded-full bg-ms-brand text-[17px] font-extrabold text-ms-on-brand transition active:scale-[0.99] active:bg-ms-brand-pressed disabled:opacity-60"
                disabled={isBusy}
                type="submit"
              >
                저장
              </button>
            </form>
          </section>
        )}

        {status?.nextStep === "dog-or-invite" && flowStep === "invite" && (
          <section className="mt-8">
            <p className="text-[15px] font-bold leading-none text-ms-emphasis">가족과 함께</p>
            <h2 className="mt-3 text-[26px] font-extrabold leading-[1.22] text-ms-ink">
              초대 코드가
              <br />
              있나요?
            </h2>
            <p className="mt-3 text-[15px] font-medium leading-[1.55] text-ms-secondary">
              초대 코드가 있으면 가족의 강아지에 바로 합류하고, 없으면 새 강아지를 등록해요.
            </p>

            <form className="mt-7 space-y-4" onSubmit={submitInvite}>
              <label className="block">
                <span className="text-[14px] font-bold leading-none text-ms-secondary">초대 코드</span>
                <span className="mt-2 flex h-14 items-center gap-3 rounded-[18px] border border-ms-line bg-ms-card px-4 focus-within:border-ms-line-strong focus-within:ring-4 focus-within:ring-[rgba(250,125,56,0.14)]">
                  <Users className="shrink-0 text-ms-muted" size={19} strokeWidth={2.1} />
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent text-[17px] font-extrabold text-ms-ink outline-none placeholder:text-ms-muted"
                    onChange={(event) => setInviteCode(event.target.value)}
                    placeholder="가족에게 받은 초대 코드"
                    value={inviteCode}
                  />
                </span>
              </label>

              <div className="space-y-2.5">
                <button
                  className="flex h-14 w-full items-center justify-center rounded-full bg-ms-brand text-[17px] font-extrabold text-ms-on-brand transition active:scale-[0.99] active:bg-ms-brand-pressed disabled:opacity-60"
                  disabled={isBusy}
                  type="submit"
                >
                  {inviteCode.trim() ? "초대 코드로 합류" : "초대 코드 없이 진행"}
                </button>
                {inviteCode.trim() && (
                  <button
                    className="flex h-14 w-full items-center justify-center rounded-full border border-ms-line bg-ms-card text-[16px] font-extrabold text-ms-ink transition active:bg-ms-sunken disabled:opacity-60"
                    disabled={isBusy}
                    onClick={() => setFlowStep("dog")}
                    type="button"
                  >
                    새 강아지 등록
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        {status?.nextStep === "dog-or-invite" && flowStep === "dog" && (
          <section className="mt-8">
            <p className="text-[15px] font-bold leading-none text-ms-emphasis">반려견 등록</p>
            <h2 className="mt-3 text-[26px] font-extrabold leading-[1.22] text-ms-ink">
              반려견 프로필을
              <br />
              등록해주세요.
            </h2>
            <p className="mt-3 text-[15px] font-medium leading-[1.55] text-ms-secondary">
              산책 성격과 기본 정보를 먼저 저장해두면 이후 추천을 더 차분하게 맞출 수 있어요.
            </p>

            {!options && (
              <div className="mt-5 rounded-[18px] bg-ms-sunken px-4 py-3 text-[13px] font-bold text-ms-emphasis">
                선택지를 불러오는 중이에요.
              </div>
            )}

            <form className="mt-7 space-y-4" onSubmit={dogForm.handleSubmit(submitDog)}>
              <label className="block">
                <span className="text-[14px] font-bold leading-none text-ms-secondary">반려견 이름</span>
                <span className="mt-2 flex h-14 items-center gap-3 rounded-[18px] border border-ms-line bg-ms-card px-4 focus-within:border-ms-line-strong focus-within:ring-4 focus-within:ring-[rgba(250,125,56,0.14)]">
                  <Dog className="shrink-0 text-ms-muted" size={19} strokeWidth={2.1} />
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent text-[17px] font-extrabold text-ms-ink outline-none placeholder:text-ms-muted"
                    placeholder="이름"
                    {...dogForm.register("name")}
                  />
                </span>
              </label>

              <label className="block">
                <span className="text-[14px] font-bold leading-none text-ms-secondary">견종</span>
                <span className="relative mt-2 flex h-14 items-center rounded-[18px] border border-ms-line bg-ms-card px-4 focus-within:border-ms-line-strong focus-within:ring-4 focus-within:ring-[rgba(250,125,56,0.14)]">
                  <select
                    className="h-full min-w-0 flex-1 appearance-none bg-transparent pr-8 text-[17px] font-extrabold text-ms-ink outline-none disabled:text-ms-muted"
                    disabled={!options}
                    {...dogForm.register("breed")}
                  >
                    {(options?.breeds ?? []).map((breed) => (
                      <option key={breed.id} value={breed.id}>
                        {breed.nameKo} ({breed.nameEn})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 text-ms-muted" size={18} strokeWidth={2} />
                </span>
              </label>

              <label className="block">
                <span className="text-[14px] font-bold leading-none text-ms-secondary">생년월일</span>
                <span className="mt-2 flex h-14 items-center rounded-[18px] border border-ms-line bg-ms-card px-4 focus-within:border-ms-line-strong focus-within:ring-4 focus-within:ring-[rgba(250,125,56,0.14)]">
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent text-[17px] font-extrabold text-ms-ink outline-none"
                    type="date"
                    {...dogForm.register("birthDate")}
                  />
                </span>
              </label>

              <label className="block">
                <span className="text-[14px] font-bold leading-none text-ms-secondary">체중</span>
                <span className="mt-2 flex h-14 items-center rounded-[18px] border border-ms-line bg-ms-card px-4 focus-within:border-ms-line-strong focus-within:ring-4 focus-within:ring-[rgba(250,125,56,0.14)]">
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent text-[17px] font-extrabold text-ms-ink outline-none"
                    inputMode="decimal"
                    placeholder="0.0"
                    step="0.1"
                    type="number"
                    {...dogForm.register("weightKg", { valueAsNumber: true })}
                  />
                  <span className="ml-2 text-[15px] font-bold text-ms-muted">kg</span>
                </span>
              </label>

              <div className="pt-2">
                <h3 className="text-[17px] font-extrabold leading-[1.3] text-ms-ink">
                  다른 강아지를 만나면 어떤가요?
                </h3>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(options?.socialPreferences ?? []).map((option) => {
                    const selected = selectedSocialPreference === option.value;
                    return (
                      <button
                        aria-pressed={selected}
                        className={`h-12 rounded-full border text-[14px] font-extrabold transition ${
                          selected
                            ? "border-ms-brand bg-ms-brand text-ms-on-brand"
                            : "border-ms-line bg-ms-card text-ms-secondary"
                        }`}
                        key={option.value}
                        onClick={() =>
                          dogForm.setValue(
                            "socialPreference",
                            option.value as "likes_dogs" | "avoids_dogs" | "neutral",
                            { shouldDirty: true, shouldValidate: true }
                          )
                        }
                        type="button"
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-end justify-between gap-4">
                  <h3 className="text-[17px] font-extrabold leading-none text-ms-ink">산책 성격 키워드</h3>
                  <span className="rounded-full bg-ms-sunken px-3 py-1.5 text-[13px] font-extrabold text-ms-emphasis">
                    {selectedPersonalityTags.length} / 3
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(options?.personalityTags ?? []).map((option) => {
                    const selected = selectedPersonalityTags.includes(option.value);
                    const disabled = !selected && selectedPersonalityTags.length >= 3;
                    return (
                      <button
                        aria-pressed={selected}
                        className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[14px] font-bold transition ${
                          selected
                            ? "border-ms-brand bg-ms-brand text-ms-on-brand"
                            : "border-ms-line bg-ms-card text-ms-secondary"
                        } ${disabled ? "opacity-45" : ""}`}
                        disabled={disabled}
                        key={option.value}
                        onClick={() => togglePersonalityTag(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 flex items-start gap-2 text-[13px] font-medium leading-[1.5] text-ms-muted">
                  <Info className="mt-0.5 shrink-0" size={15} strokeWidth={2} />
                  최대 3개까지 선택할 수 있고, 산책 코스의 소음·사람 밀도·길 분위기를 고르는 데 사용돼요.
                </p>
              </div>

              <button
                className="flex h-14 w-full items-center justify-center rounded-full bg-ms-brand text-[17px] font-extrabold text-ms-on-brand transition active:scale-[0.99] active:bg-ms-brand-pressed disabled:opacity-60"
                disabled={isBusy}
                type="submit"
              >
                강아지 등록 후 케어 횟수 정하기
              </button>
            </form>
          </section>
        )}

        {status?.nextStep === "dog-or-invite" && flowStep === "care" && (
          <section className="mt-8">
            <p className="text-[15px] font-bold leading-none text-ms-emphasis">마지막 단계</p>
            <h2 className="mt-3 text-[26px] font-extrabold leading-[1.22] text-ms-ink">
              하루 케어 횟수를
              <br />
              정해주세요.
            </h2>
            <p className="mt-3 text-[15px] font-medium leading-[1.55] text-ms-secondary">
              오늘부터 셰어링 탭과 메인 탭에 보일 밥·약·산책 횟수예요.
            </p>

            <div className="mt-7 space-y-4">
              {SHARING_CARE_KINDS.map((kind) => (
                <div className="rounded-[18px] border border-ms-line bg-ms-card px-4 py-4" key={kind}>
                  <div className="flex items-center gap-2">
                    <ListChecks className="text-ms-muted" size={18} strokeWidth={2.1} />
                    <span className="text-[15px] font-extrabold text-ms-ink">{CARE_LABELS[kind]}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {CARE_COUNT_OPTIONS.map((count) => {
                      const selected = drafts[kind].count === count;
                      return (
                        <button
                          aria-pressed={selected}
                          className={`h-11 rounded-full border text-[14px] font-extrabold transition ${
                            selected
                              ? "border-ms-brand bg-ms-brand text-ms-on-brand"
                              : "border-ms-line bg-ms-sunken text-ms-secondary"
                          }`}
                          key={count}
                          onClick={() => updateCareCount(kind, count)}
                          type="button"
                        >
                          {count === 0 ? "안 함" : `${count}회`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                className="flex h-14 w-full items-center justify-center rounded-full bg-ms-brand text-[17px] font-extrabold text-ms-on-brand transition active:scale-[0.99] active:bg-ms-brand-pressed disabled:opacity-60"
                disabled={isBusy}
                onClick={submitCareRoutines}
                type="button"
              >
                온보딩 완료
              </button>
            </div>
          </section>
        )}

        {(message || error) && (
          <p
            className={`mt-5 rounded-[16px] px-4 py-3 text-center text-[13px] font-bold ${
              error ? "bg-ms-warn-bg text-ms-warn-fg" : "bg-ms-ok-bg text-ms-ok-fg"
            }`}
          >
            {error || message}
          </p>
        )}
      </div>
    </main>
  );
}
