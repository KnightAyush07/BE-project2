import { Link } from "react-router-dom";

function RoleSelect() {
  return (
    <div className="page centered">
      <div className="hero">
        <h1>HireX</h1>
        <p>Pick how you want to continue.</p>
        <Link to="/candidate-login">
          <button className="btn primary">Login as Candidate</button>
        </Link>
      </div>
    </div>
  );
}

export default RoleSelect;
