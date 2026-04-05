import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { tokens, Text, Button, Avatar } from "@fluentui/react-components";
import {
  Board24Regular,
  Board24Filled,
  Wallet24Regular,
  Wallet24Filled,
  DataArea24Regular,
  DataArea24Filled,
  WeatherMoon24Regular,
  WeatherSunny24Regular,
  HeartPulse24Regular,
  HeartPulse24Filled,
  ArrowTrendingLines24Regular,
} from "@fluentui/react-icons";
import { useThemeStore } from "../../store/themeStore";
import { useAuthStore } from "../../../features/auth/store/authStore";
import { ToastContainer } from "../toast/ToastContainer";
import styles from "./AppLayout.module.scss";

export const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();

  const { username, token, logout, isAdmin } = useAuthStore();

  const navItems = [
    { path: "/", label: "Dashboard", activeIcon: <Board24Filled />, inactiveIcon: <Board24Regular />, show: true },
    { path: "/portfolio", label: "Portfolio", activeIcon: <Wallet24Filled />, inactiveIcon: <Wallet24Regular />, show: true },
    { path: "/orders", label: "Orders", activeIcon: <DataArea24Filled />, inactiveIcon: <DataArea24Regular />, show: true },
    { path: "/admin/health", label: "System Health", activeIcon: <HeartPulse24Filled />, inactiveIcon: <HeartPulse24Regular />, show: isAdmin() },
  ];

  return (
    <div className={styles.appContainer}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>
            <ArrowTrendingLines24Regular />
          </div>
          <Text
            size={500}
            weight="bold"
            style={{ fontFamily: "var(--ct-font-sans)", letterSpacing: "-0.02em" }}
          >
            CryptoThesis
          </Text>
        </div>

        {navItems.filter(item => item.show).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
            >
              {isActive ? item.activeIcon : item.inactiveIcon}
              {item.label}
            </Link>
          );
        })}
      </aside>

      {/* ── Main Content ── */}
      <main className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.liveIndicator}>
              <span className={styles.liveDot} />
              Live Trading
            </div>
          </div>

          <div className={styles.topbarRight}>
            <Button
              appearance="transparent"
              icon={isDark ? <WeatherSunny24Regular /> : <WeatherMoon24Regular />}
              onClick={toggleTheme}
              title="Toggle Theme"
              size="small"
            />

            {token ? (
              <div className={styles.userChip} onClick={logout}>
                <Avatar
                  name={username || "User"}
                  size={28}
                  color="brand"
                />
                <Text size={200} weight="medium" style={{ color: tokens.colorNeutralForeground3 }}>
                  {username}
                </Text>
              </div>
            ) : (
              <Button
                appearance="primary"
                size="small"
                onClick={() => navigate('/login')}
                style={{ borderRadius: 20, paddingLeft: 16, paddingRight: 16 }}
              >
                Sign In
              </Button>
            )}
          </div>
        </header>

        <div className={styles.content}>
          <Outlet />
        </div>
      </main>

      <ToastContainer />
    </div>
  );
};
