import { useEffect, useState } from "react";
import ResumeUpload from "../components/ResumeUpload";
import CandidateForm from "../components/CandidateForm";
import { fetchHrJobDescription, fetchHrRoles } from "../services/api";

function CandidateLanding() {
  const [candidateData, setCandidateData] = useState(null);
  const [role, setRole] = useState("");
  const [jdData, setJdData] = useState(null);
  const [hrIdForRole, setHrIdForRole] = useState("");
  const [hrError, setHrError] = useState("");
  const [jdError, setJdError] = useState("");
  const [roleCatalog, setRoleCatalog] = useState([]);

  useEffect(() => {
    const loadHrAndRoles = async () => {
      setHrError("");
      try {
        const roleData = await fetchHrRoles();
        setRoleCatalog(Array.isArray(roleData) ? roleData : []);
      } catch (err) {
        setHrError("Hiring setup is not available right now. Please try again shortly.");
      }
    };
    loadHrAndRoles();
    const interval = setInterval(loadHrAndRoles, 5000);
    return () => clearInterval(interval);
  }, []);

  const availableRoles = Array.from(new Set(
    roleCatalog.map((item) => item.role).filter(Boolean)
  ));

  const selectedRoleEntry = roleCatalog.find((item) => item.role === role);
  const resolvedHrId = selectedRoleEntry ? String(selectedRoleEntry.hr_id) : "";

  useEffect(() => {
    if (!role) {
      setHrIdForRole("");
      return;
    }
    setHrIdForRole(resolvedHrId);
  }, [role, resolvedHrId]);

  useEffect(() => {
    if (hrIdForRole) {
      localStorage.setItem("candidateHrId", hrIdForRole);
    } else {
      localStorage.removeItem("candidateHrId");
    }
  }, [hrIdForRole]);

  useEffect(() => {
    const loadHrJd = async () => {
      if (!hrIdForRole || !role) {
        setJdData(null);
        setJdError("");
        return;
      }
      setJdError("");
      try {
        const data = await fetchHrJobDescription(hrIdForRole, role);
        setJdData({
          jd_text: data.jd_text || "",
          jd_filename: data.jd_filename || "",
        });
      } catch (err) {
        setJdData(null);
        setJdError(
          "Selected HR has not uploaded JD for this role yet. Please choose another HR or role."
        );
      }
    };
    loadHrJd();
  }, [hrIdForRole, role]);

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
              {availableRoles.map((roleValue) => (
                <option key={roleValue} value={roleValue}>
                  {roleValue
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
            {availableRoles.length === 0 && (
              <p className="helper">
                No active roles yet. Roles will appear here after HR adds role + JD.
              </p>
            )}
          </div>
          {role && !hrIdForRole && (
            <p className="helper">
              Role is not active yet. Ask HR to upload JD for this role.
            </p>
          )}
          {hrError && <p className="helper error">{hrError}</p>}
        </div>

        {/* RESUME UPLOAD */}
        <ResumeUpload setCandidateData={setCandidateData} />

        <div className="card stack">
          <h3>Job Description</h3>
          {hrIdForRole && role && jdData ? (
            <p>
              JD loaded for selected role: <strong>{jdData.jd_filename || "Uploaded JD"}</strong>
            </p>
          ) : (
            <p className="helper">
              Select a role to load its active JD uploaded by HR.
            </p>
          )}
          {jdError && <p className="helper error">{jdError}</p>}
        </div>

        {/* FORM */}
        {candidateData && role && hrIdForRole && jdData && (
          <CandidateForm
            candidateData={candidateData}
            role={role}
            hrId={Number(hrIdForRole)}
            jdData={jdData}
          />
        )}

        {(!role || !hrIdForRole || !jdData) && (
          <p className="helper error">
            Please select an active role with uploaded JD before submitting.
          </p>
        )}
      </div>
    </div>
  );
}

export default CandidateLanding;
