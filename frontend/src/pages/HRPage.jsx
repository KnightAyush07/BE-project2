import { useEffect, useState } from "react";
import HRDashboard from "./HRDashboard";
import { getCurrentUser, loginUser } from "../services/api";

function HRPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authToken, setAuthToken] = useState(
    localStorage.getItem("authToken") || "",
  );
  const [authRole, setAuthRole] = useState(
    localStorage.getItem("authRole") || "",
  );

  const handleLogin = async () => {
    setAuthError("");
    try {
      const data = await loginUser({ email, password });
      if (data.role !== "HR") {
        setAuthError("Not an HR account.");
        return;
      }
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("authRole", data.role);
      localStorage.setItem("authName", data.name || "");
      localStorage.setItem("authEmail", email);
      setAuthToken(data.token);
      setAuthRole(data.role);
      setPassword("");
    } catch (err) {
      setAuthError(err.message || "Login failed.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authRole");
    localStorage.removeItem("authName");
    localStorage.removeItem("authEmail");
    setAuthToken("");
    setAuthRole("");
    setPassword("");
  };

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem("authToken");
      const role = localStorage.getItem("authRole");
      if (!token || role !== "HR") {
        handleLogout();
        return;
      }
      try {
        const user = await getCurrentUser();
        if (user.role !== "HR") {
          handleLogout();
        }
      } catch {
        handleLogout();
      }
    };
    validateToken();
  }, []);

  if (!authToken || authRole !== "HR") {
    return (
      <div className="page centered">
        <div className="card stack auth-card">
          <h3>HR Login</h3>
          {authError && <p className="helper error">{authError}</p>}

          <div className="form-row">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hr1@company.com"
            />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Hr@12345"
            />
          </div>

          <div className="toolbar">
            <button className="btn primary" onClick={handleLogin}>
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <HRDashboard onLogout={handleLogout} />;
}

export default HRPage;
