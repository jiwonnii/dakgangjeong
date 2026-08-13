"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Dog } from "lucide-react";
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
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "./ui";

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
  { name: "locationPermissionAgreed", label: "위치 권한에 동의해요", required: true },
  { name: "notificationPermissionAgreed", label: "알림 권한에 동의해요", required: true },
  { name: "marketingAgreed", label: "마케팅 수신에 동의해요", required: false }
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
    <div className="grid content-start gap-4">
      <div className="rounded-lg border border-border bg-muted p-4 text-sm font-bold">
        강아지를 먼저 등록해주세요. 등록하면 산책 추천과 기록을 쓸 수 있어요.
      </div>

      {status?.nextStep === "guardian-profile" && (
        <Card>
          <CardHeader><CardTitle>보호자 프로필</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={guardianForm.handleSubmit(submitGuardian)}>
              <Input placeholder="보호자 이름" {...guardianForm.register("displayName")} />
              {CONSENT_FIELDS.map((field) => (
                <label className="flex items-start gap-2 rounded-md border border-border bg-muted p-3 text-sm font-bold" key={field.name}>
                  <input className="mt-1" type="checkbox" {...guardianForm.register(field.name)} />
                  <span>{field.label} {field.required ? <b className="text-destructive">(필수)</b> : "(선택)"}</span>
                </label>
              ))}
              {guardianErrorMessage && (
                <div className="rounded-md border border-destructive/30 bg-red-50 p-3 text-sm font-bold text-destructive">
                  {guardianErrorMessage}
                </div>
              )}
              <Button disabled={isBusy} type="submit">저장</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {status?.nextStep === "dog-or-invite" && flowStep === "invite" && (
        <Card>
          <CardHeader><CardTitle>초대 코드 입력</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={submitInvite}>
              <Input
                placeholder="가족에게 받은 초대 코드"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
              />
              <p className="text-sm font-bold text-muted-foreground">초대 코드가 있으면 가족의 강아지에 바로 합류하고, 없으면 새 강아지를 등록해요.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button disabled={isBusy} type="submit">
                  {inviteCode.trim() ? "초대 코드로 합류" : "초대 코드 없이 진행"}
                </Button>
                {inviteCode.trim() && (
                  <Button disabled={isBusy} type="button" variant="outline" onClick={() => setFlowStep("dog")}>
                    새 강아지 등록
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {status?.nextStep === "dog-or-invite" && flowStep === "dog" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dog size={20} /> 강아지 등록
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!options && <div className="rounded-md border border-border bg-muted p-3 text-sm font-bold">선택지를 불러오는 중이에요.</div>}
            <form className="grid gap-3" onSubmit={dogForm.handleSubmit(submitDog)}>
              <Input placeholder="이름" {...dogForm.register("name")} />

              <div className="grid gap-2 rounded-md border border-border bg-muted p-3">
                <span className="text-sm font-black">다른 강아지를 만나면 어떤가요?</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(options?.socialPreferences ?? []).map((option) => {
                    const selected = selectedSocialPreference === option.value;
                    return (
                      <button className={`min-h-11 rounded-md border px-3 text-sm font-bold ${selected ? "border-primary bg-green-50 text-primary" : "border-border bg-white text-foreground"}`} key={option.value} type="button" onClick={() => dogForm.setValue("socialPreference", option.value as "likes_dogs" | "avoids_dogs" | "neutral", { shouldDirty: true, shouldValidate: true })}>
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2 rounded-md border border-border bg-muted p-3">
                <div className="flex items-center justify-between gap-2 text-sm font-black">
                  <span>성격 태그</span>
                  <span className="text-muted-foreground">{selectedPersonalityTags.length} / 3</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(options?.personalityTags ?? []).map((option) => {
                    const selected = selectedPersonalityTags.includes(option.value);
                    const disabled = !selected && selectedPersonalityTags.length >= 3;
                    return (
                      <button className={`min-h-11 rounded-md border px-3 text-left text-sm font-bold ${selected ? "border-primary bg-green-50 text-primary" : "border-border bg-white text-foreground"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`} disabled={disabled} key={option.value} type="button" onClick={() => togglePersonalityTag(option.value)}>
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs font-bold text-muted-foreground">6개 중 최대 3개까지 고를 수 있어요.</p>
              </div>

              <select
                className="h-11 rounded-md border border-border bg-white px-3 text-sm font-bold"
                {...dogForm.register("breed")}
              >
                {(options?.breeds ?? []).map((breed) => (
                  <option key={breed.id} value={breed.id}>
                    {breed.nameKo} ({breed.nameEn})
                  </option>
                ))}
              </select>
              <Input type="date" {...dogForm.register("birthDate")} />
              <Input inputMode="decimal" placeholder="몸무게 kg" {...dogForm.register("weightKg", { valueAsNumber: true })} />
              <Button disabled={isBusy} type="submit">강아지 등록 후 케어 횟수 정하기</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {status?.nextStep === "dog-or-invite" && flowStep === "care" && (
        <Card>
          <CardHeader><CardTitle>하루 케어 횟수</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <p className="text-sm font-bold text-muted-foreground">오늘부터 셰어링 탭과 메인 탭에 보일 밥·약·산책 횟수를 정해 주세요.</p>
              {SHARING_CARE_KINDS.map((kind) => (
                <label className="grid gap-2 rounded-md border border-border bg-muted p-3" key={kind}>
                  <span className="text-sm font-black">{CARE_LABELS[kind]}</span>
                  <select
                    className="h-11 rounded-md border border-border bg-white px-3 text-sm font-bold"
                    value={drafts[kind].count}
                    onChange={(event) => updateCareCount(kind, Number(event.target.value))}
                  >
                    {CARE_COUNT_OPTIONS.map((count) => (
                      <option key={count} value={count}>
                        {count === 0 ? "0회 (안 함)" : `${count}회`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <Button disabled={isBusy} type="button" onClick={submitCareRoutines}>온보딩 완료</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(message || error) && (
        <div
          className={`rounded-lg border p-3 text-sm font-bold ${
            error ? "border-destructive/30 bg-red-50 text-destructive" : "border-primary/20 bg-green-50 text-primary"
          }`}
        >
          {error || message}
        </div>
      )}
    </div>
  );
}
