import { cn } from "../../utils/cn";

export function Skeleton({ className }) {
  return (
    <div className={cn("animate-pulse bg-[#141425] rounded-lg", className)} />
  );
}

export function CardSkeleton() {
  return (
    <div
      className="p-5 space-y-3 rounded-2xl"
      style={{
        background: "#0f0f1a",
        border: "1px solid rgba(163,230,53,0.12)",
      }}
    >
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 4 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}