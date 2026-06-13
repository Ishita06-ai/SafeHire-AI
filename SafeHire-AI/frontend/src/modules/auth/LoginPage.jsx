/**
 * modules/auth/LoginPage.jsx
 *
 * FORM PATTERN: React Hook Form + Zod
 * - useForm() manages form state (no useState per field)
 * - zodResolver connects Zod schema to RHF for validation
 * - register() connects inputs to RHF without onChange handlers
 * - handleSubmit() only calls onSubmit if validation passes
 * - formState.errors contains field-level errors automatically
 *
 * UI REDESIGN: SafeHire AI — dark cyber-intelligence aesthetic.
 * Auth logic, API calls, validation, routing, and OAuth are unchanged.
 */

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import {
  Mail,
  Lock,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Fingerprint,
  Scan,
  Activity,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useLogin } from "./hooks/useAuth";

// Zod validation schema — mirrors backend validation
const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export default function LoginPage() {
  const { mutate: login, isPending } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data) => login(data);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#040404] text-white antialiased">
      {/* ── Background FX ──────────────────────────────────────────── */}
      <BackgroundFX />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* ── Left: form column ───────────────────────────────────── */}
        <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
          {/* Top bar */}
          <header className="flex items-center justify-between">
            <Link to="/" className="group flex items-center gap-2.5">
              <div className="relative grid h-9 w-9 place-items-center rounded-xl border border-[rgba(163,255,18,0.25)] bg-[rgba(163,255,18,0.08)] shadow-[0_0_24px_rgba(163,255,18,0.15)]">
                <ShieldCheck className="h-4 w-4 text-[#A3FF12]" strokeWidth={2.25} />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#A3FF12] shadow-[0_0_10px_#A3FF12]" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-bold tracking-tight">SafeHire AI</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                  Trust Intelligence
                </div>
              </div>
            </Link>

            <Link
              to="/"
              className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 backdrop-blur-md transition-colors hover:text-white sm:flex"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to home
            </Link>
          </header>

          {/* Glass Card */}
          <main className="flex flex-1 items-center justify-center py-12">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-[460px]"
            >
              <div className="pointer-events-none absolute -inset-px rounded-[34px] bg-[radial-gradient(120%_80%_at_50%_0%,rgba(163,255,18,0.18),transparent_60%)]" />
              <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[44px] bg-[radial-gradient(60%_60%_at_50%_50%,rgba(163,255,18,0.12),transparent_70%)] blur-2xl" />

              <div className="relative rounded-[32px] border border-[rgba(163,255,18,0.15)] bg-[rgba(10,10,10,0.78)] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(163,255,18,0.08)] backdrop-blur-2xl sm:p-10">
                {/* Tag row */}
                <div className="mb-6 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(163,255,18,0.25)] bg-[rgba(163,255,18,0.08)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A3FF12]">
                    <Sparkles className="h-3 w-3" /> SOC 2 · Type II
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
                    Encrypted Session
                  </span>
                </div>

                <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em]">
                  Welcome back
                </h1>
                <p className="mt-2 text-sm text-white/55">
                  Access your Secure Hiring Intelligence Platform.
                </p>

                <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4">
                  {/* Email */}
                  <Field
                    label="Work email"
                    icon={<Mail className="h-4 w-4" />}
                    error={errors.email?.message}
                  >
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="name@company.com"
                      leftIcon={<Mail className="h-4 w-4" />}
                      className="h-14 rounded-xl border-white/[0.06] bg-white/[0.03] pl-11 text-[15px] text-white placeholder:text-white/30 shadow-none transition-all focus-visible:border-[#A3FF12] focus-visible:shadow-[0_0_24px_rgba(163,255,18,0.18)] focus-visible:ring-0"
                      {...register("email")}
                    />
                  </Field>

                  {/* Password */}
                  <Field
                    label="Password"
                    icon={<Lock className="h-4 w-4" />}
                    error={errors.password?.message}
                    trailing={
                      <Link
                        to="/forgot-password"
                        className="text-xs font-medium text-white/55 transition-colors hover:text-[#A3FF12]"
                      >
                        Forgot?
                      </Link>
                    }
                  >
                    <Input
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      leftIcon={<Lock className="h-4 w-4" />}
                      className="h-14 rounded-xl border-white/[0.06] bg-white/[0.03] pl-11 text-[15px] text-white placeholder:text-white/30 shadow-none transition-all focus-visible:border-[#A3FF12] focus-visible:shadow-[0_0_24px_rgba(163,255,18,0.18)] focus-visible:ring-0"
                      {...register("password")}
                    />
                  </Field>

                  <label className="flex select-none items-center gap-2 pt-1 text-xs text-white/55">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 rounded-[5px] border-white/20 bg-white/5 accent-[#A3FF12]"
                    />
                    Keep me signed in on this trusted device
                  </label>

                  <Button
                    type="submit"
                    disabled={isPending}
                    className="group mt-2 flex h-13 w-full items-center justify-center gap-1 rounded-full bg-[#A3FF12] py-3.5 text-[15px] font-semibold tracking-tight text-black transition-all hover:-translate-y-0.5 hover:bg-[#B8FF2E] hover:shadow-[0_12px_40px_rgba(163,255,18,0.35)] disabled:opacity-70"
                  >
                    {isPending ? "Verifying…" : "Secure Login"}
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </form>

                {/* Divider */}
                <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-white/30">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  or continue with
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <SsoButton label="Google" />
                  <SsoButton label="Microsoft" />
                </div>

                {/* Trust strip */}
                <ul className="mt-7 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-white/55">
                  {[
                    "Enterprise Security",
                    "End-to-End Encryption",
                    "AI-Powered Verification",
                    "GDPR Compliant",
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#A3FF12]" />
                      {t}
                    </li>
                  ))}
                </ul>

                <p className="mt-7 text-center text-xs text-white/45">
                  Don't have an account?{" "}
                  <Link to="/signup" className="font-semibold text-[#A3FF12] hover:underline">
                    Request access
                  </Link>
                </p>
              </div>
            </motion.div>
          </main>

          <footer className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/35">
            <span>© {new Date().getFullYear()} SafeHire AI · All rights reserved.</span>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white/60">Privacy</a>
              <a href="#" className="hover:text-white/60">Security</a>
              <a href="#" className="hover:text-white/60">Status</a>
            </div>
          </footer>
        </div>

        {/* ── Right: visual panel ─────────────────────────────────── */}
        <aside className="relative hidden lg:block">
          <SidePanel />
        </aside>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Sub-components                                                       */
