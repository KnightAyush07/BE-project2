import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CandidateLanding from "./CandidateLanding";
import {
  checkCandidateStatus,
  loginUser,
  registerCandidate,
  checkOaEligibility,
  checkInterviewEligibility,
} from "../services/api";

function CandidatePage() {
  const navigate = useNavigate();
  const [oaEligible, setOaEligible] = useState(false);
  const [loadingEligibility, setLoadingEligibility] = useState(true);
  const [candidateStatus, setCandidateStatus] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [authEmail, setAuthEmail] = useState(
    localStorage.getItem("authEmail") || ""
  );
  const [authName, setAuthName] = useState(localStorage.getItem("authName") || "");
  const [authToken, setAuthToken] = useState(
    localStorage.getItem("authToken") || ""
  );
  const [authRole, setAuthRole] = useState(
    localStorage.getItem("authRole") || ""
  );
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [resolvedRole, setResolvedRole] = useState(
    localStorage.getItem("candidateRole") || "python_dev"
  );
  const [oaStatus, setOaStatus] = useState("NOT_TAKEN");
  const [interviewEligible, setInterviewEligible] = useState(false);
  const [interviewStatus, setInterviewStatus] = useState("NOT_TAKEN");
  const [hasApplication, setHasApplication] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const candidateEmail = authEmail || searchParams.get("email") || "";
  const candidateRole =
    searchParams.get("role") || resolvedRole || "python_dev";

  const checkOAEligibility = async () => {
    try {
      const data = await checkOaEligibility(candidateEmail);
      setOaEligible(data.eligible === true);
      setOaStatus((data.oa_status || "NOT_TAKEN").toUpperCase());
      if (data.role) {
        localStorage.setItem("candidateRole", data.role);
        setResolvedRole(data.role);
      }
    } catch (err) {
      console.error("Eligibility check failed", err);
    } finally {
      setLoadingEligibility(false);
    }
  };

  const checkInterviewGate = async () => {
    try {
      const data = await checkInterviewEligibility(candidateEmail);
      setInterviewEligible(data?.eligible === true);
      setInterviewStatus((data?.interview_status || "NOT_TAKEN").toUpperCase());
    } catch (_err) {
      setInterviewEligible(false);
      setInterviewStatus("NOT_TAKEN");
    }
  };

  const loadCandidateStatus = async () => {
    if (!candidateEmail) return;
    setStatusError("");
    try {
      const data = await checkCandidateStatus(candidateEmail);
      if (data?.error) {
        setStatusError(data.error);
        setHasApplication(false);
        return;
      }
      setHasApplication(true);
      setCandidateStatus(data);
    } catch (err) {
      setHasApplication(false);
      setStatusError("Unable to fetch status right now.");
    }
  };

  useEffect(() => {
    if (candidateEmail && authToken) {
      checkOAEligibility();
      checkInterviewGate();
      loadCandidateStatus();
      const interval = setInterval(() => {
        loadCandidateStatus();
        checkOAEligibility();
        checkInterviewGate();
      }, 3000);
      return () => clearInterval(interval);
    }
    setLoadingEligibility(false);
  }, [candidateEmail, authToken]);

  const handleLogin = async () => {
    setAuthError("");
    try {
      const data = await loginUser({ email: authEmail, password });
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("authRole", data.role);
      localStorage.setItem("authName", data.name || "");
      localStorage.setItem("authEmail", authEmail);
      setAuthToken(data.token);
      setAuthRole(data.role);
      setAuthName(data.name || "");
      setPassword("");
    } catch (err) {
      setAuthError(err.message || "Login failed.");
    }
  };

  const handleRegister = async () => {
    setAuthError("");
    try {
      await registerCandidate({ email: authEmail, password, name: authName });
      await handleLogin();
    } catch (err) {
      setAuthError(err.message || "Registration failed.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authRole");
    localStorage.removeItem("authName");
    localStorage.removeItem("authEmail");
    setAuthToken("");
    setAuthRole("");
    setAuthName("");
    setPassword("");
    setCandidateStatus(null);
  };

  const isCandidateLoggedIn = authToken && authRole === "CANDIDATE";

  return (
    <div className={`page ${isCandidateLoggedIn ? "" : "centered"}`.trim()}>
      {!isCandidateLoggedIn ? (
        <div className="card stack auth-card">
          <h3>Candidate Login / Register</h3>
          {authError && <p className="helper error">{authError}</p>}
          <div className="form-row">
            <label>Email</label>
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="candidate@email.com"
            />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
            />
          </div>
          <div className="form-row">
            <label>Full Name (for register)</label>
            <input
              type="text"
              value={authName}
              onChange={(e) => setAuthName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="toolbar">
            <button className="btn primary" onClick={handleLogin}>
              Login
            </button>
            <button className="btn secondary" onClick={handleRegister}>
              Register
            </button>
          </div>
        </div>
      ) : (
        <div className="card stack">
          <div className="toolbar">
            <strong>Welcome, {authName || authEmail}</strong>
            <button className="btn secondary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      )}

      {isCandidateLoggedIn && (
        <>
          <div className="card stack">
            <h3>Application Status</h3>
            {statusError && <p className="helper error">{statusError}</p>}
            <p>
              Status:{" "}
              <strong>{candidateStatus?.status || "UNDER_REVIEW"}</strong>
            </p>
            {candidateStatus?.message && <p>{candidateStatus.message}</p>}
            <p className="helper">Live status refreshes every 3 seconds.</p>
          </div>

          <div className="card stack">
            {loadingEligibility ? (
              <p>Checking eligibility...</p>
            ) : !hasApplication ? (
              <p>Upload resume and submit application first to unlock OA.</p>
            ) : interviewStatus === "PASS" || interviewStatus === "FAIL" ? (
              <p>
                Interview completed. Status: <strong>{interviewStatus}</strong>.
              </p>
            ) : oaEligible && oaStatus === "NOT_TAKEN" ? (
              <div className="stack">
                <p>Online assessment is available in this stage.</p>
                <button
                  className="btn primary"
                  onClick={() => navigate(`/oa/${candidateRole}`)}
                >
                  Start OA (MCQ)
                </button>
              </div>
            ) : !oaEligible && oaStatus === "NOT_TAKEN" ? (
              <p>OA is not available yet.</p>
            ) : oaStatus === "PASS" || oaStatus === "FAIL" ? (
              <div className="stack">
                <p>OA submitted. You can continue to the text AI interview now.</p>
                <button
                  className="btn primary"
                  onClick={() => navigate(`/interview/${candidateRole}`)}
                >
                  Start Interview
                </button>
              </div>
            ) : interviewEligible ? (
              <div className="stack">
                <p>Interview is available.</p>
                <button
                  className="btn primary"
                  onClick={() => navigate(`/interview/${candidateRole}`)}
                >
                  Start Online Text AI Interview
                </button>
              </div>
            ) : (
              <p>Status: Not shortlisted yet.</p>
            )}
          </div>
          {!hasApplication && <CandidateLanding />}
        </>
      )}
    </div>
  );
}

export default CandidatePage;
