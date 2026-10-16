import { PanelSkeleton, Skeleton } from "@/components/system/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <span className="sr-only" role="status">
        Loading DayZero…
      </span>
      <Skeleton className="h-10 w-48" />
      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <Skeleton className="aspect-[10/7] w-full lg:col-span-7" />
        <div className="space-y-5 lg:col-span-5">
          <PanelSkeleton label="residents" lines={2} />
          <PanelSkeleton label="metrics" lines={4} />
        </div>
      </div>
    </div>
  );
}
