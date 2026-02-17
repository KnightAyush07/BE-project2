import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="page centered">
      <div className="hero">
        <h1>HireX</h1>
        <p>Smart screening, faster shortlists, and a calmer hiring workflow.</p>
        <div className="stack">
          <button
            className="btn primary"
            onClick={() => navigate("/candidate")}
          >
            Login as Candidate
          </button>
          <button className="btn secondary" onClick={() => navigate("/hr")}>
            Login as HR
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;
