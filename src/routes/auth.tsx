import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import logo from "@/assets/reflect-logo.png";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "دخول وحساب جديد — Reflect" },
      { name: "description", content: "سجّل دخولك في Reflect عشان تحفظ طلباتك وتتابعها لحد ما توصل." },
      { property: "og:title", content: "دخول وحساب جديد — Reflect" },
      { property: "og:description", content: "سجّل دخولك في Reflect عشان تحفظ طلباتك وتتابعها لحد ما توصل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const field =
  "w-full rounded-2xl border bg-muted/60 px-4 py-4 text-sm outline-none transition focus:border-primary focus:bg-card focus:ring-2 focus:ring-ring/30";

function AuthPage() {
  const { lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const ar = lang === "ar";
  const ADMIN_EMAIL = "reflect@gmail.com";
  const ADMIN_PASSWORD = "9090reflect@2027";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState(ADMIN_PASSWORD);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { redirect = "/" } = useSearch({ from: "/auth" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect as "/", replace: true });
    });
  }, [navigate, redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const isAdminAttempt = normalizedEmail === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD;

    try {
      if (mode === "signin" && isAdminAttempt) {
        const ensureAdmin = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { full_name: "Admin" }, emailRedirectTo: window.location.origin },
        });
        if (ensureAdmin.error && !ensureAdmin.error.message.toLowerCase().includes("already registered")) {
          throw ensureAdmin.error;
        }
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { full_name: name.trim() || "Admin" }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          const r = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
          if (r.error) throw r.error;
        }
        toast.success(ar ? "أهلاً بيك في Reflect 🎓" : "Welcome to Reflect 🎓");
      } else {
        const signIn = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (signIn.error) throw signIn.error;
        toast.success(ar ? "نورت تاني ✨" : "Welcome back ✨");
      }
      navigate({ to: redirect as "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const tabs: Array<["signin" | "signup", string]> = [
    ["signup", ar ? "حساب جديد" : "Sign up"],
    ["signin", ar ? "دخول" : "Sign in"],
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-8">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] bg-card shadow-soft md:grid-cols-2">
        <section className="order-2 p-6 sm:p-12 md:order-1">
          <div className="mb-6 flex gap-2">
            <button onClick={toggle} aria-label="Toggle theme"
              className="sk-icon-btn grid h-12 w-12 place-items-center rounded-2xl border bg-card">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button onClick={() => setLang(ar ? "en" : "ar")} aria-label="Toggle language"
              className="sk-icon-btn grid h-12 min-w-12 place-items-center rounded-2xl border bg-card px-3 font-bold">
              {ar ? "EN" : "ع"}
            </button>
          </div>

          <div role="tablist" className="mb-8 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1.5">
            {tabs.map(([m, label]) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                className={`rounded-xl py-3 text-lg font-bold transition ${mode === m ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-5">
            {mode === "signup" && (
              <label className="block">
                <span className="mb-2 block text-sm font-bold">{ar ? "الاسم" : "Name"}</span>
                <input className={field} value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
              </label>
            )}
            <label className="block">
              <span className="mb-2 block text-sm font-bold">{ar ? "الإيميل" : "Email"}</span>
              <input className={field} type="email" dir="ltr" placeholder="name@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">{ar ? "الباسورد" : "Password"}</span>
              <input className={field} type="password" dir="ltr" value={password}
                onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </label>
            <button type="submit" disabled={loading}
              className="bg-cta w-full rounded-2xl py-4 text-lg font-extrabold text-primary-foreground transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60">
              {loading ? "..." : tabs.find(([m]) => m === mode)![1]}
            </button>
          </form>
        </section>

        <section className="bg-panel relative order-1 flex flex-col p-8 text-primary-foreground sm:p-12 md:order-2">
          <div className="flex justify-end">
            <div className="rounded-2xl bg-card p-2">
              <img src={logo} alt="Reflect" className="h-16 w-16 object-contain" />
            </div>
          </div>
          <div className="mt-10 flex flex-1 flex-col justify-center text-center md:mt-0">
            <span className="mx-auto mb-5 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-5 py-2 text-xs font-extrabold tracking-wide">
              REFLECT • GRADUATION & APPAREL
            </span>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl">
              {ar ? "أول خطوة؟ حسابك." : "First step? Your account."}
            </h1>
            <p className="mt-4 text-base opacity-85 sm:text-lg">
              {ar ? "سجّل دخولك عشان تحفظ طلباتك وتتابعها لحد ما توصل 🎓" : "Sign in to save your orders and track them to your door 🎓"}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
