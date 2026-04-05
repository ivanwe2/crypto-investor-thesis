import { FluentProvider } from "@fluentui/react-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { useThemeStore } from "../shared/store/themeStore";
import { emeraldDarkTheme, emeraldLightTheme } from "../shared/theme/brandTheme";

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

export function AppProviders({ children }: { children: ReactNode }) {
  const isDark = useThemeStore((state) => state.isDark);
  const activeTheme = isDark ? emeraldDarkTheme : emeraldLightTheme;

  // Sync data-theme attribute for CSS custom properties
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <QueryClientProvider client={queryClient}>
      <FluentProvider
        theme={activeTheme}
        style={{
          minHeight: '100vh',
          backgroundColor: activeTheme.colorNeutralBackground1,
          color: activeTheme.colorNeutralForeground1
        }}
      >
        {children}
      </FluentProvider>
    </QueryClientProvider>
  );
}
