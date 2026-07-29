"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Trip = {
  id: string;
  direction: "to_campus" | "from_campus";
  commune: string;
  sector: string;
  departure_at: string;
};

type CoordinationContact = {
  participant_role: "driver" | "passenger";
  user_id: string;
  full_name: string;
  phone: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  license_plate: string | null;
};

export default function CoordinationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const tripId = params.id;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [contacts, setContacts] = useState<CoordinationContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCoordination() {
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
          direction,
          commune,
          sector,
          departure_at
        `,
        )
        .eq("id", tripId)
        .maybeSingle();

      if (tripError || !tripRow) {
        setError(
          tripError?.message ||
            "El viaje no existe o no está disponible.",
        );
        setIsLoading(false);
        return;
      }

      setTrip(tripRow);

      const { data, error: coordinationError } = await supabase.rpc(
        "get_trip_coordination",
        {
          p_trip_id: tripId,
        },
      );

      if (coordinationError) {
        setError(coordinationError.message);
        setIsLoading(false);
        return;
      }

      setContacts((data ?? []) as CoordinationContact[]);
      setIsLoading(false);
    }

    loadCoordination();
  }, [router, supabase, tripId]);

  function formatDeparture(value: string) {
    return new Intl.DateTimeFormat("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function whatsappLink(phone: string) {
    let number = phone.replace(/\D/g, "");

    if (number.startsWith("9") && number.length === 9) {
      number = `56${number}`;
    }

    const message = encodeURIComponent(
      "Hola, te escribo para coordinar nuestro viaje en Súbete.",
    );

    return `https://wa.me/${number}?text=${message}`;
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-neutral-100 p-6">
        <p className="text-center text-neutral-600">
          Cargando coordinación...
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

          <h1 className="text-2xl font-semibold">Coordinar viaje</h1>

          {trip && (
            <p className="mt-2 text-sm text-neutral-600">
              {trip.direction === "to_campus"
                ? "Hacia la UAI"
                : "Desde la UAI"}
              {" · "}
              {trip.commune}
              <br />
              {trip.sector}
              <br />
              {formatDeparture(trip.departure_at)}
            </p>
          )}
        </header>

        {error && (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {!error && contacts.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <h2 className="font-medium">
              Aún no hay pasajeros aceptados
            </h2>

            <p className="mt-2 text-sm text-neutral-600">
              Los datos aparecerán después de aceptar una solicitud.
            </p>
          </div>
        )}

        <section className="space-y-4">
          {contacts.map((contact) => (
            <article
              key={contact.user_id}
              className="rounded-2xl bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-medium uppercase text-neutral-500">
                {contact.participant_role === "driver"
                  ? "Conductor"
                  : "Pasajero"}
              </p>

              <h2 className="mt-1 text-lg font-semibold">
                {contact.full_name}
              </h2>

              {contact.phone && (
                <p className="mt-3 text-sm text-neutral-700">
                  <strong>Teléfono:</strong> {contact.phone}
                </p>
              )}

              {contact.participant_role === "driver" &&
                contact.vehicle_make && (
                  <div className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
                    <p>
                      <strong>Vehículo:</strong>{" "}
                      {contact.vehicle_make} {contact.vehicle_model}
                    </p>

                    <p>
                      <strong>Color:</strong>{" "}
                      {contact.vehicle_color}
                    </p>

                    <p>
                      <strong>Patente:</strong>{" "}
                      {contact.license_plate}
                    </p>
                  </div>
                )}

              {contact.phone && (
                <a
                  href={whatsappLink(contact.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 block w-full rounded-lg bg-black px-4 py-3 text-center font-medium text-white"
                >
                  Coordinar por WhatsApp
                </a>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}