import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ResultCardProps = {
  title: string;
  subtitle?: string;
  content?: string;
  data?: unknown;
  status?: "success" | "warning" | "error";
};

export function ResultCard({
  title,
  subtitle,
  content,
  data,
  status = "success",
}: ResultCardProps) {
  const badgeVariant = status === "error" ? "destructive" : "secondary";

  return (
    <div className="rounded-md border border-border bg-muted/35 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          {subtitle ? (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <Badge className="shrink-0" variant={badgeVariant}>
          {status}
        </Badge>
      </div>

      {content ? (
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-sm leading-relaxed text-foreground">
          {content}
        </pre>
      ) : null}

      {data ? (
        <pre
          className={cn(
            "max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-sm leading-relaxed text-foreground",
            content ? "mt-3" : "",
          )}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
