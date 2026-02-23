export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">TechHive Labs</h1>
        <p className="mt-2 text-gray-600">API-first lead management + payment automation</p>
        <p className="mt-4 text-sm text-gray-400">
          <a href="/api/health" className="underline hover:text-gray-600">/api/health</a>
        </p>
      </div>
    </main>
  );
}
