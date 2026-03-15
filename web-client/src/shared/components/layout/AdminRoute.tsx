import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../../features/auth/store/authStore";

export const AdminRoute = () => {
  const { isAuthenticated, isAdmin } = useAuthStore();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};