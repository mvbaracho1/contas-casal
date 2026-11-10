export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="text-4xl">💑</div>
        <h1 className="mt-2 text-2xl font-bold">Contas do Casal</h1>
        <p className="text-sm text-zinc-500">Compras, parcelas e quem deve quanto a quem</p>
      </div>
      {children}
    </main>
  );
}
