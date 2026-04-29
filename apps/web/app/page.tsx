import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-semibold">HFT Simulation Platform</h1>
        <p className="text-slate-400">Real-time trading, portfolio, and leaderboard.</p>
        <div className="space-x-3">
          <Link href="/login" className="rounded bg-indigo-600 px-4 py-2">
            Login
          </Link>
          <Link href="/dashboard" className="rounded border border-slate-500 px-4 py-2">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
