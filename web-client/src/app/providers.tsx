import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useThemeStore } from "../shared/store/themeStore";

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

export function AppProviders({ children }: { children: ReactNode }) {
  const isDark = useThemeStore((state) => state.isDark);
  const activeTheme = isDark ? webDarkTheme : webLightTheme;

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