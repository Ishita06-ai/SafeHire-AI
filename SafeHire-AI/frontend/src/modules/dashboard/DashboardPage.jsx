// modules/dashboard/DashboardPage.jsx
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip,
} from "recharts";
import {
  Shield, AlertTriangle, TrendingUp, TrendingDown,
  FileSearch, ArrowRight, ArrowUpRight, Plus, Sparkles,
} from "lucide-react";

import { AppLayout }    from "../../components/layouts/AppLayout";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { RiskBadge }    from "../../components/ui/RiskBadge";
import { Button }       from "../../components/ui/Button";
import { analysisApi }  from "../../services/api/analysis.api";
import { QUERY_KEYS, RISK_LEVELS } from "../../constants";
import { selectUser }   from "../../app/store/authSlice";
import { cn }           from "../../utils/cn";

/* ──────────────────────────────────────────────────────────────
   Design tokens (Payflow / Linear / Mercury — black + neon green)
   ────────────────────────────────────────────────────────────── */
const NEON       = "#A3FF12";
const NEON_SOFT  = "rgba(163,255,18,0.25)";
const NEON_LINE  = "rgba(163,255,18,0.12)";
const SURFACE    = "rgba(15,15,15,0.95)";
const TEXT_DIM   = "#8A8A8A";
const TEXT_BODY  = "#D0D0D0";

const RISK_COLORS = {
  LOW:      "#A3FF12",
  MEDIUM:   "#F5C518",
  HIGH:     "#FF8A3D",
  CRITICAL: "#FF4D5E",
};

/* Shared glass card style */
const cardBase =
  "relative overflow-hidden rounded-3xl backdrop-blur-xl transition-all duration-300";
const cardStyle = {
  background: SURFACE,
  border: `1px solid ${NEON_LINE}`,
  boxShadow:
    "0 0 0 1px rgba(163,255,18,0.05), 0 10px 40px rgba(0,0,0,0.5)",
};

/* ──────────────────────────────────────────────────────────────
   StatCard
   ────────────────────────────────────────────────────────────── */
function StatCard({ title, value, icon: Icon, accent = NEON, trend, trendLabel, isLoading }) {
  if (isLoading) return <CardSkeleton />;
  const isUp = trend === undefined ? null : trend >= 0;

  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn(cardBase, "group p-6")}
      style={cardStyle}
    >
      {/* corner neon glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-60 blur-3xl transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(closest-side, ${NEON_SOFT}, transparent 70%)` }}
      />
      {/* hairline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${NEON_LINE}, transparent)` }}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: TEXT_DIM }}>
            {title}
          </p>
          <p className="mt-3 text-4xl font-bold tracking-tight text-white">
            {value ?? "—"}
          </p>
        </div>

        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl border"
          style={{
            background: "rgba(163,255,18,0.08)",
            borderColor: NEON_LINE,
            color: accent,
          }}
        >
          {Icon ? <Icon className="h-5 w-5" /> : null}
        </div>
      </div>

      <div className="relative mt-6 flex items-center justify-between">
        {trend !== undefined ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
            style={{
              borderColor: isUp ? NEON_LINE : "rgba(255,255,255,0.08)",
              color: isUp ? NEON : "#FF8A8A",
              background: isUp ? "rgba(163,255,18,0.06)" : "rgba(255,77,94,0.06)",
            }}
          >
            {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {isUp ? "+" : ""}{trend}%
            <span style={{ color: TEXT_DIM }} className="ml-1 font-normal">
              {trendLabel ?? "vs last week"}
            </span>
          </span>
        ) : <span />}

        {/* faint sparkline baseline */}
        <svg viewBox="0 0 120 24" className="h-6 w-28 opacity-70">
          <defs>
            <linearGradient id="sl" x1="0" x2="1">
              <stop offset="0%"  stopColor={NEON} stopOpacity="0" />
              <stop offset="50%" stopColor={NEON} stopOpacity="0.8" />
              <stop offset="100%" stopColor={NEON} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 18 L20 14 L40 16 L60 8 L80 12 L100 6 L120 10"
            fill="none"
            stroke="url(#sl)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Panel wrapper
   ────────────────────────────────────────────────────────────── */
