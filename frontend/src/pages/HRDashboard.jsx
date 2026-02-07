import { useEffect, useState } from "react";
import {
  fetchAllCandidates,
  shortlistCandidates,
  finalizeCandidates,
} from "../services/api";

function HRDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [role, setRole] = useState("java_dev");

  const getStatusClass = (status) => {
    if (!status) return "status-pill status-pending";
    const normalized = status.toLowerCase().replace(/[\s_]+/g, "-");
    return `status-pill status-${normalized}`;
  };

  const formatList = (items) => {
    if (!items || items.length === 0) return "-";
    return items.join(", ");
  };

  const formatTopicBreakdown = (breakdown) => {
    if (!breakdown || Object.keys(breakdown).length === 0) return "-";
    return Object.entries(breakdown)
      .map(
        ([topic, data]) =>
          `${topic}: ${data.correct}/${data.total} (${data.percentage}%)`
      )
      .join(" | ");
  };

  const loadCandidates = async () => {
    const data = await fetchAllCandidates();
    setCandidates(data);
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  return (
    <div className="page">
      <h2>HR Dashboard</h2>

      <div className="toolbar">
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="python_dev">Python Developer</option>
          <option value="fullstack_dev">Full Stack Developer</option>
          <option value="java_dev">Java Developer</option>
        </select>

        <button
          className="btn primary"
          onClick={async () => {
            await shortlistCandidates(role, 50);
            loadCandidates();
          }}
        >
          Shortlist Top 50
        </button>

        <button
          className="btn secondary"
          onClick={async () => {
            await finalizeCandidates(role, 10);
            loadCandidates();
          }}
        >
          Select Top 10
        </button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>ATS Score</th>
            <th>ATS Match %</th>
            <th>Skills Matched</th>
            <th>Skills Missing</th>
            <th>OA Score</th>
            <th>OA Status</th>
            <th>OA Topic Score</th>
            <th>Interview Score</th>
            <th>Interview Status</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {candidates.map((c, index) => {
            const statusLabel = c.status || "Pending";
            return (
              <tr key={index}>
                <td>{c.name}</td>
                <td>{c.role}</td>
                <td>{c.ats_score}</td>
                <td>{c.ats_match_percent ?? "-"}</td>
                <td>{formatList(c.ats_matched_skills)}</td>
                <td>{formatList(c.ats_missing_skills)}</td>
                <td>
                  {c.oa_score !== null && c.oa_total
                    ? `${c.oa_score}/${c.oa_total} (${c.oa_percentage}%)`
                    : "-"}
                </td>
                <td>
                  <span className={getStatusClass(c.oa_status)}>
                    {c.oa_status || "NOT_TAKEN"}
                  </span>
                </td>
                <td>{formatTopicBreakdown(c.oa_topic_breakdown)}</td>
                <td>
                  {c.interview_percentage !== null &&
                  c.interview_percentage !== undefined
                    ? `${c.interview_percentage}%`
                    : "-"}
                </td>
                <td>
                  <span className={getStatusClass(c.interview_status)}>
                    {c.interview_status || "NOT_TAKEN"}
                  </span>
                </td>
                <td>
                  <span className={getStatusClass(statusLabel)}>
                    {statusLabel}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default HRDashboard;
