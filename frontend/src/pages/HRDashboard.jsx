import { useEffect, useMemo, useState } from "react";
import {
  fetchAllCandidates,
  fetchHrMetrics,
  finalizeCandidates,
  setCandidateDecision,
  shortlistCandidates,
  uploadHrJobDescription,
} from "../services/api";

const DEFAULT_ROLES = [];

function HRDashboard({ onLogout }) {
  const [candidates, setCandidates] = useState([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [rolePool, setRolePool] = useState(DEFAULT_ROLES);
  const [roleDraft, setRoleDraft] = useState("");
  const [jdFile, setJdFile] = useState(null);
  const [activeStage, setActiveStage] = useState("resume");
  const [metrics, setMetrics] = useState({
    active_roles: 0,
    total_applicants: 0,
    shortlisted: 0,
    oa_cleared: 0,
    final_selected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [resumeLimit, setResumeLimit] = useState(20);
  const [oaLimit, setOaLimit] = useState(5);
  const [interviewLimit, setInterviewLimit] = useState(5);

  const normalizeRole = (value) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s_]/g, "")
      .replace(/\s+/g, "_");

  const formatRole = (rawRole) => {
    if (!rawRole) return "Unknown Role";
    return rawRole
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatList = (items) => {
    if (!items || items.length === 0) return "-";
    return items.join(", ");
  };

  const formatStageLabel = (stage) => {
    const labels = {
      resume: "Resume Screening",
      oa: "OA Review",
      interview: "Interview Review",
      final: "Final Decision",
    };
    return labels[stage] || "Hiring Review";
  };

  const getStatusClass = (status) => {
    if (!status) return "status-pill status-pending";
    const normalized = status.toLowerCase().replace(/[\s_]+/g, "-");
    return `status-pill status-${normalized}`;
  };

  const loadCandidates = async () => {
    try {
      const data = await fetchAllCandidates();
      const rows = Array.isArray(data) ? data : [];
      setCandidates(rows);
      const rolesFromData = rows
        .map((row) => row.role)
        .filter(Boolean)
        .filter((value, index, arr) => arr.indexOf(value) === index);
      if (rolesFromData.length > 0) {
        setRolePool((prev) =>
          [...new Set([...prev, ...rolesFromData])].filter(Boolean)
        );
      }
      setError("");
    } catch (_err) {
      setCandidates([]);
      setError("Candidate pipeline is currently unavailable. Please refresh in a moment.");
    }
  };

  const roleStats = useMemo(() => {
    const map = {};
    for (const candidate of candidates) {
      const role = candidate.role || "unknown_role";
      map[role] = (map[role] || 0) + 1;
    }
    for (const role of rolePool) {
      if (!map[role]) map[role] = 0;
    }
    return map;
  }, [candidates, rolePool]);

  const roles = useMemo(() => Object.keys(roleStats), [roleStats]);

  const byRole = useMemo(() => {
    if (!selectedRole) return [];
    return candidates.filter((candidate) => candidate.role === selectedRole);
  }, [candidates, selectedRole]);

  const stageCandidates = useMemo(() => {
    if (activeStage === "resume") return byRole;
    if (activeStage === "oa") {
      return byRole.filter((candidate) => {
        const status = (candidate.oa_status || "").toUpperCase();
        return (
          candidate.oa_eligible === 1 ||
          candidate.oa_score !== null ||
          status === "PASS" ||
          status === "FAIL"
        );
      });
    }
    return byRole.filter((candidate) => {
      const status = (candidate.interview_status || "").toUpperCase();
      return (
        candidate.interview_eligible === 1 ||
        candidate.interview_score !== null ||
        status === "PASS" ||
        status === "FAIL" ||
        status === "APPROVED"
      );
    });
  }, [activeStage, byRole]);

  const fallbackMetrics = useMemo(() => {
    const shortlisted = byRole.filter((candidate) => candidate.oa_eligible === 1).length;
    const oaCleared = byRole.filter((candidate) => {
      const status = (candidate.oa_status || "").toUpperCase();
      return status === "PASS" || status === "CLEARED";
    }).length;
    const finalSelected = byRole.filter((candidate) => {
      const status = (candidate.status || "").toUpperCase();
      return status === "SELECTED";
    }).length;

    return {
      active_roles: roles.length,
      total_applicants: byRole.length,
      shortlisted,
      oa_cleared: oaCleared,
      final_selected: finalSelected,
    };
  }, [byRole, roles.length]);

  const summaryCards = [
    { key: "active_roles", label: "Active Roles", value: metrics.active_roles ?? fallbackMetrics.active_roles },
    { key: "total_applicants", label: "Total Applicants", value: metrics.total_applicants ?? fallbackMetrics.total_applicants },
    { key: "shortlisted", label: "Shortlisted", value: metrics.shortlisted ?? fallbackMetrics.shortlisted },
    { key: "oa_cleared", label: "OA Cleared", value: metrics.oa_cleared ?? fallbackMetrics.oa_cleared },
    { key: "final_selected", label: "Final Selected", value: metrics.final_selected ?? fallbackMetrics.final_selected },
  ];

  const funnel = useMemo(() => {
    const applied = byRole.length;
    const atsCleared = byRole.filter((candidate) => candidate.oa_eligible === 1).length;
    const oaPassed = byRole.filter((candidate) => {
      const status = (candidate.oa_status || "").toUpperCase();
      return status === "PASS" || status === "CLEARED";
    }).length;
    const interview = byRole.filter((candidate) => {
      const status = (candidate.interview_status || "").toUpperCase();
      return status === "PASS" || status === "CLEARED" || status === "APPROVED";
    }).length;
    const selected = byRole.filter((candidate) => {
      const status = (candidate.status || "").toUpperCase();
      return status === "SELECTED";
    }).length;
    return { applied, atsCleared, oaPassed, interview, selected };
  }, [byRole]);

  const loadMetrics = async (role) => {
    if (!role) return;
    try {
      const data = await fetchHrMetrics(role);
      setMetrics(data);
    } catch (_err) {
      setMetrics(fallbackMetrics);
    }
  };

  const refreshAll = async () => {
    await loadCandidates();
    await loadMetrics(selectedRole);
  };

  const runTop20Resume = async () => {
    if (!selectedRole) return;
    const limit = Math.max(1, Number(resumeLimit) || 1);
    setLoadingAction(true);
    try {
      await shortlistCandidates(selectedRole, limit);
      setToast(`Resume shortlisting complete: Top ${limit} moved to OA stage.`);
      await refreshAll();
    } catch (err) {
      setToast(err.message || "Resume shortlisting failed.");
    } finally {
      setLoadingAction(false);
    }
  };

  const runTop5Oa = async () => {
    const limit = Math.max(1, Number(oaLimit) || 1);
    const eligible = [...stageCandidates]
      .filter((candidate) => candidate.email)
      .sort(
        (a, b) =>
          Number(b.oa_percentage ?? b.oa_score ?? 0) - Number(a.oa_percentage ?? a.oa_score ?? 0)
      )
      .slice(0, limit);

    if (eligible.length === 0) {
      setToast("No OA candidates available for selection.");
      return;
    }

    setLoadingAction(true);
    try {
      for (const candidate of eligible) {
        await setCandidateDecision(candidate.email, "APPROVED");
      }
      setToast(`OA stage complete: Top ${eligible.length} moved to Interview stage.`);
      await refreshAll();
    } catch (err) {
      setToast(err.message || "OA selection failed.");
    } finally {
      setLoadingAction(false);
    }
  };

  const runTop5Interview = async () => {
    if (!selectedRole) return;
    const limit = Math.max(1, Number(interviewLimit) || 1);
    setLoadingAction(true);
    try {
      await finalizeCandidates(selectedRole, limit);
      setToast(`Interview stage complete: Top ${limit} marked as final selected.`);
      await refreshAll();
    } catch (err) {
      setToast(err.message || "Final selection failed.");
    } finally {
      setLoadingAction(false);
    }
  };

  const addRole = async () => {
    const normalized = normalizeRole(roleDraft);
    if (!normalized) {
      setToast("Enter a valid role name.");
      return;
    }

    if (!rolePool.includes(normalized)) {
      setRolePool((prev) => [...prev, normalized]);
    }

    setSelectedRole(normalized);
    setRoleDraft("");

    if (!jdFile) {
      setToast("Role added. Upload JD to activate this role.");
      return;
    }

    setLoadingAction(true);
    try {
      await uploadHrJobDescription(normalized, jdFile);
      setToast("Role created and JD uploaded successfully.");
      setJdFile(null);
    } catch (err) {
      setToast(err.message || "Role added but JD upload failed.");
    } finally {
      setLoadingAction(false);
    }
  };

  const getResumeLink = (candidate) => {
    const raw =
      candidate.resume_url ||
      candidate.resume_path ||
      candidate.resume_file ||
      candidate.resume_filename;
    if (!raw) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (raw.startsWith("/")) return `http://127.0.0.1:8000${raw}`;
    return `http://127.0.0.1:8000/uploads/${raw}`;
  };

  const getStageEmptyMessage = () => {
    if (!selectedRole) {
      return "No active role selected. Add a role and upload a JD to begin.";
    }
    if (byRole.length === 0) {
      return "No applicants yet for this role.";
    }
    if (activeStage === "oa") {
      return "No candidates have reached the OA stage yet.";
    }
    if (activeStage === "interview") {
      return "No candidates have reached the interview stage yet.";
    }
    return "No candidates are available in this stage.";
  };

  const getXaiForStage = (candidate) => {
    const stages = candidate?.xai?.stages || {};
    return stages[activeStage] || stages.final || null;
  };

  const getStageRecommendation = (candidate) => {
    const stageXai = getXaiForStage(candidate);
    return stageXai?.recommendation || "REVIEW";
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadCandidates();
      setLoading(false);
    };
    init();
    const interval = setInterval(loadCandidates, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedRole && roles.length > 0) {
      setSelectedRole(roles[0]);
    }
  }, [selectedRole, roles]);

  useEffect(() => {
    loadMetrics(selectedRole);
  }, [selectedRole, fallbackMetrics]);

  return (
    <div className="page hrcc-page">
      <div className="hrcc-header">
        <h2>{"\u{1F4CA} Hiring Command Center"}</h2>
        {onLogout && (
          <button className="btn hrcc-logout-btn" onClick={onLogout}>
            Logout
          </button>
        )}
      </div>

      {toast && <p className="helper">{toast}</p>}
      {error && <p className="helper error">{error}</p>}

      <section className="hrcc-role-create">
        <div className="form-row">
          <label>Add Role</label>
          <input
            type="text"
            value={roleDraft}
            onChange={(e) => setRoleDraft(e.target.value)}
            placeholder="Example: Data Analyst"
          />
        </div>
        <div className="form-row">
          <label>Upload JD (PDF)</label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setJdFile(e.target.files?.[0] || null)}
          />
        </div>
        <button className="btn hrcc-action-btn" onClick={addRole} disabled={loadingAction}>
          Add Role + JD
        </button>
      </section>

      <section className="hrcc-summary-grid">
        {summaryCards.map((card) => (
          <article className="hrcc-summary-card" key={card.key}>
            <p className="hrcc-card-value">{card.value ?? 0}</p>
            <p className="hrcc-card-label">{card.label}</p>
          </article>
        ))}
      </section>

      <section className="hrcc-role-section">
        {roles.map((role) => (
          <button
            key={role}
            className={`hrcc-role-card ${selectedRole === role ? "active" : ""}`}
            onClick={() => setSelectedRole(role)}
          >
            <strong>{formatRole(role)}</strong>
            <span>{roleStats[role] || 0} Applicants</span>
            <small>View Pipeline -&gt;</small>
          </button>
        ))}
      </section>

      <section className="hrcc-stage-bar">
        <button
          className={`hrcc-stage-btn ${activeStage === "resume" ? "active" : ""}`}
          onClick={() => setActiveStage("resume")}
        >
          Resume Shortlisting
        </button>
        <button
          className={`hrcc-stage-btn ${activeStage === "oa" ? "active" : ""}`}
          onClick={() => setActiveStage("oa")}
        >
          OA Stage
        </button>
        <button
          className={`hrcc-stage-btn ${activeStage === "interview" ? "active" : ""}`}
          onClick={() => setActiveStage("interview")}
        >
          Interview Stage
        </button>
      </section>

      <section className="hrcc-stage-actions">
        <div className="form-row">
          <label>Resume Top N</label>
          <input
            type="number"
            min={1}
            value={resumeLimit}
            onChange={(e) => setResumeLimit(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label>OA Top N</label>
          <input
            type="number"
            min={1}
            value={oaLimit}
            onChange={(e) => setOaLimit(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label>Interview Top N</label>
          <input
            type="number"
            min={1}
            value={interviewLimit}
            onChange={(e) => setInterviewLimit(e.target.value)}
          />
        </div>
        {activeStage === "resume" && (
          <button className="btn hrcc-action-btn" onClick={runTop20Resume} disabled={loadingAction || !selectedRole}>
            Select Top {Math.max(1, Number(resumeLimit) || 1)} for OA
          </button>
        )}
        {activeStage === "oa" && (
          <button className="btn hrcc-action-btn" onClick={runTop5Oa} disabled={loadingAction || stageCandidates.length === 0}>
            Select Top {Math.max(1, Number(oaLimit) || 1)} for Interview
          </button>
        )}
        {activeStage === "interview" && (
          <button className="btn hrcc-action-btn" onClick={runTop5Interview} disabled={loadingAction || !selectedRole}>
            Select Top {Math.max(1, Number(interviewLimit) || 1)} Final
          </button>
        )}
      </section>

      <section className="hrcc-table-shell">
        <table className="table hrcc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>ATS Score</th>
              <th>Skills Matched</th>
              <th>OA Score</th>
              <th>OA Tab Switches</th>
              <th>Interview Status</th>
              <th>Interview Tab Switches</th>
              <th>Final Status</th>
              <th>XAI</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10}>Loading candidates...</td>
              </tr>
            )}
            {!loading && stageCandidates.length === 0 && (
              <tr>
                <td colSpan={10}>{getStageEmptyMessage()}</td>
              </tr>
            )}
            {!loading &&
              stageCandidates.map((candidate) => (
                <tr key={candidate.id || candidate.email}>
                  <td>{candidate.name || "-"}</td>
                  <td>{candidate.ats_score ?? candidate.ats_match_percent ?? "-"}</td>
                  <td>{formatList(candidate.ats_matched_skills)}</td>
                  <td>
                    {candidate.oa_score !== null && candidate.oa_total
                      ? `${candidate.oa_score}/${candidate.oa_total}`
                      : "-"}
                  </td>
                  <td>{candidate.oa_tab_switches ?? 0}</td>
                  <td>
                    <span className={getStatusClass(candidate.interview_status)}>
                      {candidate.interview_status || "NOT_TAKEN"}
                    </span>
                  </td>
                  <td>{candidate.interview_tab_switches ?? 0}</td>
                  <td>
                    <span className={getStatusClass(candidate.status)}>
                      {candidate.status || "PENDING"}
                    </span>
                  </td>
                  <td>
                    <button className="btn secondary" onClick={() => setSelectedCandidate(candidate)}>
                      {getStageRecommendation(candidate)}
                    </button>
                  </td>
                  <td>
                    <button className="btn hrcc-action-btn" onClick={() => setSelectedCandidate(candidate)}>
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section className="hrcc-funnel">
        <div>
          <p>Applied</p>
          <strong>{funnel.applied}</strong>
        </div>
        <span>-&gt;</span>
        <div>
          <p>ATS Cleared</p>
          <strong>{funnel.atsCleared}</strong>
        </div>
        <span>-&gt;</span>
        <div>
          <p>OA Passed</p>
          <strong>{funnel.oaPassed}</strong>
        </div>
        <span>-&gt;</span>
        <div>
          <p>Interview</p>
          <strong>{funnel.interview}</strong>
        </div>
        <span>-&gt;</span>
        <div>
          <p>Selected</p>
          <strong>{funnel.selected}</strong>
        </div>
      </section>

      <div
        className={`hrcc-overlay ${selectedCandidate ? "open" : ""}`}
        onClick={() => setSelectedCandidate(null)}
      />
      <aside className={`hrcc-side-panel ${selectedCandidate ? "open" : ""}`}>
        <div className="hrcc-side-header">
          <h3>Candidate Details</h3>
          <button className="btn secondary" onClick={() => setSelectedCandidate(null)}>
            Close
          </button>
        </div>

        {selectedCandidate && (
          <div className="hrcc-side-content">
            <section>
              <h4>Candidate Info</h4>
              <p><strong>Name:</strong> {selectedCandidate.name || "-"}</p>
              <p><strong>Email:</strong> {selectedCandidate.email || "-"}</p>
              <p><strong>Phone:</strong> {selectedCandidate.phone || "-"}</p>
              {getResumeLink(selectedCandidate) ? (
                <a href={getResumeLink(selectedCandidate)} target="_blank" rel="noreferrer">
                  Resume preview / download
                </a>
              ) : (
                <p>Resume preview link not available from API.</p>
              )}
            </section>

            <section>
              <h4>ATS Details</h4>
              <p><strong>ATS Score:</strong> {selectedCandidate.ats_score ?? selectedCandidate.ats_match_percent ?? "-"}</p>
              <p><strong>Skills Matched:</strong> {formatList(selectedCandidate.ats_matched_skills)}</p>
              <p><strong>Skills Missing:</strong> {formatList(selectedCandidate.ats_missing_skills)}</p>
              <p><strong>Education:</strong> {formatList(selectedCandidate.education)}</p>
            </section>

            <section>
              <h4>OA Details</h4>
              <p>
                <strong>OA Score:</strong>{" "}
                {selectedCandidate.oa_score !== null && selectedCandidate.oa_total
                  ? `${selectedCandidate.oa_score}/${selectedCandidate.oa_total} (${selectedCandidate.oa_percentage ?? 0}%)`
                  : "-"}
              </p>
              <p><strong>OA Status:</strong> {selectedCandidate.oa_status || "NOT_TAKEN"}</p>
              <p><strong>OA Tab Switches:</strong> {selectedCandidate.oa_tab_switches ?? 0}</p>
            </section>

            <section>
              <h4>Interview Details</h4>
              <p><strong>Interview Score:</strong> {selectedCandidate.interview_score ?? "-"}</p>
              <p><strong>Interview Status:</strong> {selectedCandidate.interview_status || "NOT_TAKEN"}</p>
              <p><strong>Interview Tab Switches:</strong> {selectedCandidate.interview_tab_switches ?? 0}</p>
            </section>

            <section>
              <h4>XAI Snapshot</h4>
              {getXaiForStage(selectedCandidate) ? (
                <>
                  <p>
                    <strong>Stage:</strong> {formatStageLabel(activeStage)}
                  </p>
                  <p>
                    <strong>Recommendation:</strong>{" "}
                    {getXaiForStage(selectedCandidate).recommendation}
                  </p>
                  <p>
                    <strong>Summary:</strong> {getXaiForStage(selectedCandidate).summary}
                  </p>
                  <p>
                    <strong>Why this recommendation:</strong>{" "}
                    {(getXaiForStage(selectedCandidate).rationale || []).join(" ") || "-"}
                  </p>
                  <p>
                    <strong>Strengths:</strong>{" "}
                    {(getXaiForStage(selectedCandidate).strengths || []).join(" ") || "-"}
                  </p>
                  <p>
                    <strong>Concerns:</strong>{" "}
                    {(getXaiForStage(selectedCandidate).concerns || []).join(" ") || "-"}
                  </p>
                  <p>
                    <strong>Next step:</strong>{" "}
                    {(getXaiForStage(selectedCandidate).next_steps || []).join(" ") || "-"}
                  </p>
                  <p>
                    <strong>Surrogate advance probability:</strong>{" "}
                    {selectedCandidate?.xai?.model_explanations?.advance_probability ?? "-"}%
                  </p>
                  <p>
                    <strong>SHAP top factors:</strong>{" "}
                    {(
                      selectedCandidate?.xai?.model_explanations?.shap_top_features || []
                    )
                      .map(
                        (item) =>
                          `${item.feature} (${item.direction}, impact ${item.impact})`
                      )
                      .join(" ") || "-"}
                  </p>
                  <p>
                    <strong>LIME local rules:</strong>{" "}
                    {(
                      selectedCandidate?.xai?.model_explanations?.lime_local_rules || []
                    )
                      .map(
                        (item) =>
                          `${item.feature_rule} (${item.direction}, weight ${item.weight})`
                      )
                      .join(" ") || "-"}
                  </p>
                </>
              ) : (
                <p>No XAI explanation available for this candidate yet.</p>
              )}
            </section>
          </div>
        )}
      </aside>

      <div className="hrcc-footer-note">
        <span>Selected role: {formatRole(selectedRole)}</span>
      </div>
    </div>
  );
}

export default HRDashboard;
