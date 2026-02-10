export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">StageHand</h1>
      <p className="text-xl mb-8">Live broadcast control room</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
        <a href="/producer/demo" className="p-6 border border-gray-700 rounded-lg hover:bg-gray-900 transition">
          <h2 className="text-2xl font-bold mb-2">Producer Console</h2>
          <p className="text-gray-400">Manage roles, permissions, and scene configuration.</p>
        </a>
        
        <a href="/console/demo" className="p-6 border border-gray-700 rounded-lg hover:bg-gray-900 transition">
          <h2 className="text-2xl font-bold mb-2">Operator Console</h2>
          <p className="text-gray-400">Spawn and manipulate assets on the stage.</p>
        </a>

        <a href="/overlay/demo" className="p-6 border border-gray-700 rounded-lg hover:bg-gray-900 transition">
          <h2 className="text-2xl font-bold mb-2">Overlay Renderer</h2>
          <p className="text-gray-400">The transparent layer for OBS.</p>
        </a>
      </div>
    </main>
  );
}