function Panel({ children, className }) {
  return (
    <div className={cn(cardBase, "p-6", className)} style={cardStyle}>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const user = useSelector(selectUser);

  const { data: statsData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.STATS,
    queryFn:  () => analysisApi.getStats().then((r) => r.data.data),
  });

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: [...QUERY_KEYS.CONVERSATIONS, { page: 1, limit: 5 }],
    queryFn:  () => analysisApi.getConversations({ page: 1, limit: 5 }).then((r) => r.data),
  });

  const pieData = statsData
    ? Object.entries(statsData.byRiskLevel).map(([level, count]) => ({
        name:  RISK_LEVELS[level]?.label || level,
        value: count,
        color: RISK_COLORS[level],
      }))
    : [];

  return (
    <AppLayout>
      <div
        className="relative min-h-full px-6 py-10"
        style={{
          background:
            "radial-gradient(1200px 600px at 80% -10%, rgba(163,255,18,0.10), transparent 60%)," +
            "radial-gradient(900px 500px at -10% 20%, rgba(163,255,18,0.06), transparent 60%)," +
            "#050505",
        }}
      >
        {/* Header */}
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
              style={{ borderColor: NEON_LINE, background: "rgba(163,255,18,0.06)", color: NEON }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: NEON }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: NEON }} />
              </span>
              Live · Safety intelligence
            </div>

            <h1
              className="mt-4 font-bold tracking-tight text-white"
              style={{ fontSize: "clamp(2.25rem, 4vw, 3.25rem)", lineHeight: 1.02, letterSpacing: "-0.04em" }}
            >
              Good day, <span style={{ color: NEON }}>{user?.fullName?.split(" ")[0]}</span> 👋
            </h1>
            <p className="mt-3 text-base" style={{ color: TEXT_BODY }}>
              Here's your safety intelligence overview
            </p>
          </div>

          <Link to="/analyses/new">
            <Button
              className="!rounded-full !px-6 !py-3 !font-semibold"
              style={{
                background: NEON,
                color: "#050505",
                boxShadow: `0 0 30px ${NEON_SOFT}`,
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Analysis
            </Button>
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Analyses"  value={statsData?.total}        icon={FileSearch}     trend={12}  isLoading={isLoading} />
          <StatCard title="Safe Conversations" value={statsData?.safe}      icon={Shield}         trend={8}   isLoading={isLoading} />
          <StatCard title="High Risk"       value={statsData?.highRisk}     icon={AlertTriangle}  trend={-4}  isLoading={isLoading} />
          <StatCard title="This Week"       value={statsData?.thisWeek}     icon={Sparkles}       trend={23}  isLoading={isLoading} />
        </div>

        {/* Charts + Recent */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* Risk distribution */}
          <Panel className="lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Risk Distribution</h2>
              <span className="text-xs uppercase tracking-wider" style={{ color: TEXT_DIM }}>
                All time
              </span>
            </div>

            {pieData.length > 0 ? (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        innerRadius={58}
                        outerRadius={86}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="rgba(0,0,0,0.4)"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#0B0B0B",
                          border: `1px solid ${NEON_LINE}`,
                          borderRadius: 12,
                          color: "#fff",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 space-y-2">
                  {pieData.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-xl px-3 py-2"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color, boxShadow: `0 0 10px ${item.color}80` }} />
                        <span className="text-sm" style={{ color: TEXT_BODY }}>{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-56 items-center justify-center text-sm" style={{ color: TEXT_DIM }}>
                No analyses yet
              </div>
            )}
          </Panel>

          {/* Recent analyses */}
          <Panel className="lg:col-span-3">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent Analyses</h2>
              <Link
                to="/analyses"
                className="inline-flex items-center gap-1 text-sm font-medium transition-colors"
                style={{ color: NEON }}
              >
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {listLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl" style={{ background: "rgba(255,255,255,0.03)" }} />
                ))}
              </div>
            ) : listData?.data?.length > 0 ? (
              <div className="space-y-2">
                {listData.data.map((item) => (
                  <Link key={item._id} to={`/analyses/${item._id}`}>
                    <motion.div
                      whileHover={{ x: 4 }}
                      className="group flex items-center justify-between rounded-2xl border p-4 transition-all"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        borderColor: "rgba(255,255,255,0.05)",
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold uppercase"
                          style={{
                            background: "rgba(163,255,18,0.08)",
                            border: `1px solid ${NEON_LINE}`,
                            color: NEON,
                          }}
                        >
                          {item.platform?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{item.platform}</p>
                          <p className="text-xs" style={{ color: TEXT_DIM }}>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {item.riskLevel && <RiskBadge level={item.riskLevel} />}
                        <ArrowUpRight
                          className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          style={{ color: TEXT_DIM }}
                        />
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <FileSearch className="mb-3 h-10 w-10" style={{ color: TEXT_DIM }} />
                <p className="text-sm font-medium text-white">No analyses yet</p>
                <Link to="/analyses/new" className="mt-3 text-sm font-medium" style={{ color: NEON }}>
                  Start your first analysis →
                </Link>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </AppLayout>
  );
}
