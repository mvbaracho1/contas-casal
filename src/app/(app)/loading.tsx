// Mostrado enquanto o servidor monta a próxima página (o menu continua na tela).
export default function Loading() {
  const bar = "rounded-lg bg-zinc-200/80 dark:bg-zinc-800";
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Carregando">
      <div className="card flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className={`h-6 w-44 ${bar}`} />
          <div className={`h-3 w-28 ${bar}`} />
        </div>
        <div className={`hidden h-9 w-28 sm:block ${bar}`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`card space-y-4 ${i === 0 ? "md:col-span-2" : ""}`}>
            <div className={`h-4 w-32 ${bar}`} />
            <div className={`h-9 w-40 ${bar}`} />
            <div className="space-y-2">
              <div className={`h-3 w-full ${bar}`} />
              <div className={`h-3 w-5/6 ${bar}`} />
              <div className={`h-3 w-2/3 ${bar}`} />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
