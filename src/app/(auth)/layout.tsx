export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-white/15 text-4xl shadow-inner backdrop-blur">💑</div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Contas do Casal</h1>
          <p className="text-sm text-blue-100">Compras, parcelas e quem deve quanto a quem</p>
        </div>
        <div className="[&_.card]:shadow-2xl [&_.card]:shadow-blue-950/30">{children}</div>
      </div>
    </main>
  );
}
