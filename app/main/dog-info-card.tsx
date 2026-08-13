"use client";

import { Dog } from "lucide-react";
import { useAuth } from "../auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "../ui";

/** 이름과 산책 특징(성격 키워드). 성격 키워드는 값으로 저장돼 있어 라벨로 바꿔 보여준다. */
export function DogInfoCard() {
  const { options, primaryDog } = useAuth();

  if (!primaryDog) {
    return null;
  }

  const labelByValue = new Map((options?.personalityTags ?? []).map((tag) => [tag.value, tag.label]));
  const tags = primaryDog.personality_tags ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dog size={20} /> {primaryDog.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <span className="text-sm font-black text-muted-foreground">산책 특징</span>
        {tags.length === 0 ? (
          <p className="text-sm font-bold text-muted-foreground">등록된 성격 키워드가 없어요.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                className="rounded-full border border-primary/30 bg-green-50 px-3 py-1 text-sm font-bold text-primary"
                key={tag}
              >
                {labelByValue.get(tag) ?? tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
