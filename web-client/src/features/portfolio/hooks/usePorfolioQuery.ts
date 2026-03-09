import { useQuery } from "@tanstack/react-query";
import { walletService } from "../services/walletService";

export const usePortfolioQuery = () => {
  return useQuery({
    queryKey: ["portfolio"],
    queryFn: walletService.getMyWallet,
    staleTime: 5000, 
  });
};