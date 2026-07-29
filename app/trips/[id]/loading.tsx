export default function TripLoading() {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-28 rounded bg-neutral-200" />

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="h-6 w-48 rounded bg-neutral-200" />
            <div className="mt-4 h-4 w-full rounded bg-neutral-200" />
            <div className="mt-2 h-4 w-3/4 rounded bg-neutral-200" />
          </div>
        </div>
      </div>
    </main>
  );
}