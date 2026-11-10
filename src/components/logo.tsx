/** Marca do app: dois círculos (azul e rosa), igual ao favicon. */
export function LogoMark({ className = "size-9", ring = "#ffffff" }: { className?: string; ring?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="11.5" cy="16" r="9.5" fill="#2563eb" />
      <circle cx="20.5" cy="16" r="9.5" fill="#f43f5e" stroke={ring} strokeWidth="2" />
    </svg>
  );
}
