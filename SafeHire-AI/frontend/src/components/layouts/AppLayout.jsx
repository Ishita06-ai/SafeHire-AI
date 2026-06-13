import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import { LayoutDashboard, Search, Shield, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { selectUser } from "../../app/store/authSlice";
import { useLogout } from "../../modules/auth/hooks/useAuth";
import { cn } from "../../utils/cn";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard",   group: "OVERVIEW"   },
  { to: "/analyze",   icon: Search,          label: "Analyze",      group: "MANAGEMENT" },
  { to: "/threats",   icon: Shield,          label: "Threat Intel", group: "MANAGEMENT" },
];

const NEON = "#A3FF12";

/* ───────────────── Scoped scrollbar + nav styles ───────────────── */
const SidebarStyles = () => (
  <style>{`
    .sh-sidebar-scroll::-webkit-scrollbar { width: 4px; }
    .sh-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
    .sh-sidebar-scroll::-webkit-scrollbar-thumb {
      background: rgba(163,255,18,0.3);
      border-radius: 999px;
    }
    .sh-sidebar-scroll { scrollbar-width: thin; scrollbar-color: rgba(163,255,18,0.3) transparent; }

    .sh-nav-item {
      position: relative;
      display: flex;
      align-items: center;
      gap: 14px;
      height: 52px;
      padding: 0 18px;
      border-radius: 16px;
      font-family: Inter, "Satoshi", "General Sans", system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: #B8B8B8;
      border: 1px solid transparent;
      background: transparent;
      transition: all 0.3s cubic-bezier(.4,0,.2,1);
      letter-spacing: -0.005em;
    }
    .sh-nav-item .sh-nav-icon { color: #8E8E8E; transition: color 0.3s cubic-bezier(.4,0,.2,1); }
    .sh-nav-item:hover {
      transform: translateX(4px);
      background: rgba(255,255,255,0.04);
      color: #fff;
    }
    .sh-nav-item:hover .sh-nav-icon { color: #fff; }

    .sh-nav-item.active {
      color: #fff;
      font-weight: 600;
      background: rgba(163,255,18,0.12);
      border-color: rgba(163,255,18,0.25);
      box-shadow: 0 0 20px rgba(163,255,18,0.15);
    }
    .sh-nav-item.active .sh-nav-icon { color: ${NEON}; }
    .sh-nav-item.active::before {
      content: "";
      position: absolute;
      left: -14px;
      top: 50%;
      transform: translateY(-50%);
      width: 4px;
      height: 28px;
      border-radius: 999px;
      background: ${NEON};
      box-shadow: 0 0 12px rgba(163,255,18,0.55);
    }
  `}</style>
);

export function AppLayout({ children }) {
  const user = useSelector(selectUser);
  const { mutate: logout } = useLogout();

  // Group nav items while preserving order
  const grouped = navItems.reduce((acc, item) => {
    const g = acc.find((x) => x.label === item.group);
    if (g) g.items.push(item);
    else acc.push({ label: item.group, items: [item] });
    return acc;
  }, []);

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#050505" }}>
      <SidebarStyles />

      {/* ───────────── Sidebar ───────────── */}
      <aside
        className="flex flex-col fixed h-full z-10"
        style={{
          width: 280,
          background:
            "linear-gradient(180deg, #050505 0%, #080808 50%, #0B0B0B 100%)",
          borderRight: "1px solid rgba(163,255,18,0.08)",
        }}
      >
        {/* Logo */}
        <div className="px-6 pt-7 pb-6">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: NEON,
                boxShadow: "0 0 25px rgba(163,255,18,0.25)",
              }}
            >
              <Shield className="w-5 h-5" style={{ color: "#000" }} strokeWidth={2.4} />
            </div>
            <div className="flex flex-col leading-tight">
              <span
                style={{
                  fontFamily: "Inter, Satoshi, sans-serif",
                  fontWeight: 700,
                  fontSize: "1rem",
                  letterSpacing: "-0.02em",
                  color: "#fff",
                }}
              >
                SafeHire AI
              </span>
              <span style={{ fontSize: 11, color: "#6A6A6A", letterSpacing: "0.06em" }}>
                Enterprise
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav
          className="sh-sidebar-scroll flex-1 overflow-y-auto px-4 pb-4"
          style={{ paddingLeft: 18, paddingRight: 18 }}
        >
          {grouped.map((group, gi) => (
            <div key={group.label} style={{ marginTop: gi === 0 ? 8 : 32 }}>
              <div
                className="px-2 mb-3"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#6A6A6A",
                }}
              >
                {group.label}
              </div>
              <div className="space-y-1.5">
                {group.items.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      cn("sh-nav-item", isActive && "active")
                    }
                  >
                    <Icon className="sh-nav-icon" style={{ width: 20, height: 20 }} strokeWidth={1.75} />
                    <span className="flex-1">{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Profile + Logout */}
        <div className="px-5 pb-5 pt-3">
          <div
            className="p-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 20,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center font-semibold"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background:
                    "linear-gradient(135deg, rgba(163,255,18,0.18), rgba(163,255,18,0.04))",
                  color: NEON,
                  border: "1px solid rgba(163,255,18,0.25)",
                  fontSize: 16,
                }}
              >
                {user?.fullName?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="truncate"
                  style={{ color: "#fff", fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em" }}
                >
                  {user?.fullName}
                </p>
                <p className="truncate" style={{ color: "#9A9A9A", fontSize: 12 }}>
                  {user?.email}
                </p>
              </div>
            </div>

            <button
              onClick={() => logout()}
              className="mt-3 w-full flex items-center justify-center gap-2 transition-all"
              style={{
                height: 40,
                borderRadius: 12,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#B8B8B8",
                fontSize: 13,
                fontWeight: 500,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 90, 90, 0.08)";
                e.currentTarget.style.borderColor = "rgba(255, 90, 90, 0.25)";
                e.currentTarget.style.color = "#FF7A7A";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                e.currentTarget.style.color = "#B8B8B8";
              }}
            >
              <LogOut style={{ width: 16, height: 16 }} strokeWidth={2} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ───────────── Main content ───────────── */}
      <main className="flex-1 min-h-screen" style={{ marginLeft: 280 }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="p-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
