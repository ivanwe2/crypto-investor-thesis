import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Button,
  Field,
  Input,
  Text,
  Link,
  Spinner,
  Card,
  makeStyles,
  shorthands,
} from "@fluentui/react-components";
import { ArrowTrendingLines24Regular } from "@fluentui/react-icons";
import { authService } from "../services/authService";
import { useAuthStore } from "../store/authStore";

const authSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username is too long"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type AuthFormValues = z.infer<typeof authSchema>;

const useStyles = makeStyles({
  pageContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "80vh",
  },
  card: {
    width: "100%",
    maxWidth: "380px",
    backgroundColor: "var(--ct-bg-raised)",
    ...shorthands.border("1px", "solid", "var(--ct-border)"),
    ...shorthands.borderRadius("var(--ct-radius-xl)"),
    ...shorthands.padding("32px"),
    boxShadow: "var(--ct-shadow-elevated)",
    animation: "ct-scale-in 0.4s ease-out both",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...shorthands.gap("10px"),
    ...shorthands.margin("0", "0", "28px", "0"),
  },
  logoMark: {
    width: "36px",
    height: "36px",
    ...shorthands.borderRadius("10px"),
    background: "linear-gradient(135deg, #10B981, #059669)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 20px rgba(16,185,129,0.3)",
  },
  title: {
    fontFamily: "var(--ct-font-sans)",
    letterSpacing: "-0.02em",
    textAlign: "center",
    display: "block",
    ...shorthands.margin("0", "0", "4px", "0"),
  },
  subtitle: {
    fontFamily: "var(--ct-font-sans)",
    color: "var(--ct-text-muted)",
    textAlign: "center",
    display: "block",
  },
  formBody: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("16px"),
    ...shorthands.margin("20px", "0"),
  },
  errorBox: {
    ...shorthands.padding("10px", "14px"),
    backgroundColor: "var(--ct-bearish-dim)",
    ...shorthands.border("1px", "solid", "rgba(239,68,68,0.2)"),
    ...shorthands.borderRadius("var(--ct-radius-md)"),
  },
  footer: {
    display: "flex",
    justifyContent: "center",
    ...shorthands.margin("16px", "0", "0", "0"),
  },
  submitBtn: {
    height: "42px",
    fontFamily: "var(--ct-font-sans)",
    fontWeight: "600",
    fontSize: "14px",
    ...shorthands.borderRadius("var(--ct-radius-md)"),
    marginTop: "4px",
  },
});

export const AuthPage = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const { login, isAuthenticated, username } = useAuthStore();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [apiError, setApiError] = useState("");

  const { control, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { username: "", password: "" },
    mode: "onTouched",
  });

  if (isAuthenticated()) {
    return (
      <div className={styles.pageContainer}>
        <Card className={styles.card}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "16px" }}>
            <Text size={500} weight="semibold" style={{ fontFamily: "var(--ct-font-sans)" }}>
              Welcome back, {username}!
            </Text>
            <Text size={300} style={{ color: "var(--ct-text-muted)" }}>
              You are already signed in.
            </Text>
            <Button appearance="primary" onClick={() => navigate('/')} className={styles.submitBtn}>
              Go to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const onSubmit = async (data: AuthFormValues) => {
    setApiError("");
    try {
      let response;
      if (isLoginMode) {
        response = await authService.login(data);
      } else {
        response = await authService.register(data);
      }

      login(response.token, response.username, response.userId);
      navigate('/');
    } catch (err: any) {
      setApiError(err.response?.data || `${isLoginMode ? "Login" : "Registration"} failed. Please try again.`);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setApiError("");
    reset();
  };

  return (
    <div className={styles.pageContainer}>
      <Card className={styles.card}>
        <div className={styles.logoRow}>
          <div className={styles.logoMark}>
            <ArrowTrendingLines24Regular style={{ color: "white", fontSize: 20 }} />
          </div>
          <Text size={500} weight="bold" style={{ fontFamily: "var(--ct-font-sans)", letterSpacing: "-0.02em" }}>
            CryptoThesis
          </Text>
        </div>

        <Text size={600} weight="semibold" className={styles.title}>
          {isLoginMode ? "Sign In" : "Create Account"}
        </Text>
        <Text size={300} className={styles.subtitle}>
          {isLoginMode ? "Welcome back to the terminal" : "Join the trading simulation"}
        </Text>

        {apiError && (
          <div className={styles.errorBox} style={{ marginTop: 16 }}>
            <Text style={{ color: "var(--ct-bearish)", fontSize: "13px" }}>{apiError}</Text>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formBody}>
          <Controller
            name="username"
            control={control}
            render={({ field }) => (
              <Field
                label="Username"
                required
                validationMessage={errors.username?.message}
                validationState={errors.username ? "error" : "none"}
              >
                <Input
                  {...field}
                  type="text"
                  placeholder="Enter your username"
                  disabled={isSubmitting}
                  style={{ fontFamily: "var(--ct-font-sans)" }}
                />
              </Field>
            )}
          />

          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <Field
                label="Password"
                required
                validationMessage={errors.password?.message}
                validationState={errors.password ? "error" : "none"}
              >
                <Input
                  {...field}
                  type="password"
                  placeholder="Enter your password"
                  disabled={isSubmitting}
                  style={{ fontFamily: "var(--ct-font-sans)" }}
                />
              </Field>
            )}
          />

          <Button
            type="submit"
            appearance="primary"
            disabled={isSubmitting}
            icon={isSubmitting ? <Spinner size="tiny" /> : undefined}
            className={styles.submitBtn}
          >
            {isSubmitting
              ? (isLoginMode ? "Signing in..." : "Creating Account...")
              : (isLoginMode ? "Sign In" : "Create Account")}
          </Button>
        </form>

        <div className={styles.footer}>
          <Link as="button" onClick={toggleMode} style={{ fontSize: "13px" }}>
            {isLoginMode
              ? "Need an account? Register here"
              : "Already have an account? Sign in"}
          </Link>
        </div>
      </Card>
    </div>
  );
};
