"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/app/actions";
import { Message, Submit } from "./form-bits";

export function AuthForm({ mode }: { mode: "login" | "cadastro" }) {
  const [state, action] = useActionState(mode === "login" ? login : register, undefined);
  return (
    <form action={action} className="card space-y-4">
      {mode === "cadastro" && (
        <div>
          <label className="label" htmlFor="name">Nome</label>
          <input className="input" id="name" name="name" required autoComplete="name" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Senha</label>
        <input
          className="input" id="password" name="password" type="password" required
          minLength={mode === "cadastro" ? 8 : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </div>
      <Message state={state} />
      <Submit className="btn w-full">{mode === "login" ? "Entrar" : "Criar conta"}</Submit>
      <p className="text-center text-sm text-zinc-500">
        {mode === "login" ? (
          <>Não tem conta? <Link className="font-medium text-emerald-600" href="/cadastro">Cadastre-se</Link></>
        ) : (
          <>Já tem conta? <Link className="font-medium text-emerald-600" href="/login">Entrar</Link></>
        )}
      </p>
    </form>
  );
}
