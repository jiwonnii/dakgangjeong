/** 화면 전반에서 공유하는 타입. meoksa-app.tsx 하나에 몰려 있던 것을 옮겼다. */

export type LatLon = {
  lat: number;
  lon: number;
};

export type BreedOption = {
  id: string;
  nameKo: string;
  nameEn: string;
};

export type OptionItem = {
  value: string;
  label: string;
};

export type OnboardingOptions = {
  breeds: BreedOption[];
  socialPreferences: OptionItem[];
  personalityTags: OptionItem[];
};

export type OnboardingStatus = {
  guardianProfile: null | {
    id: string;
    display_name: string;
    location_permission_agreed?: boolean;
    notification_permission_agreed?: boolean;
    marketing_agreed?: boolean;
  };
  dogs: Array<{
    id: string;
    name: string;
    breed: string;
    birth_date?: string;
    weight_kg?: number;
    social_preference?: string;
    personality_tags?: string[];
    invite_code?: string;
    role?: string;
    breedInfo?: BreedOption | null;
  }>;
  nextStep: "guardian-profile" | "dog-or-invite" | "complete";
};

/** GET /api/walk-routes/warnings */
export type WarningLevel = "normal" | "caution" | "danger";

export type WarningsResponse = {
  overallLevel: WarningLevel;
  warnings: Array<{
    type: string;
    level: Exclude<WarningLevel, "normal">;
    message: string;
  }>;
};

/** GET /api/care/today */
export type CareTaskType = "walk" | "feed" | "medicine";

export type CareTask = {
  id: string;
  dogId: string;
  routineId: string | null;
  taskType: CareTaskType;
  title: string;
  scheduledFor: string;
  scheduledAt: string | null;
  status: "pending" | "completed" | "skipped";
  completedAt: string | null;
  completedBy: string | null;
  note: string | null;
};

export type CareTodayResponse = {
  date: string;
  routines: Array<{
    id: string;
    taskType: string;
    title: string;
    timesOfDay: string[];
    isActive: boolean;
  }>;
  tasks: CareTask[];
};

export type RecommendedCourse = {
  rank: number;
  direction: string;
  distanceMeters: number;
  durationMinutes: number;
  score: number;
  aiExplanation?: string;
  explanation?: {
    summary: string;
    factors: Array<{
      key: string;
      label: string;
      score: number;
      weight: number;
      contribution: number;
      detail: string;
      preferenceAdjustment?: number;
    }>;
  };
  preferenceInsight?: string | null;
  facts: {
    riskZoneCount: number;
    vehicleExposure: number | null;
    stepsCount: number;
    parkRatio: number;
    treesPerKm: number;
    benchCount: number;
  };
  path: {
    type: "LineString";
    coordinates: Array<[number, number]>;
  };
};

export type DurationOptions = {
  minimumMinutes: number;
  recommendedMinutes: number;
  maximumMinutes: number;
  minimumMeters: number;
  recommendedMeters: number;
  maximumMeters: number;
};

export type RecommendationResponse =
  | {
      status: "ok";
      courses: RecommendedCourse[];
      durationOptions: DurationOptions;
      warnings: Array<{ level: string; code: string; message: string }>;
    }
  | {
      status: "insufficient_coverage" | "generation_failed" | "no_courses_found";
      message: string;
    };
