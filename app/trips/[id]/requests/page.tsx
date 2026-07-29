"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Trip = {
  id: string;
  driver_id: string;
  direction: "to_campus" | "from_campus";
  commune: string;
  sector: string;
  departure_at: string;
};

type RideRequest = {
  id: string;
  passenger_id: string;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  passenger_name: string;
};

export default function TripRequestsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const tripId = params.id;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRequests() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/auth/login");
        return;
      }

      const { data: tripRow, error: tripError } = await supabase
        .from("trips")
        .select(
          `
          id,
          driver_id,
          direction,
          commune,
          sector,
          departure_at
        `,
        )
        .eq("id", tripId)
        .maybeSingle();

      if (tripError) {
        setError(tripError.message);
        setIsLoading(false);
        return;
      }

      if (!tripRow || tripRow.driver_id !== user.id) {
        setError("No puedes gestionar las solicitudes de este viaje.");
        setIsLoading(false);
        return;
      }

      setTrip(tripRow);

      const { data: requestRows, error: requestsError } = await supabase
        .from("ride_requests")
        .select(
          `
          id,
          passenger_id,
          message,
          status,
          created_at
        `,
        )
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });

      if (requestsError) {
        setError(requestsError.message);
        setIsLoading(false);
        return;
      }

      const passengerIds = [
        ...new Set(
          (requestRows ?? []).map((request) => request.passenger_id),
        ),
      ];

      const passengerNames: Record<string, string> = {};

      if (passengerIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", passengerIds);

        if (profilesError) {
          setError(profilesError.message);
          setIsLoading(false);
          return;
        }

        for (const profile of profiles ?? []) {
          passengerNames[profile.id] =
            profile.full_name?.trim() || "Usuario UAI";
        }
      }

      setRequests(
        (requestRows ?? []).map((request) => ({
          ...request,
          passenger_name:
            passengerNames[request.passenger_id] || "Usuario UAI",
        })),
      );

      setIsLoading(false);
    }

    loadRequests();
  }, [router, supabase, tripId]);

  async function respondToRequest(
    requestId: string,
    decision: "accepted" | "rejected",
  ) {
    setError(null);
    setActionId(requestId);

    const { error: responseError } = await supabase.rpc(
      "respond_to_ride_request",
      {
        p_request_id: requestId,
        p_decision: decision,
      },
    );

    if (responseError) {
      setError(responseError.message);
      setActionId(null);
      return;
    }

    setRequests((currentRequests) =>
      currentRequests.map((request) => {
        if (request.id === requestId) {
          return {
            ...request,
            status: decision,
          };
        }

        return request;
      }),
    );

    setActionId(null);
  }

  function statusLabel(status: RideRequest["status"]) {
    const labels = {
      pending: "Pendiente",
      accepted: "Aceptada",
      rejected: "Rechazada",
      cancelled: "Cancelada",
    };

    return labels[status];
  }

  function formatDeparture(value: string) {
    return new Intl.DateTimeFormat("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-neutral-100 p-6">
        <p className="text-center text-neutral-600">
          Cargando solicitudes...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8">
      <div className="mx-auto max-w-md">
        <Link
          href={`/trips/${tripId}`}
          className="mb-5 inline-block text-sm font-medium"
        >
          ← Volver al viaje
        </Link>

        <header className="mb-6">
          <p className="text-sm font-medium text-neutral-500">Súbete</p>
          <h1 className="text-2xl font-semibold">
            Solicitudes recibidas
          </h1>

          {trip && (
            <p className="mt-2 text-sm text-neutral-600">
              {trip.commune} · {trip.sector}
              <br />
              {formatDeparture(trip.departure_at)}
            </p>
          )}
        </header>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {!error && requests.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <h2 className="font-medium">Aún no tienes solicitudes</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Aparecerán aquí cuando alguien solicite un asiento.
            </p>
          </div>
        )}

        <section className="space-y-4">
          {requests.map((request) => (
            <article
              key={request.id}
              className="rounded-2xl bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">
                  {request.passenger_name}
                </h2>

                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium">
                  {statusLabel(request.status)}
                </span>
              </div>

              {request.message && (
                <p className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
                  {request.message}
                </p>
              )}

              {request.status === "pending" && (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={actionId === request.id}
                    onClick={() =>
                      respondToRequest(request.id, "rejected")
                    }
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Rechazar
                  </button>

                  <button
                    type="button"
                    disabled={actionId === request.id}
                    onClick={() =>
                      respondToRequest(request.id, "accepted")
                    }
                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Aceptar
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}