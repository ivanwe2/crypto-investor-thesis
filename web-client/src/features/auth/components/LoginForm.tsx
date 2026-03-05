import { useState } from "react";
import { Button, Field, Input, Text, Link, Spinner } from "@fluentui/react-components";
import { authService } from "../services/authService";
import { useAuthStore } from "../store/authStore";
import styles from "./Auth.module.scss";

interface LoginFormProps {
  onSwitchMode: () => void;
}

export const LoginForm = ({ onSwitchMode }: LoginFormProps) => {
  const { login } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await authService.login({ username, password });
      login(response.token, response.username, response.userId);
    } catch (err: any) {
      setError(
        err.response?.data || "Login failed. Please check your credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <Text size={500} weight="semibold">🔑 Login</Text>
      
      <form
        onSubmit={handleSubmit}
        className={styles.formBody}
      >
        <Field label="Username">
          <Input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(_, data) => setUsername(data.value)}
            required
          />
        </Field>

        <Field 
          label="Password" 
          validationMessage={error} 
          validationState={error ? "error" : "none"}
        >
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(_, data) => setPassword(data.value)}
            required
          />
        </Field>

        <Button 
          type="submit" 
          appearance="primary" 
          disabled={loading} 
          className={styles.submitButton}
          icon={loading ? <Spinner size="tiny" /> : undefined}
        >
          {loading ? "Logging in..." : "Log In"}
        </Button>
      </form>

      <div className={styles.footer}>
        <Link as="button" onClick={onSwitchMode}>
          Need an account? Register here
        </Link>
      </div>
    </div>
  );
};