import { Stripe, Wordmark } from "@/components/Brand";

export default function Offline() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-zgreen text-white">
        <div className="max-w-xl mx-auto px-4 py-3">
          <Wordmark light className="text-2xl" />
        </div>
        <Stripe />
      </header>
      <main className="flex-1 flex items-center justify-center p-5">
        <div className="w-full max-w-sm space-y-3 rounded-2xl border-4 border-zgreen bg-white p-6 text-center shadow-2xl">
          <p className="text-5xl">📡</p>
          <h1 className="text-2xl font-extrabold">No network right now</h1>
          <p className="text-sm text-gray-600">
            FixZed is installed and ready, but reporting needs a data connection so the
            council gets your photo and pin. Move to signal and pull down to refresh.
          </p>
          <p className="text-sm font-semibold text-zgreen">
            Your place in the app is saved, nothing was lost.
          </p>
        </div>
      </main>
    </div>
  );
}
