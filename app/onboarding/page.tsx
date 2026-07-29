"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [offerRides, setOfferRides] = useState(false);

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [seats, setSeats] = useState(3);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Ingresa tu nombre completo.");
      return;
    }

    if (!phone.trim()) {
      setError("Ingresa tu teléfono.");
      return;
    }

    if (
      offerRides &&
      (!make.trim() ||
        !model.trim() ||
        !color.trim() ||
        !licensePlate.trim())
    ) {
      setError("Completa todos los datos del vehículo.");
      return;
    }

    setIsLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Tu sesión expiró. Inicia sesión nuevamente.");
      setIsLoading(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
      })
      .eq("id", user.id);

    if (profileError) {
      setError(profileError.message);
      setIsLoading(false);
      return;
    }

    if (offerRides) {
      const { error: vehicleError } = await supabase
        .from("vehicles")
        .insert({
          owner_id: user.id,
          make: make.trim(),
          model: model.trim(),
          color: color.trim(),
          license_plate: licensePlate.trim().toUpperCase(),
          seats,
        });

      if (vehicleError) {
        setError(vehicleError.message);
        setIsLoading(false);
        return;
      }
    }

    router.push("/protected");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-neutral-500">Súbete</p>
          <h1 className="text-2xl font-semibold">Completa tu perfil</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Esta información será visible para las personas con quienes
            compartas un viaje.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Nombre completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Cristóbal San Martín"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Teléfono</label>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="+56 9 1234 5678"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4">
            <input
              type="checkbox"
              checked={offerRides}
              onChange={(event) => setOfferRides(event.target.checked)}
            />
            <span>
              <span className="block font-medium">Quiero ofrecer viajes</span>
              <span className="block text-sm text-neutral-500">
                Agregaré los datos de mi vehículo.
              </span>
            </span>
          </label>

          {offerRides && (
            <div className="space-y-4 rounded-xl bg-neutral-50 p-4">
              <h2 className="font-medium">Datos del vehículo</h2>

              <div>
                <label className="mb-1 block text-sm font-medium">Marca</label>
                <input
                  value={make}
                  onChange={(event) => setMake(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="Toyota"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Modelo</label>
                <input
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="Corolla"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Color</label>
                <input
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="Blanco"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Patente</label>
                <input
                  value={licensePlate}
                  onChange={(event) => setLicensePlate(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2 uppercase"
                  placeholder="ABCD12"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Asientos disponibles
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={seats}
                  onChange={(event) => setSeats(Number(event.target.value))}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {isLoading ? "Guardando..." : "Guardar y continuar"}
          </button>
        </form>
      </div>
    </main>
  );
}