"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Trip = {
  id: string;
  driver_id: string;
  direction: "to_campus" | "from_campus";
  commune: string;
  sector: string;
  departure_at: string;
  available_seats: number;
  price_clp: number;
  notes: string | null;
  driver_name: string;
};

const communes = [
  "Las Condes",
  "Lo Barnechea",
  "Vitacura",
  "Ñuñoa",
  "Peñalolén",
  "La Reina",
];

export default function TripsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [trips, setTrips] = useState<Trip[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");

  const [direction, setDirection] = useState("all");
  const [commune, setCommune] = useState("all");
  const [search, setSearch] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTrips() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/auth/login");
        return;
      }

      setCurrentUserId(user.id);

      const { data: tripRows, error: tripsError } = await supabase
        .from("trips")
        .select(
          `
          id,
          driver_id,
          direction,
          commune,
          sector,
          departure_at,
          available_seats,
          price_clp,
          notes
        `,
        )
        .eq("status", "published")
        .gte("departure_at", new Date().toISOString())
        .order("departure_at", { ascending: true });

      if (tripsError) {
        setError(tripsError.message);
        setIsLoading(false);
        return;
      }

      const driverIds = [
        ...new Set((tripRows ?? []).map((trip) => trip.driver_id)),
      ];

      const driverNames: Record<string, string> = {};

      if (driverIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", driverIds);

        if (profilesError) {
          setError(profilesError.message);
          setIsLoading(false);
          return;
        }

        for (const profile of profiles ?? []) {
          driverNames[profile.id] =
            profile.full_name?.trim() || "Usuario UAI";
        }
      }

      setTrips(
        (tripRows ?? []).map((trip) => ({
          ...trip,
          driver_name: driverNames[trip.driver_id] || "Usuario UAI",
        })),
      );

      setIsLoading(false);
    }

    loadTrips();
  }, [router, supabase]);

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      const matchesDirection =
        direction === "all" || trip.direction === direction;

      const matchesCommune =
        commune === "all" || trip.commune === commune;

      const matchesSearch = trip.sector
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      return matchesDirection && matchesCommune && matchesSearch;
    });
  }, [trips, direction, commune, search]);

  function formatDeparture(value: string) {
    return new Intl.DateTimeFormat("es-CL", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8">
      <div className="mx-auto max-w-md">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-500">Súbete</p>
            <h1 className="text-2xl font-semibold">Buscar viajes</h1>
          </div>

          <Link
            href="/trips/new"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Publicar
          </Link>
        </header>

        <section className="mb-6 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            className="w-full rounded-lg border px-3 py-2"
          >
            <option value="all">Ida y vuelta</option>
            <option value="to_campus">Hacia la UAI</option>
            <option value="from_campus">Desde la UAI</option>
          </select>

          <select
            value={commune}
            onChange={(event) => setCommune(event.target.value)}
            className="w-full rounded-lg border px-3 py-2"
          >
            <option value="all">Todas las comunas</option>

            {communes.map((communeName) => (
              <option key={communeName} value={communeName}>
                {communeName}
              </option>
            ))}
          </select>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Buscar sector o punto cercano"
          />
        </section>

        {isLoading && (
          <p className="text-center text-sm text-neutral-600">
            Cargando viajes...
          </p>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {!isLoading && !error && filteredTrips.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <h2 className="font-medium">No encontramos viajes</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Prueba cambiando los filtros o revisa nuevamente más tarde.
            </p>
          </div>
        )}

        <section className="space-y-4">
          {filteredTrips.map((trip) => {
            const isOwnTrip = trip.driver_id === currentUserId;

            return (
              <article
                key={trip.id}
                className="rounded-2xl bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-neutral-500">
                      {trip.direction === "to_campus"
                        ? "Hacia la UAI"
                        : "Desde la UAI"}
                    </p>

                    <h2 className="mt-1 text-lg font-semibold">
                      {trip.commune}
                    </h2>
                  </div>

                  {isOwnTrip && (
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium">
                      Tu viaje
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-sm text-neutral-700">
                  <p>
                    <strong>Sector:</strong> {trip.sector}
                  </p>
                  <p>
                    <strong>Salida:</strong>{" "}
                    {formatDeparture(trip.departure_at)}
                  </p>
                  <p>
                    <strong>Conductor:</strong> {trip.driver_name}
                  </p>
                  <p>
                    <strong>Asientos:</strong> {trip.available_seats}
                  </p>
                  <p>
                    <strong>Precio:</strong> $
                    {trip.price_clp.toLocaleString("es-CL")}
                  </p>
                </div>

                {trip.notes && (
                  <p className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
                    {trip.notes}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}