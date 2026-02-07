import { useNavigate } from "react-router-dom";

function CandidateLogin() {
  const navigate = useNavigate();

  const handleLogin = () => {
    // TEMP: backend auth later
    navigate("/candidate");
  };

  return (
    <div className="page centered">
      <div className="card stack auth-card">
        <h2>Candidate Login</h2>
        <input placeholder="Email" />
        <input type="password" placeholder="Password" />
        <button className="btn primary" onClick={handleLogin}>
          Login
        </button>
      </div>
    </div>
  );
}

export default CandidateLogin;
