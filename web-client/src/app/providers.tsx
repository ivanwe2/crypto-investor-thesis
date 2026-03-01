import { FluentProvider, webDarkTheme } from "@fluentui/react-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Create a client for TanStack Query (Server State caching)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Apply Microsoft's Dark Theme globally to the whole app */}
      <FluentProvider 
        theme={webDarkTheme} 
        style={{ 
          minHeight: '100vh', 
          backgroundColor: webDarkTheme.colorNeutralBackground1,
          color: webDarkTheme.colorNeutralForeground1
        }}
      >
        {children}
      </FluentProvider>
    </QueryClientProvider>
  );
}