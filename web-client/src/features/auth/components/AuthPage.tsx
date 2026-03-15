import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  tokens
} from "@fluentui/react-components";
import { authService } from "../services/authService"; // ✨ Fixed Import Path
import { useAuthStore } from "../store/authStore";     // ✨ Fixed Import Path

const useStyles = makeStyles({
  pageContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "80vh",
  },
  card: {
    width: "100%",
    maxWidth: "400px",
    backgroundColor: tokens.colorNeutralBackground1Hover,
    ...shorthands.padding("24px"),
  },
  formBody: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("16px"),
    ...shorthands.margin("24px", "0"),
  },
  footer: {
    display: "flex",
    justifyContent: "center",
    ...shorthands.margin("16px", "0", "0", "0"),
  }
});

export const AuthPage = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const { login, isAuthenticated, username } = useAuthStore();
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formUser, setFormUser] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (isAuthenticated()) {
    return (
      <div className={styles.pageContainer}>
        <Card className={styles.card}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "16px" }}>
            <Text size={500} weight="semibold">Welcome back, {username}!</Text>
            <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>You are already signed in.</Text>
            <Button appearance="primary" onClick={() => navigate('/')}>Go to Dashboard</Button>
          </div>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let response;
      if (isLoginMode) {
        response = await authService.login({ username: formUser, password });
      } else {
        response = await authService.register({ username: formUser, password });
      }
      
      login(response.token, response.username, response.userId);
      navigate('/'); 
      
    } catch (err: any) {
      setError(err.response?.data || `${isLoginMode ? "Login" : "Registration"} failed. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <Card className={styles.card}>
        <Text size={600} weight="semibold">
          {isLoginMode ? "🔑 Sign In" : "📝 Create Account"}
        </Text>
        
        <form onSubmit={handleSubmit} className={styles.formBody}>
          <Field label="Username" required>
            <Input
              type="text"
              placeholder="Enter your username"
              value={formUser}
              onChange={(_, data) => setFormUser(data.value)}
              disabled={loading}
            />
          </Field>

          <Field 
            label="Password" 
            required
            validationMessage={error} 
            validationState={error ? "error" : "none"}
          >
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(_, data) => setPassword(data.value)}
              disabled={loading}
            />
          </Field>

          <Button 
            type="submit" 
            appearance="primary" 
            disabled={loading} 
            icon={loading ? <Spinner size="tiny" /> : undefined}
            style={{ marginTop: "8px" }}
          >
            {loading 
              ? (isLoginMode ? "Signing in..." : "Creating Account...") 
              : (isLoginMode ? "Sign In" : "Create Account")}
          </Button>
        </form>

        <div className={styles.footer}>
          <Link as="button" onClick={() => {
            setIsLoginMode(!isLoginMode);
            setError("");
          }}>
            {isLoginMode 
              ? "Need an account? Register here" 
              : "Already have an account? Sign in"}
          </Link>
        </div>
      </Card>
    </div>
  );
};