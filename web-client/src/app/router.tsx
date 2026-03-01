import { createBrowserRouter } from "react-router-dom";
import { Dashboard } from "../features/market/components/Dashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Dashboard />,
  },
  {
    path: "/portfolio",
    element: <div>Portfolio Page (Coming Soon)</div>,
  },
  {
    path: "/market/:symbol",
    element: <div>Market Detail Page (Coming Soon)</div>,
  }
]);