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
  tokens
} from "@fluentui/react-components";
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
  const [apiError, setApiError] = useState("");

  // ✨ Phase v0.8: React Hook Form Initialization
  const { control, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      username: "",
      password: "",
    },
    mode: "onTouched", // Validate fields as the user interacts with them
  });

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

  // ✨ Phase v0.8: Handled by React Hook Form (only fires if Zod validation passes)
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
    reset(); // Clear form errors when switching modes
  };

  return (
    <div className={styles.pageContainer}>
      <Card className={styles.card}>
        <Text size={600} weight="semibold">
          {isLoginMode ? "🔑 Sign In" : "📝 Create Account"}
        </Text>
        
        {apiError && (
          <div style={{ marginTop: "16px", padding: "12px", backgroundColor: tokens.colorPaletteRedBackground1, borderRadius: "4px" }}>
            <Text style={{ color: tokens.colorPaletteRedForeground1 }}>{apiError}</Text>
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
                  placeholder="••••••••"
                  disabled={isSubmitting}
                />
              </Field>
            )}
          />

          <Button 
            type="submit" 
            appearance="primary" 
            disabled={isSubmitting} 
            icon={isSubmitting ? <Spinner size="tiny" /> : undefined}
            style={{ marginTop: "8px" }}
          >
            {isSubmitting 
              ? (isLoginMode ? "Signing in..." : "Creating Account...") 
              : (isLoginMode ? "Sign In" : "Create Account")}
          </Button>
        </form>

        <div className={styles.footer}>
          <Link as="button" onClick={toggleMode}>
            {isLoginMode 
              ? "Need an account? Register here" 
              : "Already have an account? Sign in"}
          </Link>
        </div>
      </Card>
    </div>
  );
};