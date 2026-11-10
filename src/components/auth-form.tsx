"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login, register } from "@/app/actions";
import { requestPasswordReset, resetPassword } from "@/app/actions-password";
import { Divider, GoogleButton, PasswordInput } from "./auth-bits";
import { Message, Submit } from "./form-bits";

function Card({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card space-y-5 p-6 shadow-xl shadow-zinc-900/5 sm:p-8 dark:shadow-black/30">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="muted mt-1 text-sm">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function AuthForm({ mode, googleEnabled, notice }: { mode: "login" | "cadastro"; googleEnabled: boolean; notice?: string }) {
  const [state, action] = useActionState(mode === "login" ? login : register, undefined);
  // Campos controlados: o React 19 limpa o formulário após cada envio,
  // e não queremos apagar o e-mail quando a senha está errada.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isLogin = mode === "login";

  return (
    <Card
      title={isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
      subtitle={isLogin ? "Entre para ver as contas do mês." : "Depois é só convidar seu par com um código."}
    >
      {notice && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">{notice}</p>}

      {googleEnabled && (
        <>
          <GoogleButton label={isLogin ? "Entrar com o Google" : "Cadastrar com o Google"} />
          <Divider text={isLogin ? "ou entre com e-mail" : "ou cadastre com e-mail"} />
        </>
      )}

      <form action={action} className="space-y-4">
        {!isLogin && (
          <div>
            <label className="label" htmlFor="name">Seu nome</label>
            <input className="input" id="name" name="name" required autoComplete="name" placeholder="Como seu par te chama" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="password">Senha</label>
            {isLogin && (
              <Link href="/esqueci-senha" className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
                Esqueci minha senha
              </Link>
            )}
          </div>
          <PasswordInput
            id="password" name="password" required
            minLength={isLogin ? undefined : 8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            placeholder={isLogin ? "Sua senha" : "Mínimo de 8 caracteres"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {!isLogin && <PasswordHint password={password} />}
        </div>
        <Message state={state} />
        <Submit className="btn w-full py-2.5">{isLogin ? "Entrar" : "Criar conta"}</Submit>
      </form>

      <p className="text-center text-sm text-zinc-500">
        {isLogin ? (
          <>Ainda não tem conta? <Link className="font-semibold text-blue-600 dark:text-blue-400" href="/cadastro">Cadastre-se</Link></>
        ) : (
          <>Já tem conta? <Link className="font-semibold text-blue-600 dark:text-blue-400" href="/login">Entrar</Link></>
        )}
      </p>
    </Card>
  );
}

function PasswordHint({ password }: { password: string }) {
  const checks = [password.length >= 8, /[A-Za-z]/.test(password) && /\d/.test(password), password.length >= 12];
  const score = checks.filter(Boolean).length;
  const colors = ["bg-zinc-200 dark:bg-zinc-700", "bg-red-500", "bg-amber-500", "bg-emerald-500"];
  const labels = ["", "Fraca", "Boa", "Forte"];
  if (!password) return null;
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${score >= i ? colors[score] : colors[0]}`} />)}
      </div>
      <span className="w-10 text-right text-[11px] text-zinc-500">{labels[score]}</span>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, undefined);
  const [email, setEmail] = useState("");
  return (
    <Card title="Esqueceu a senha?" subtitle="Informe seu e-mail e enviamos um link para criar uma nova.">
      {state?.ok ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">📬 {state.ok}</p>
          <Link href="/login" className="btn w-full py-2.5">Voltar para o login</Link>
        </div>
      ) : (
        <form action={action} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Message state={state} />
          <Submit className="btn w-full py-2.5">Enviar link</Submit>
          <p className="text-center text-sm text-zinc-500">
            Lembrou? <Link className="font-semibold text-blue-600 dark:text-blue-400" href="/login">Entrar</Link>
          </p>
        </form>
      )}
    </Card>
  );
}

export function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState(resetPassword, undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  return (
    <Card title="Crie uma nova senha" subtitle={<>Para a conta <b className="text-zinc-700 dark:text-zinc-200">{email}</b></>}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="label" htmlFor="password">Nova senha</label>
          <PasswordInput id="password" name="password" required minLength={8} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordHint password={password} />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Repita a nova senha</label>
          <PasswordInput id="confirm" name="confirm" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Message state={state} />
        <Submit className="btn w-full py-2.5">Salvar e entrar</Submit>
      </form>
    </Card>
  );
}
