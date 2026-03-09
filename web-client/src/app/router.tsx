import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../shared/components/layout/AppLayout";
import { Dashboard } from "../features/market/components/Dashboard";
import { ProtectedRoute } from "../shared/components/layout/ProtectedRoute";
import { PortfolioPage } from "../features/portfolio/components/Portfolio/PortfolioPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "portfolio",
            element: <PortfolioPage />,
          },
          {
            path: "orders",
            element: <div style={{ padding: "2rem" }}>Orders Page (Coming Soon)</div>,
          }
        ]
      }
    ]
  }
]);