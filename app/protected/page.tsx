"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Trip = {
  id: string;
  direction: "to_campus" | "from_campus";
  commune: string;
  sector: string;
  departure_at: string;
  available_seats: number;
  status: "published" | "full" | "completed" | "cancelled";
};

type PassengerRequest = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  trip_id: string;
  trip: Trip | null;
};

export default function HomePage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [fullName, setFullName] = useState("");
  const [driverTrips, setDriverTrips] = useState<Trip[]>([]);
  const [passengerRequests, setPassengerRequests] = useState<
    PassengerRequest[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHome() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/auth/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setIsLoading(false);
        return;
      }

      setFullName(profile?.full_name?.trim() || "Usuario UAI");

      const { data: ownTrips, error: ownTripsError } = await supabase
        .from("trips")
        .select(
          `
          id,
          direction,
          commune,
          sector,
          departure_at,
          available_seats,
          status
        `,
        )
        .eq("driver_id", user.id)
        .gte("departure_at", new Date().toISOString())
        .neq("status", "cancelled")
        .order("departure_at", { ascending: true });

      if (ownTripsError) {
        setError(ownTripsError.message);
        setIsLoading(false);
        return;
      }

      setDriverTrips((ownTrips ?? []) as Trip[]);

      const { data: requestRows, error: requestsError } = await supabase
        .from("ride_requests")
        .select("id, trip_id, status")
        .eq("passenger_id", user.id)
        .in("status", ["pending", "accepted"])
        .order("created_at", { ascending: false });

      if (requestsError) {
        setError(requestsError.message);
        setIsLoading(false);
        return;
      }

      const tripIds = (requestRows ?? []).map(
        (request) => request.trip_id,
      );

      const passengerTrips: Record<string, Trip> = {};

      if (tripIds.length > 0) {
        const { data: relatedTrips, error: relatedTripsError } =
          await supabase
            .from("trips")
            .select(
              `
              id,
              direction,
              commune,
              sector,
              departure_at,
              available_seats,
              status
            `,
            )
            .in("id", tripIds);

        if (relatedTripsError) {
          setError(relatedTripsError.message);
          setIsLoading(false);
          return;
        }

        for (const trip of relatedTrips ?? []) {
          passengerTrips[trip.id] = trip as Trip;
        }
      }

      setPassengerRequests(
        (requestRows ?? []).map((request) => ({
          ...request,
          trip: passengerTrips[request.trip_id] ?? null,
        })) as PassengerRequest[],
      );

      setIsLoading(false);
    }

    loadHome();
  }, [router, supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  function formatDeparture(value: string) {
    return new Intl.DateTimeFormat("es-CL", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function directionLabel(direction: Trip["direction"]) {
    return direction === "to_campus"
      ? "Hacia la UAI"
      : "Desde la UAI";
  }

  function requestLabel(status: PassengerRequest["status"]) {
    const labels = {
      pending: "Pendiente",
      accepted: "Aceptada",
      rejected: "Rechazada",
      cancelled: "Cancelada",
    };

    return labels[status];
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-neutral-100 p-6">
        <p className="text-center text-neutral-600">
          Cargando Súbete...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8">
      <div className="mx-auto max-w-md">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-500">
              Súbete
            </p>

            <h1 className="text-2xl font-semibold">
              Hola, {fullName.split(" ")[0]}
            </h1>
          </div>

          <button
            type="button"
            onClick={signOut}
            className="text-sm font-medium underline"
          >
            Cerrar sesión
          </button>
        </header>

        {error && (
          <p className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <section className="mb-7 grid grid-cols-2 gap-3">
          <Link
            href="/trips"
            className="rounded-2xl bg-black p-5 text-white"
          >
            <span className="block font-semibold">Buscar viaje</span>
            <span className="mt-1 block text-sm text-neutral-300">
              Encuentra una ida o vuelta
            </span>
          </Link>

          <Link
            href="/trips/new"
            className="rounded-2xl bg-white p-5 shadow-sm"
          >
            <span className="block font-semibold">Publicar viaje</span>
            <span className="mt-1 block text-sm text-neutral-500">
              Ofrece asientos disponibles
            </span>
          </Link>
        </section>

        <section className="mb-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Viajes que publicaste
            </h2>
          </div>

          {driverTrips.length === 0 ? (
            <div className="rounded-2xl bg-white p-5 text-sm text-neutral-600 shadow-sm">
              No tienes viajes próximos publicados.
            </div>
          ) : (
            <div className="space-y-3">
              {driverTrips.map((trip) => (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="block rounded-2xl bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-500">
                        {directionLabel(trip.direction)}
                      </p>

                      <h3 className="mt-1 font-semibold">
                        {trip.commune} · {trip.sector}
                      </h3>
                    </div>

                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium">
                      {trip.available_seats} asientos
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-neutral-600">
                    {formatDeparture(trip.departure_at)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mb-7">
          <h2 className="mb-3 text-lg font-semibold">
            Tus solicitudes
          </h2>

          {passengerRequests.length === 0 ? (
            <div className="rounded-2xl bg-white p-5 text-sm text-neutral-600 shadow-sm">
              No tienes solicitudes activas.
            </div>
          ) : (
            <div className="space-y-3">
              {passengerRequests.map((request) => {
                if (!request.trip) return null;

                return (
                  <Link
                    key={request.id}
                    href={`/trips/${request.trip.id}`}
                    className="block rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-500">
                          {directionLabel(request.trip.direction)}
                        </p>

                        <h3 className="mt-1 font-semibold">
                          {request.trip.commune} ·{" "}
                          {request.trip.sector}
                        </h3>
                      </div>

                      <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium">
                        {requestLabel(request.status)}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-neutral-600">
                      {formatDeparture(request.trip.departure_at)}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <Link
          href="/onboarding"
          className="block rounded-2xl border border-neutral-300 p-4 text-center text-sm font-medium"
        >
          Editar perfil o agregar vehículo
        </Link>
      </div>
    </main>
  );
}
