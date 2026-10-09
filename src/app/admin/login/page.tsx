"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "bootstrap">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, key, password, mode }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to authenticate");
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authenticate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="card" style={{ maxWidth: 520, margin: "48px auto" }}>
        <small>CLOUDMART ADMIN</small>
        <h1>{mode === "bootstrap" ? "Set up an admin account" : "Admin sign in"}</h1>
        <p>
          Admin access needs two factors: the server-side admin access key configured for this
          deployment, and the password of the admin account.
        </p>
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="admin@example.com" required />
          <input value={key} onChange={(e) => setKey(e.target.value)} type="password" placeholder="Admin access key" required autoComplete="off" />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder={mode === "bootstrap" ? "Choose an admin password (8+ chars, letter + number)" : "Admin password"}
            autoComplete={mode === "bootstrap" ? "new-password" : "current-password"}
            required
          />
          {error && <div className="notice">{error}</div>}
          <button disabled={busy}>{busy ? "Authenticating…" : mode === "bootstrap" ? "Create admin & continue" : "Sign in"}</button>
        </form>
        <button type="button" onClick={() => setMode(mode === "login" ? "bootstrap" : "login")} style={{ marginTop: 12 }}>
          {mode === "login" ? "First deployment, or admin without a password yet?" : "I already have an admin password"}
        </button>
      </section>
    </main>
  );
}
