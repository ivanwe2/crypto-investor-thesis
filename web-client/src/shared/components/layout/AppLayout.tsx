import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { tokens, Text, Button, Avatar } from "@fluentui/react-components";
import { Board24Regular, Board24Filled, Wallet24Regular, Wallet24Filled, DataArea24Regular, DataArea24Filled, WeatherMoon24Regular, WeatherSunny24Regular } from "@fluentui/react-icons";
import { useThemeStore } from "../../store/themeStore";
import { useAuthStore } from "../../../features/auth/store/authStore";
import { ToastContainer } from "../toast/ToastContainer"; // Moved here!
import styles from "./AppLayout.module.scss";

export const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();
  const { username, token, logout } = useAuthStore();

  const navItems = [
    { path: "/", label: "Dashboard", activeIcon: <Board24Filled />, inactiveIcon: <Board24Regular /> },
    { path: "/portfolio", label: "Portfolio", activeIcon: <Wallet24Filled />, inactiveIcon: <Wallet24Regular /> },
    { path: "/orders", label: "Orders", activeIcon: <DataArea24Filled />, inactiveIcon: <DataArea24Regular /> },
  ];

  return (
    <div className={styles.appContainer} style={{ backgroundColor: tokens.colorNeutralBackground1 }}>
      <aside className={styles.sidebar} style={{ borderColor: tokens.colorNeutralStroke1 }}>
        <div className={styles.logo} style={{ borderColor: tokens.colorNeutralStroke2 }}>
          <div style={{ width: 32, height: 32, backgroundColor: tokens.colorBrandBackground, borderRadius: 6 }} />
          <Text size={500} weight="bold">CryptoThesis</Text>
        </div>

        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} style={{ textDecoration: "none" }}>
              <Button appearance={isActive ? "primary" : "subtle"} icon={isActive ? item.activeIcon : item.inactiveIcon} style={{ width: "100%", justifyContent: "flex-start", padding: "10px", marginBottom: "4px" }}>
                {item.label}
              </Button>
            </Link>
          );
        })}
      </aside>

      <main className={styles.mainContent}>
        <header className={styles.topbar} style={{ borderColor: tokens.colorNeutralStroke1 }}>
          <Text size={400} weight="semibold" style={{ color: tokens.colorNeutralForeground3 }}>Trading Environment: Live</Text>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            
            <Button 
              appearance="transparent" 
              icon={isDark ? <WeatherSunny24Regular /> : <WeatherMoon24Regular />} 
              onClick={toggleTheme}
              title="Toggle Theme"
            />
            
            {/* Clean Auth Handling in Topbar */}
            {token ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={logout}>
                <Avatar name={username || "User"} badge={{ status: "available" }} />
                <Text size={200} weight="medium">Logout</Text>
              </div>
            ) : (
              <Button appearance="primary" onClick={() => navigate('/login')}>
                Sign In
              </Button>
            )}
            
          </div>
        </header>

        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
      
      {/* ✨ GLOBAL TOAST CONTAINER - Works on all pages now! */}
      <ToastContainer />
    </div>
  );
};