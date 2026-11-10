"use client";

import { useActionState } from "react";
import { createCouple, joinCouple } from "@/app/actions";
import { Message, Submit } from "./form-bits";

export function CreateCoupleForm() {
  const [state, action] = useActionState(createCouple, undefined);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-semibold">Criar um casal</h2>
      <p className="text-sm text-zinc-500">Você recebe um código para convidar seu par.</p>
      <input className="input" name="name" placeholder="Nome do casal (ex: Ana & João)" />
      <Message state={state} />
      <Submit>Criar casal</Submit>
    </form>
  );
}

export function JoinCoupleForm() {
  const [state, action] = useActionState(joinCouple, undefined);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-semibold">Entrar com código</h2>
      <p className="text-sm text-zinc-500">Seu par já criou o casal? Use o código de convite.</p>
      <input className="input uppercase tracking-widest" name="code" placeholder="ABC123" required maxLength={6} />
      <Message state={state} />
      <Submit>Entrar no casal</Submit>
    </form>
  );
}
