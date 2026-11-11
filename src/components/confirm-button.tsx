"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { IconTrash } from "./icons";

/**
 * Botão de exclusão que pede confirmação numa pequena janela (modal) antes de enviar o
 * formulário em que está. Use dentro de um <form action={…}>.
 * `requireText`: exige digitar esse texto (ex.: "APAGAR"); o valor vai no campo `requireName`.
 */
export function ConfirmButton({
  title,
  message,
  confirmLabel = "Excluir",
  className,
  disabled,
  requireText,
  requireName = "confirm",
  children,
  ...rest
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  className?: string;
  disabled?: boolean;
  requireText?: string;
  requireName?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { pending } = useFormStatus();
  const [typed, setTyped] = useState("");
  const ok = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();

  const close = () => dialogRef.current?.close();
  const confirm = () => {
    if (!ok) return;
    close();
    triggerRef.current?.form?.requestSubmit();
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={className}
        aria-label={rest["aria-label"]}
        disabled={disabled || pending}
        onClick={() => {
          setTyped("");
          dialogRef.current?.showModal();
        }}
      >
        {pending ? "…" : children}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`${title}-titulo`}
        className="m-auto w-[min(92vw,24rem)] rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        // clique fora (no fundo escuro) fecha
        onClick={(e) => e.target === dialogRef.current && close()}
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" aria-hidden>
              <IconTrash width={18} height={18} />
            </span>
            <div className="min-w-0">
              <h2 id={`${title}-titulo`} className="text-base font-semibold">{title}</h2>
              <div className="muted mt-1 text-sm">{message}</div>
            </div>
          </div>
          {requireText && (
            <div className="mt-4">
              <label className="label" htmlFor={`${requireName}-campo`}>Digite <b>{requireText}</b> para confirmar</label>
              <input
                id={`${requireName}-campo`} name={requireName} autoComplete="off" placeholder={requireText}
                className="input font-mono tracking-widest uppercase"
                value={typed} onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirm(); } }}
              />
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-outline px-4 py-2 text-sm" onClick={close} autoFocus={!requireText}>Cancelar</button>
            <button type="button" className="btn bg-red-600 shadow-red-600/20 hover:bg-red-700" disabled={!ok} onClick={confirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
