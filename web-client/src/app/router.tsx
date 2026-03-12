import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../shared/components/layout/AppLayout";
import { Dashboard } from "../features/market/components/Dashboard/Dashboard";
import { ProtectedRoute } from "../shared/components/layout/ProtectedRoute";
import { PortfolioPage } from "../features/portfolio/components/Portfolio/PortfolioPage";
import { MarketDetailPage } from "../features/market/components/MarketDetails/MarketDetails";
import { OrdersPage } from "../features/trading/components/Orders/OrdersPage";

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
            element: <OrdersPage />,
          },
          {
            path: "market/:symbol",
            element: <MarketDetailPage />,
          },
        ],
      },
    ],
  },
]);
