"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Vehicle = {
  id: string;
  make: string;
  model: string;
  color: string;
  license_plate: string;
  seats: number;
};

const communes = [
  "Las Condes",
  "Lo Barnechea",
  "Vitacura",
  "Ñuñoa",
  "Peñalolén",
  "La Reina",
];

export default function NewTripPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [direction, setDirection] = useState("to_campus");
  const [commune, setCommune] = useState("");
  const [sector, setSector] = useState("");
  const [departureAt, setDepartureAt] = useState("");
  const [availableSeats, setAvailableSeats] = useState(1);
  const [notes, setNotes] = useState("");

  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadVehicles() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { data, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("id, make, model, color, license_plate, seats")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });

      if (vehiclesError) {
        setError(vehiclesError.message);
        setIsLoadingVehicles(false);
        return;
      }

      const loadedVehicles = data ?? [];

      setVehicles(loadedVehicles);

      if (loadedVehicles.length > 0) {
        setVehicleId(loadedVehicles[0].id);
        setAvailableSeats(Math.min(3, loadedVehicles[0].seats));
      }

      setIsLoadingVehicles(false);
    }

    loadVehicles();
  }, [router, supabase]);

  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === vehicleId,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!vehicleId || !commune || !sector.trim() || !departureAt) {
      setError("Completa todos los campos obligatorios.");
      return;
    }

    const departureDate = new Date(departureAt);

    if (
      Number.isNaN(departureDate.getTime()) ||
      departureDate <= new Date()
    ) {
      setError("La fecha y hora deben ser futuras.");
      return;
    }

    const maximumSeats = selectedVehicle?.seats ?? 1;

    if (availableSeats < 1 || availableSeats > maximumSeats) {
      setError(`Puedes publicar entre 1 y ${maximumSeats} asientos.`);
      return;
    }

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

    const { error: tripError } = await supabase.from("trips").insert({
      driver_id: user.id,
      vehicle_id: vehicleId,
      direction,
      commune,
      sector: sector.trim(),
      departure_at: departureDate.toISOString(),
      available_seats: availableSeats,
      price_clp: 1000,
      notes: notes.trim() || null,
      status: "published",
    });

    if (tripError) {
      setError(tripError.message);
      setIsSubmitting(false);
      return;
    }

    router.push("/protected");
    router.refresh();
  }

  if (isLoadingVehicles) {
    return (
      <main className="min-h-screen bg-neutral-100 p-6">
        <p className="text-center text-neutral-600">Cargando vehículo...</p>
      </main>
    );
  }

  if (vehicles.length === 0) {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-10">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Agrega un vehículo</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Necesitas registrar un vehículo antes de publicar viajes.
          </p>

          <button
            onClick={() => router.push("/onboarding")}
            className="mt-6 w-full rounded-lg bg-black px-4 py-3 font-medium text-white"
          >
            Completar perfil
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-neutral-500">Súbete</p>
          <h1 className="text-2xl font-semibold">Publicar viaje</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Comparte un trayecto que ya realizarás.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Dirección del viaje
            </label>

            <select
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="to_campus">Hacia la UAI</option>
              <option value="from_campus">Desde la UAI</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Vehículo</label>

            <select
              value={vehicleId}
              onChange={(event) => {
                const newVehicleId = event.target.value;
                const newVehicle = vehicles.find(
                  (vehicle) => vehicle.id === newVehicleId,
                );

                setVehicleId(newVehicleId);
                setAvailableSeats(
                  Math.min(availableSeats, newVehicle?.seats ?? 1),
                );
              }}
              className="w-full rounded-lg border px-3 py-2"
            >
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.make} {vehicle.model} · {vehicle.license_plate}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Comuna</label>

            <select
              value={commune}
              onChange={(event) => setCommune(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="">Selecciona una comuna</option>

              {communes.map((communeName) => (
                <option key={communeName} value={communeName}>
                  {communeName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Sector aproximado
            </label>

            <input
              value={sector}
              onChange={(event) => setSector(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Metro Hernando de Magallanes"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Fecha y hora de salida
            </label>

            <input
              type="datetime-local"
              value={departureAt}
              onChange={(event) => setDepartureAt(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Asientos disponibles
            </label>

            <input
              type="number"
              min={1}
              max={selectedVehicle?.seats ?? 1}
              value={availableSeats}
              onChange={(event) =>
                setAvailableSeats(Number(event.target.value))
              }
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Precio por pasajero
            </label>

            <input
              value="$1.000"
              disabled
              className="w-full rounded-lg border bg-neutral-100 px-3 py-2 text-neutral-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Información adicional
            </label>

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-24 w-full rounded-lg border px-3 py-2"
              placeholder="Puedo esperar cinco minutos. Llevo espacio para mochila."
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {isSubmitting ? "Publicando..." : "Publicar viaje"}
          </button>
        </form>
      </div>
    </main>
  );
}