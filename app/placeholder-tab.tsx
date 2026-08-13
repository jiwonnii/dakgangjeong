import { Card, CardContent, CardHeader, CardTitle } from "./ui";

/** 아직 내용을 만들지 않은 탭. 작업이 진행되면 하나씩 실제 화면으로 바뀐다. */
export function PlaceholderTab({ title, note }: { title: string; note: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-bold text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}
