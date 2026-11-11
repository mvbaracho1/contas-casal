"use client";

import { useActionState, useState } from "react";
import { createCouple, joinCouple, resendInvite } from "@/app/actions";
import { Message, Submit } from "./form-bits";

export function CreateCoupleForm() {
  const [state, action] = useActionState(createCouple, undefined);
  // Controlados: o React 19 limpa o formulário após o envio, inclusive em caso de erro.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-semibold">Criar um casal</h2>
      <p className="text-sm text-zinc-500">Enviamos um convite por e-mail para seu par entrar.</p>
      <div>
        <label className="label" htmlFor="couple-name">Nome do casal</label>
        <input className="input" id="couple-name" name="name" placeholder="Ex: Ana & João" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="partner-email">E-mail do seu par</label>
        <input className="input" id="partner-email" name="partnerEmail" type="email" required autoComplete="off" placeholder="par@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Message state={state} />
      <Submit>Criar casal e enviar convite</Submit>
    </form>
  );
}

export function JoinCoupleForm() {
  const [state, action] = useActionState(joinCouple, undefined);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-semibold">Entrar com código</h2>
      <p className="text-sm text-zinc-500">Seu par já criou o casal? Use o link do e-mail ou o código de convite.</p>
      <input className="input uppercase tracking-widest" name="code" placeholder="ABC123" required maxLength={6} />
      <Message state={state} />
      <Submit>Entrar no casal</Submit>
    </form>
  );
}

export function AcceptInviteForm({ code }: { code: string }) {
  const [state, action] = useActionState(joinCouple, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="code" value={code} />
      <Message state={state} />
      <Submit className="btn w-full py-2.5">Aceitar convite</Submit>
    </form>
  );
}

export function ResendInviteForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action] = useActionState(resendInvite, undefined);
  const [email, setEmail] = useState(defaultEmail);
  return (
    <form action={action} className="space-y-2">
      <label className="label" htmlFor="partner-email">E-mail do seu par</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="input min-w-0 flex-1" id="partner-email" name="partnerEmail" type="email" required placeholder="par@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Submit className="btn shrink-0">{defaultEmail ? "Reenviar convite" : "Enviar convite"}</Submit>
      </div>
      <Message state={state} />
    </form>
  );
}

export function CopyButton({ text, label = "Copiar link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-outline shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* sem permissão de área de transferência: o link continua visível para copiar à mão */
        }
      }}
    >
      {copied ? "Copiado ✓" : label}
    </button>
  );
}
