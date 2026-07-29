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
  available_seats: number;
  price_clp: number;
  notes: string | null;
  status: string;
};

type RideRequest = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
};

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const tripId = params.id;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [driverName, setDriverName] = useState("Usuario UAI");
  const [currentUserId, setCurrentUserId] = useState("");
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null);
  const [message, setMessage] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTrip() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/auth/login");
        return;
      }

      setCurrentUserId(user.id);

      const { data: tripRow, error: tripError } = await supabase
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
          notes,
          status
        `,
        )
        .eq("id", tripId)
        .maybeSingle();

      if (tripError) {
        setError(tripError.message);
        setIsLoading(false);
        return;
      }

      if (!tripRow) {
        setError("El viaje no existe o ya no está disponible.");
        setIsLoading(false);
        return;
      }

      setTrip(tripRow);

      const { data: driverProfile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", tripRow.driver_id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setIsLoading(false);
        return;
      }

      setDriverName(
        driverProfile?.full_name?.trim() || "Usuario UAI",
      );

      if (tripRow.driver_id !== user.id) {
        const { data: existingRequest, error: requestError } =
          await supabase
            .from("ride_requests")
            .select("id, status")
            .eq("trip_id", tripId)
            .eq("passenger_id", user.id)
            .maybeSingle();

        if (requestError) {
          setError(requestError.message);
          setIsLoading(false);
          return;
        }

        setRideRequest(existingRequest);
      }

      setIsLoading(false);
    }

    loadTrip();
  }, [router, supabase, tripId]);

  async function requestSeat() {
    setError(null);
    setIsSubmitting(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Tu sesión expiró. Inicia sesión nuevamente.");
      setIsSubmitting(false);
      return;
    }

    const { data, error: requestError } = await supabase
      .from("ride_requests")
      .insert({
        trip_id: tripId,
        passenger_id: user.id,
        message: message.trim() || null,
        status: "pending",
      })
      .select("id, status")
      .single();

    if (requestError) {
      if (requestError.code === "23505") {
        setError("Ya solicitaste un asiento en este viaje.");
      } else {
        setError(requestError.message);
      }

      setIsSubmitting(false);
      return;
    }

    setRideRequest(data);
    setIsSubmitting(false);
  }

  async function cancelRequest() {
    if (!rideRequest) return;

    setError(null);
    setIsSubmitting(true);

    const { error: cancelError } = await supabase
      .from("ride_requests")
      .update({ status: "cancelled" })
      .eq("id", rideRequest.id);

    if (cancelError) {
      setError(cancelError.message);
      setIsSubmitting(false);
      return;
    }

    setRideRequest({
      ...rideRequest,
      status: "cancelled",
    });

    setIsSubmitting(false);
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

  function requestStatusLabel(status: RideRequest["status"]) {
    const labels = {
      pending: "Solicitud pendiente",
      accepted: "Solicitud aceptada",
      rejected: "Solicitud rechazada",
      cancelled: "Solicitud cancelada",
    };

    return labels[status];
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-neutral-100 p-6">
        <p className="text-center text-neutral-600">Cargando viaje...</p>
      </main>
    );
  }

  if (error && !trip) {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-10">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-red-700">{error}</p>

          <Link
            href="/trips"
            className="mt-5 block text-sm font-medium underline"
          >
            Volver a viajes
          </Link>
        </div>
      </main>
    );
  }

  if (!trip) return null;

  const isOwnTrip = trip.driver_id === currentUserId;
  const canRequest =
    !isOwnTrip &&
    trip.status === "published" &&
    trip.available_seats > 0 &&
    (!rideRequest ||
      rideRequest.status === "rejected" ||
      rideRequest.status === "cancelled");

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8">
      <div className="mx-auto max-w-md">
        <Link
          href="/trips"
          className="mb-5 inline-block text-sm font-medium"
        >
          ← Volver
        </Link>

        <article className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">
            {trip.direction === "to_campus"
              ? "Hacia la UAI"
              : "Desde la UAI"}
          </p>

          <h1 className="mt-1 text-2xl font-semibold">
            {trip.commune}
          </h1>

          <div className="mt-6 space-y-3 text-sm text-neutral-700">
            <p>
              <strong>Sector:</strong> {trip.sector}
            </p>

            <p>
              <strong>Salida:</strong>{" "}
              {formatDeparture(trip.departure_at)}
            </p>

            <p>
              <strong>Conductor:</strong> {driverName}
            </p>

            <p>
              <strong>Asientos disponibles:</strong>{" "}
              {trip.available_seats}
            </p>

            <p>
              <strong>Precio por pasajero:</strong> $
              {trip.price_clp.toLocaleString("es-CL")}
            </p>
          </div>

          {trip.notes && (
            <p className="mt-5 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
              {trip.notes}
            </p>
          )}

          {isOwnTrip && (
  <div className="mt-6 rounded-lg bg-neutral-100 p-4 text-sm">
    <p>Este viaje fue publicado por ti.</p>

    <Link
      href={`/trips/${trip.id}/requests`}
      className="mt-3 block rounded-lg bg-black px-4 py-2 text-center font-medium text-white"
    >
      Ver solicitudes
    </Link>
  </div>
)}

          {!isOwnTrip && rideRequest && (
            <div className="mt-6 rounded-lg bg-neutral-100 p-4">
              <p className="font-medium">
                {requestStatusLabel(rideRequest.status)}
              </p>

              {rideRequest.status === "pending" && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={cancelRequest}
                  className="mt-3 text-sm font-medium underline disabled:opacity-50"
                >
                  Cancelar solicitud
                </button>
              )}
            </div>
          )}

          {canRequest && (
            <div className="mt-6 border-t pt-6">
              <label className="mb-2 block text-sm font-medium">
                Mensaje para el conductor
              </label>

              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-24 w-full rounded-lg border px-3 py-2"
                placeholder="Vivo cerca del metro y puedo caminar hasta el punto de encuentro."
              />

              {error && (
                <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={requestSeat}
                disabled={isSubmitting}
                className="mt-4 w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50"
              >
                {isSubmitting
                  ? "Enviando..."
                  : "Solicitar asiento"}
              </button>
            </div>
          )}
        </article>
      </div>
    </main>
  );
}