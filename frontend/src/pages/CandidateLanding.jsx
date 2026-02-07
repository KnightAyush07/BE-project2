import { useState } from "react";
import ResumeUpload from "../components/ResumeUpload";
import CandidateForm from "../components/CandidateForm";

function CandidateLanding() {
  const [candidateData, setCandidateData] = useState(null);
  const [role, setRole] = useState("");

  return (
    <div className="page">
      <div className="stack">
        <h2>Candidate Application</h2>

        {/* ROLE SELECTION */}
        <div className="card stack">
          <div className="form-row">
            <label>Select Role:</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">-- Select Role --</option>
              <option value="python_dev">Python Developer</option>
              <option value="fullstack_dev">Full Stack Developer</option>
              <option value="java_dev">Java Developer</option>
            </select>
          </div>
        </div>

        {/* RESUME UPLOAD */}
        <ResumeUpload setCandidateData={setCandidateData} />

        {/* FORM */}
        {candidateData && role && (
          <CandidateForm candidateData={candidateData} role={role} />
        )}

        {!role && (
          <p className="helper error">
            Please select a role before submitting application.
          </p>
        )}
      </div>
    </div>
  );
}

export default CandidateLanding;
