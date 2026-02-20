import { useState } from "react";
import { authService } from "../../services/authService";
import { useAuthStore } from "../../store/authStore";

interface RegisterFormProps {
  onSwitchMode: () => void;
}

export const RegisterForm = ({ onSwitchMode }: RegisterFormProps) => {
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
      const response = await authService.register({ username, password });
      login(response.token, response.username, response.userId);
    } catch (err: any) {
      setError(err.response?.data || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <h3>📝 Register</h3>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "10px" }}
      >
        <input
          type="text"
          placeholder="Choose a Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={inputStyle}
          required
        />
        <input
          type="password"
          placeholder="Choose a Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          required
        />
        {error && (
          <div style={{ color: "red", fontSize: "0.85rem" }}>{error}</div>
        )}
        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Creating Account..." : "Create Account"}
        </button>
      </form>
      <div
        style={{ marginTop: "10px", fontSize: "0.85rem", textAlign: "center" }}
      >
        <button type="button" onClick={onSwitchMode} style={linkButtonStyle}>
          Already have an account? Log in here
        </button>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  padding: "8px",
  borderRadius: "4px",
  border: "1px solid #ccc",
  width: "100%",
  boxSizing: "border-box",
};
const buttonStyle: React.CSSProperties = {
  padding: "10px",
  backgroundColor: "#007bff",
  color: "white",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "bold",
};
const linkButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#007bff",
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
};
