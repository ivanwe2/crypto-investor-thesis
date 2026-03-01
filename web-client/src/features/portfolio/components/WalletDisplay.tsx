import { useEffect } from "react";
import { Button, Text, Card, Spinner, tokens } from "@fluentui/react-components";
import { ArrowClockwise16Regular, SignOutRegular } from "@fluentui/react-icons";
import { useAuthStore } from "../../auth/store/authStore";
import { useWalletStore } from "../../portfolio/store/walletStore";
import styles from "./WalletDisplay.module.scss";

export const WalletDisplay = () => {
  const { username, logout } = useAuthStore();
  const { wallet, isLoading, fetchWallet, clearWallet } = useWalletStore();

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const handleLogout = () => {
    clearWallet();
    logout();
  };

  return (
    <div className={styles.walletContainer}>
      <div className={styles.walletHeader}>
        <Text size={500} weight="semibold">👤 Account</Text>
        <Button 
          icon={<SignOutRegular />} 
          appearance="subtle" 
          onClick={handleLogout}
          title="Log Out"
        />
      </div>
      
      <Text>
        Welcome back, <Text weight="bold">{username}</Text>!
      </Text>

      <Card className={styles.walletCard} style={{ backgroundColor: tokens.colorNeutralBackground2 }}>
        <div className={styles.walletCardHeader}>
          <Text weight="semibold">💰 Your Wallet</Text>
          <Button
            icon={isLoading ? <Spinner size="tiny" /> : <ArrowClockwise16Regular />}
            appearance="transparent"
            onClick={fetchWallet}
            disabled={isLoading}
            size="small"
            title="Refresh Wallet"
          />
        </div>

        {isLoading && !wallet ? (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Loading balances...</Text>
        ) : wallet && wallet.balances.length > 0 ? (
          <div className={styles.balanceList}>
            {wallet.balances.map((b) => (
              <div
                key={b.currency}
                className={styles.balanceItem}
                style={{ borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}
              >
                <Text>{b.currency}:</Text>
                <Text weight="bold">
                  {b.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </div>
            ))}
          </div>
        ) : (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Wallet is empty.</Text>
        )}
      </Card>
    </div>
  );
};