/* ──────────────────────────────────────────────────────────────────── */

function Field({ label, icon, error, trailing, children }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">
          {label}
        </label>
        {trailing}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-white/40">
          {icon}
        </span>
        {children}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400/90">{error}</p>}
    </div>
  );
}

function SsoButton({ label }) {
  return (
    <button
      type="button"
      className="group flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-medium text-white/85 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-[rgba(163,255,18,0.3)] hover:bg-white/[0.05] hover:text-white"
    >
      {label === "Google" ? <GoogleGlyph /> : <MicrosoftGlyph />}
      {label}
    </button>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 11.9S6.8 21.3 12 21.3c6.9 0 9.5-4.8 9.5-7.3 0-.5-.1-.9-.1-1.3H12z"
      />
    </svg>
  );
}

function MicrosoftGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <rect x="2" y="2" width="9" height="9" fill="#F25022" />
      <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
      <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
      <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function BackgroundFX() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_30%,#0d1408_0%,#040404_55%,#020202_100%)]" />
      <div className="absolute -left-40 top-10 h-[520px] w-[520px] rounded-full bg-[#A3FF12]/20 blur-[140px]" />
      <div className="absolute left-1/3 top-1/2 h-[380px] w-[380px] -translate-y-1/2 rounded-full bg-[#A3FF12]/10 blur-[160px]" />
      <div className="absolute -right-40 bottom-0 h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-[160px]" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M 44 0 L 0 0 0 44" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/80 to-transparent" />
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay [background-image:radial-gradient(rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:3px_3px]" />
    </>
  );
}

function SidePanel() {
  return (
    <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
      <div className="pointer-events-none absolute right-[-180px] top-1/2 h-[680px] w-[680px] -translate-y-1/2 rounded-full border border-[rgba(163,255,18,0.12)]" />
      <div className="pointer-events-none absolute right-[-280px] top-1/2 h-[880px] w-[880px] -translate-y-1/2 rounded-full border border-[rgba(163,255,18,0.06)]" />
      <div className="pointer-events-none absolute right-[-100px] top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(163,255,18,0.18),transparent_70%)] blur-2xl" />

      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/60 backdrop-blur-md">
          <Activity className="h-3 w-3 text-[#A3FF12]" /> Live trust signal
        </span>
        <h2 className="mt-6 max-w-md text-[40px] font-extrabold leading-[1.02] tracking-[-0.03em]">
          Hire with verified
          <br />
          <span className="text-[#A3FF12]">cyber intelligence.</span>
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-white/55">
          SafeHire AI screens every candidate through identity proofing, fraud
          detection, and adaptive risk scoring — in real time.
        </p>
      </div>

      <div className="relative mt-10 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-[rgba(163,255,18,0.25)] bg-[rgba(163,255,18,0.12)]">
                <Fingerprint className="h-5 w-5 text-[#A3FF12]" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-white/45">
                  Trust Score
                </div>
                <div className="text-2xl font-bold tracking-tight">
                  98<span className="text-base text-white/40">/100</span>
                </div>
              </div>
            </div>
            <span className="rounded-full bg-[rgba(163,255,18,0.12)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#A3FF12]">
              Verified
            </span>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#A3FF12] to-[#7be022]"
              style={{ width: "98%" }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
          className="grid grid-cols-2 gap-4"
        >
          <MiniStat
            icon={<Scan className="h-4 w-4 text-[#A3FF12]" />}
            label="Identity Checks"
            value="12,481"
            delta="+4.2%"
          />
          <MiniStat
            icon={<ShieldCheck className="h-4 w-4 text-[#A3FF12]" />}
            label="Fraud Blocked"
            value="319"
            delta="-1.8%"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-[0.16em] text-white/45">
              AI Insights · Last 24h
            </span>
            <span className="text-[#A3FF12]">● Live</span>
          </div>
          <div className="mt-4 flex h-20 items-end gap-1.5">
            {[40, 62, 48, 70, 55, 82, 64, 90, 72, 88, 76, 95].map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className="flex-1 rounded-sm bg-gradient-to-t from-[#A3FF12]/15 to-[#A3FF12]/80"
              />
            ))}
          </div>
        </motion.div>
      </div>

      <div className="relative mt-10 flex items-center gap-6 text-[11px] text-white/35">
        <span>Trusted by 2,400+ enterprise teams</span>
        <div className="h-3 w-px bg-white/10" />
        <span>SOC 2 · ISO 27001 · GDPR</span>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, delta }) {
  const positive = delta.startsWith("+");
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">
          {label}
        </span>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-xl font-bold tracking-tight">{value}</span>
        <span
          className={`text-[11px] font-medium ${
            positive ? "text-[#A3FF12]" : "text-white/55"
          }`}
        >
          {delta}
        </span>
      </div>
    </div>
  );
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
