"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, CardContent, CardHeader } from "@andes/ui";

import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const inputClassName =
    "mt-1 w-full rounded-md border border-input bg-card px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold tracking-tight">Andes</span>
            <span className="text-xl font-light text-muted-foreground">
              Platform
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === "sign-in"
              ? "Sign in to your account"
              : "Create your account"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === "sign-up" && (
              <label className="block text-sm">
                <span className="text-foreground">Name</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClassName}
                />
              </label>
            )}
            <label className="block text-sm">
              <span className="text-foreground">Email</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="block text-sm">
              <span className="text-foreground">Password</span>
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClassName}
              />
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "…" : mode === "sign-in" ? "Sign in" : "Sign up"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            className="mt-4 text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            {mode === "sign-in"
              ? "No account yet? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </CardContent>
      </Card>
    </main>
  );
}
