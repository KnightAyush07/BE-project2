import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAllCandidates,
  fetchHrMetrics,
  finalizeCandidates,
  uploadHrJobDescription,
} from "../services/api";

const DEFAULT_ROLES = [];

const CARD_META = {
  active_roles:      { icon: "💼" },
  total_applicants:  { icon: "👥" },
  shortlisted:       { icon: "✅" },
  oa_cleared:        { icon: "📝" },
  final_selected:    { icon: "🏆" },
};

const toPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
};

const friendlyFeatureName = (value = "") =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const simplifyRule = (rule = "") =>
  rule
    .replace(/_/g, " ")
    .replace(/[<>]=?/g, (match) =>
      match.includes(">") ? "is above" : "is below",
    )
    .replace(/\s+/g, " ")
    .trim();

function XaiSnapshot({ stageLabel, stageXai, modelExplanations }) {
  const [showTechnical, setShowTechnical] = useState(false);
  const shapFeatures = modelExplanations?.shap_top_features || [];
  const limeRules = modelExplanations?.lime_local_rules || [];
  const probability = toPercent(modelExplanations?.advance_probability);

  if (!stageXai) {
    return <p>No XAI explanation available for this candidate yet.</p>;
  }

  return (
    <div className="xai-snapshot">
      <div className="xai-section xai-recommendation">
        <span className="xai-icon">💡</span>
        <div>
          <h4>Recommendation</h4>
          <p>
            <strong>{stageXai.recommendation || "REVIEW"}</strong> for{" "}
            {stageLabel}.
          </p>
        </div>
      </div>

      <div className="xai-section">
        <span className="xai-icon">📋</span>
        <div>
          <h4>Overall Summary</h4>
          <p>{stageXai.summary || "No summary available yet."}</p>
        </div>
      </div>

      <div className="xai-section">
        <span className="xai-icon">✅</span>
        <div>
          <h4>Strengths</h4>
          <ul>
            {(stageXai.strengths || ["No standout strengths listed yet."]).map(
              (item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ),
            )}
          </ul>
        </div>
      </div>

      <div className="xai-section">
        <span className="xai-icon">⚠</span>
        <div>
          <h4>Concerns</h4>
          <ul>
            {(stageXai.concerns || ["No major concerns listed yet."]).map(
              (item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ),
            )}
          </ul>
        </div>
      </div>

      <div className="xai-section">
        <span className="xai-icon">➡</span>
        <div>
          <h4>Next Step</h4>
          <ul>
            {(stageXai.next_steps || ["Continue review with the available scores."]).map(
              (item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ),
            )}
          </ul>
        </div>
      </div>

      <div className="xai-section">
        <span className="xai-icon">📈</span>
        <div>
          <h4>Selection Probability</h4>
          <div className="xai-meter">
            <span style={{ width: `${probability}%` }} />
          </div>
          <p>{probability ? `${probability}% likely to advance` : "Not enough model data yet."}</p>
        </div>
      </div>

      <div className="xai-section">
        <span className="xai-icon">📊</span>
        <div>
          <h4>Feature Importance (SHAP)</h4>
          <div className="xai-bars">
            {shapFeatures.length === 0 && <p>No SHAP factors available yet.</p>}
            {shapFeatures.map((item, index) => {
              const impact = Math.min(100, Math.abs(Number(item.impact) || 0));
              const isPositive = (item.direction || "").toLowerCase() !== "negative";
              return (
                <div className="xai-bar-row" key={`${item.feature}-${index}`}>
                  <div>
                    <strong>{friendlyFeatureName(item.feature)}</strong>
                    <span>{isPositive ? "Positive contribution" : "Negative contribution"}</span>
                  </div>
                  <div className={`xai-bar ${isPositive ? "positive" : "negative"}`}>
                    <span style={{ width: `${impact}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="xai-section">
        <span className="xai-icon">💡</span>
        <div>
          <h4>Decision Rules (LIME)</h4>
          <ul>
            {limeRules.length === 0 && <li>No LIME rules available yet.</li>}
            {limeRules.map((item, index) => (
              <li key={`${item.feature_rule}-${index}`}>
                {simplifyRule(item.feature_rule)}{" "}
                {(item.direction || "").toLowerCase() === "negative"
                  ? "may reduce confidence."
                  : "supports moving forward."}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        className="btn secondary xai-technical-toggle"
        type="button"
        onClick={() => setShowTechnical((prev) => !prev)}
      >
        {showTechnical ? "Hide Technical Details" : "Show Technical Details"}
      </button>

      {showTechnical && (
        <pre className="xai-technical">
          {JSON.stringify({ stageXai, modelExplanations }, null, 2)}
        </pre>
      )}
    </div>
  );
}

function HRDashboard({ onLogout }) {
  const [candidates, setCandidates] = useState([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [rolePool, setRolePool] = useState(DEFAULT_ROLES);
  const [roleDraft, setRoleDraft] = useState("");
  const [jdFile, setJdFile] = useState(null);
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
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const headerRef = useRef(null);

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
          [...new Set([...prev, ...rolesFromData])].filter(Boolean),
        );
      }
      setError("");
    } catch (err) {
      setCandidates([]);
      const message =
        err?.message ||
        "Candidate pipeline is currently unavailable. Please refresh in a moment.";
      const normalized = message.toLowerCase();
      if (
        normalized.includes("unauthorized") ||
        normalized.includes("forbidden") ||
        normalized.includes("missing token") ||
        normalized.includes("invalid token")
      ) {
        setError("Session expired or unauthorized. Please login again.");
        if (onLogout) {
          onLogout();
        }
        return;
      }
      setError(message);
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

  // All candidates for the selected role, sorted by overall score
  const filteredStageCandidates = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const base = query
      ? byRole.filter((c) =>
          [c.name, c.email, c.status, c.oa_status, c.interview_status]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(query))
        )
      : byRole;
    return [...base].sort((a, b) => {
      const score = (c) =>
        Number(c.ats_score ?? c.ats_match_percent ?? 0) * 0.4 +
        Number(c.oa_percentage ?? (c.oa_total ? (c.oa_score / c.oa_total) * 100 : 0)) * 0.35 +
        Number(c.interview_score ?? 0) * 0.25;
      return score(b) - score(a);
    });
  }, [searchTerm, byRole]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStageCandidates.length / pageSize),
  );

  const paginatedStageCandidates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStageCandidates.slice(start, start + pageSize);
  }, [currentPage, filteredStageCandidates]);

  const fallbackMetrics = useMemo(() => {
    const shortlisted = byRole.filter(
      (candidate) => candidate.oa_eligible === 1,
    ).length;
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
    {
      key: "active_roles",
      label: "Active Roles",
      value: metrics.active_roles ?? fallbackMetrics.active_roles,
    },
    {
      key: "total_applicants",
      label: "Total Applicants",
      value: metrics.total_applicants ?? fallbackMetrics.total_applicants,
    },
    {
      key: "shortlisted",
      label: "Shortlisted",
      value: metrics.shortlisted ?? fallbackMetrics.shortlisted,
    },
    {
      key: "oa_cleared",
      label: "OA Cleared",
      value: metrics.oa_cleared ?? fallbackMetrics.oa_cleared,
    },
    {
      key: "final_selected",
      label: "Final Selected",
      value: metrics.final_selected ?? fallbackMetrics.final_selected,
    },
  ];

  const funnel = useMemo(() => {
    const applied = byRole.length;
    const atsCleared = byRole.filter(
      (candidate) => candidate.oa_eligible === 1,
    ).length;
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
    } catch {
      setMetrics(fallbackMetrics);
    }
  };

  const refreshAll = async () => {
    await loadCandidates();
    await loadMetrics(selectedRole);
  };

  // ── Overall Score: weighted composite across all stages ──
  const overallScore = (c) => {
    const ats = Number(c.ats_score ?? c.ats_match_percent ?? 0);
    const oa  = Number(c.oa_percentage ?? (c.oa_total ? (c.oa_score / c.oa_total) * 100 : 0));
    const iv  = Number(c.interview_score ?? 0);
    return ats * 0.4 + oa * 0.35 + iv * 0.25;
  };

  // ── Select Top N state + direct handler ──
  const [selectLimit, setSelectLimit] = useState(5);

  const runSelectTopCandidates = async () => {
    if (!selectedRole) { setToast("Select a role first."); return; }
    const n = Math.max(1, Number(selectLimit) || 1);

    // Compute locally who the top N are (for the congrats modal)
    const topN = [...byRole]
      .filter((c) => c.email)
      .sort((a, b) => overallScore(b) - overallScore(a))
      .slice(0, n);

    if (topN.length === 0) { setToast("No candidates available for this role."); return; }

    setLoadingAction(true);
    try {
      await finalizeCandidates(selectedRole, n);
      setCongratsCandidates(topN);
      setShowCongrats(true);
      setToast(`✅ Top ${topN.length} candidates selected and notified.`);
      await refreshAll();
    } catch (err) {
      setToast(err.message || "Selection failed.");
    } finally {
      setLoadingAction(false);
    }
  };

  const [showCongrats, setShowCongrats] = useState(false);
  const [congratsCandidates, setCongratsCandidates] = useState([]);

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
    if (!selectedRole) return "Select a role to view candidates.";
    if (byRole.length === 0) return "No applicants yet for this role.";
    return "No candidates found.";
  };

  // Always return the best available XAI stage data
  const getXaiForStage = (candidate) => {
    const stages = candidate?.xai?.stages || {};
    return stages.final || stages.interview || stages.oa || stages.resume || null;
  };

  const getStageRecommendation = (candidate) => {
    const stageXai = getXaiForStage(candidate);
    return stageXai?.recommendation || "REVIEW";
  };

  // ── Measure real header height and expose as --header-h CSS var ──
  useEffect(() => {
    if (!headerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const h = Math.ceil(entry.contentRect.height);
      document.documentElement.style.setProperty("--header-h", `${h + 24}px`);
    });
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  // ── Lock body scroll when drawer is open ──
  useEffect(() => {
    document.body.style.overflow = selectedCandidate ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [selectedCandidate]);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRole, searchTerm]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) {
      document.addEventListener("mousedown", handleOutside);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [profileOpen]);

  return (
    <div className="page hrcc-page">
      {/* ── Section 1: Header ── */}
      <header className="hrcc-header" ref={headerRef}>
        <div className="hrcc-brand">
          <span className="hrcc-brand-icon">📊</span>
          <div>
            <h2>Hiring Command Center</h2>
            <span className="hrcc-brand-sub">HireX · AI-Powered Screening</span>
          </div>
        </div>
        {onLogout && (
          <div className="hrcc-profile-wrapper" ref={profileRef}>
            <button
              type="button"
              className="hrcc-profile-chip"
              onClick={() => setProfileOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={profileOpen}
            >
              <span className="hrcc-profile-avatar">
                {(localStorage.getItem("authName") || "H").charAt(0).toUpperCase()}
              </span>
              <span className="hrcc-profile-name">
                {localStorage.getItem("authName") || "HR"}
              </span>
              <span className="hrcc-profile-caret">{profileOpen ? "▲" : "▼"}</span>
            </button>
            {profileOpen && (
              <div className="hrcc-profile-dropdown" role="menu">
                <div className="hrcc-dropdown-info">
                  <p className="hrcc-dropdown-name">
                    {localStorage.getItem("authName") || "HR User"}
                  </p>
                  <p className="hrcc-dropdown-email">
                    {localStorage.getItem("authEmail") || ""}
                  </p>
                </div>
                <div className="hrcc-dropdown-divider" />
                <button
                  type="button"
                  className="hrcc-dropdown-logout"
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false);
                    onLogout();
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {toast && <p className="helper">{toast}</p>}
      {error && <p className="helper error">{error}</p>}

      {/* ── Section 2: Statistics ── */}
      <section className="hrcc-summary-grid">
        {summaryCards.map((card) => (
          <article className={`hrcc-summary-card hrcc-card-${card.key}`} key={card.key}>
            <div className="hrcc-card-icon">
              {CARD_META[card.key]?.icon ?? "📈"}
            </div>
            <div className="hrcc-card-body">
              <p className="hrcc-card-value">{card.value ?? 0}</p>
              <p className="hrcc-card-label">{card.label}</p>
            </div>
          </article>
        ))}
      </section>

      <div className="hrcc-workspace">
        {/* ── Section 3: Role Management ── */}
        <aside className="hrcc-sidebar">

          {/* New Role Form */}
          <div className="hrcc-new-role-panel">
            <p className="hrcc-panel-heading">New Role</p>

            <div className="hrcc-field">
              <label className="hrcc-field-label" htmlFor="role-name-input">Role Name</label>
              <input
                id="role-name-input"
                type="text"
                className="hrcc-field-input"
                value={roleDraft}
                onChange={(e) => setRoleDraft(e.target.value)}
                placeholder="e.g. Data Analyst"
                onKeyDown={(e) => e.key === "Enter" && addRole()}
              />
            </div>

            <div className="hrcc-field">
              <label className="hrcc-field-label">Job Description (PDF)</label>
              <label className="hrcc-file-upload" htmlFor="jd-file-input">
                <span className="hrcc-file-icon">📄</span>
                <span className="hrcc-file-text">
                  {jdFile ? jdFile.name : "Click to upload PDF"}
                </span>
                <span className="hrcc-file-hint">{jdFile ? "✓ File selected" : "PDF only · Max 10MB"}</span>
                <input
                  id="jd-file-input"
                  type="file"
                  accept=".pdf"
                  style={{ display: "none" }}
                  onChange={(e) => setJdFile(e.target.files?.[0] || null)}
                />
              </label>
              {jdFile && (
                <button
                  type="button"
                  className="hrcc-file-clear"
                  onClick={() => setJdFile(null)}
                >
                  ✕ Remove file
                </button>
              )}
            </div>

            <button
              className={`btn hrcc-submit-btn ${loadingAction ? "loading" : ""}`}
              onClick={addRole}
              disabled={loadingAction}
            >
              {loadingAction && <span className="spinner" aria-hidden="true" />}
              {loadingAction ? "Creating…" : "Add Role + JD"}
            </button>
          </div>

          {/* Active Roles List */}
          {roles.length > 0 && (
            <div className="hrcc-roles-panel">
              <p className="hrcc-panel-heading">Active Roles
                <span className="hrcc-roles-count">{roles.length}</span>
              </p>
              <div className="hrcc-role-list">
                {roles.map((role) => (
                  <button
                    key={role}
                    className={`hrcc-role-item ${selectedRole === role ? "active" : ""}`}
                    onClick={() => setSelectedRole(role)}
                  >
                    <div className="hrcc-role-item-left">
                      <span className="hrcc-role-dot" />
                      <strong className="hrcc-role-name">{formatRole(role)}</strong>
                    </div>
                    <span className="hrcc-role-badge">{roleStats[role] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </aside>

        <div className="hrcc-main">

          {/* ── Candidate Ranking Controls ── */}
          <section className="hrcc-table-controls">
            <div className="form-row hrcc-search">
              <label>Search candidates</label>
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, or status"
              />
            </div>
            <div className="hrcc-select-top-bar" style={{ alignItems: "flex-end" }}>
              <div className="hrcc-field" style={{ minWidth: "160px" }}>
                <label className="hrcc-field-label" htmlFor="select-limit-input">
                  Candidates to Select
                </label>
                <input
                  id="select-limit-input"
                  type="number"
                  min={1}
                  value={selectLimit}
                  onChange={(e) => setSelectLimit(e.target.value)}
                  className="hrcc-field-input"
                />
              </div>
              <button
                className={`btn hrcc-submit-btn hrcc-select-top-btn ${loadingAction ? "loading" : ""}`}
                onClick={runSelectTopCandidates}
                disabled={loadingAction || !selectedRole}
              >
                {loadingAction && <span className="spinner" aria-hidden="true" />}
                {loadingAction ? "Processing…" : `Select Top ${Math.max(1, Number(selectLimit) || 1)}`}
              </button>
            </div>
            <span style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: "0.83rem" }}>
              {filteredStageCandidates.length} candidate{filteredStageCandidates.length !== 1 ? "s" : ""}
            </span>
          </section>

          <section className="hrcc-table-shell">
            <table className="table hrcc-table">
              <thead>
                <tr>
                  <th style={{ width: "32px", textAlign: "center" }}>#</th>
                  <th>Name</th>
                  <th>Overall Score</th>
                  <th>ATS Score</th>
                  <th>OA Score</th>
                  <th>Interview Score</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8}>Loading candidates...</td></tr>
                )}
                {!loading && filteredStageCandidates.length === 0 && (
                  <tr><td colSpan={8}>{getStageEmptyMessage()}</td></tr>
                )}
                {!loading &&
                  paginatedStageCandidates.map((candidate, idx) => {
                    const overall = overallScore(candidate);
                    const rank = (currentPage - 1) * pageSize + idx + 1;
                    const isSelected = (candidate.status || "").toUpperCase() === "SELECTED";
                    return (
                      <tr
                        key={candidate.id || candidate.email}
                        style={isSelected ? { background: "rgba(34,197,94,0.07)" } : {}}
                      >
                        <td style={{ textAlign: "center", fontWeight: 700, color: rank <= Number(selectLimit) ? "var(--accent)" : "var(--muted)", fontSize: "0.8rem" }}>
                          {rank}
                        </td>
                        <td style={{ fontWeight: 600 }}>{candidate.name || "-"}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                            {overall.toFixed(1)}
                          </span>
                        </td>
                        <td>
                          {candidate.ats_score != null
                            ? Number(candidate.ats_score).toFixed(1)
                            : candidate.ats_match_percent != null
                              ? Number(candidate.ats_match_percent).toFixed(1)
                              : "-"}
                        </td>
                        <td>
                          {candidate.oa_score !== null && candidate.oa_total
                            ? `${candidate.oa_score}/${candidate.oa_total}`
                            : "-"}
                        </td>
                        <td>
                          {candidate.interview_score != null
                            ? Number(candidate.interview_score).toFixed(1)
                            : "-"}
                        </td>
                        <td>
                          <span className={getStatusClass(candidate.status)}>
                            {candidate.status || "UNDER REVIEW"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn hrcc-action-btn"
                            onClick={() => setSelectedCandidate(candidate)}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </section>

          {filteredStageCandidates.length > pageSize && (
            <nav className="hrcc-pagination" aria-label="Candidate pagination">
              <button
                className="btn secondary"
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="btn secondary"
                type="button"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </nav>
          )}

          {/* ── Section 6: Analytics ── */}
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
        </div>
      </div>

      {/* ── Overlays & Modals (outside layout flow) ── */}
      <div
        className={`hrcc-overlay ${selectedCandidate ? "open" : ""}`}
        onClick={() => setSelectedCandidate(null)}
      />
      <aside className={`hrcc-side-panel ${selectedCandidate ? "open" : ""}`} aria-label="Candidate details">
        <div className="hrcc-side-header">
          <h3>Candidate Details</h3>
          <button
            type="button"
            className="hrcc-side-close"
            aria-label="Close drawer"
            onClick={() => setSelectedCandidate(null)}
          >
            ✕
          </button>
        </div>

        {selectedCandidate && (
          <div className="hrcc-side-content">
            <section>
              <h4>Candidate Info</h4>
              <p>
                <strong>Name:</strong> {selectedCandidate.name || "-"}
              </p>
              <p>
                <strong>Email:</strong> {selectedCandidate.email || "-"}
              </p>
              <p>
                <strong>Phone:</strong> {selectedCandidate.phone || "-"}
              </p>
              {getResumeLink(selectedCandidate) ? (
                <a
                  href={getResumeLink(selectedCandidate)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Resume preview / download
                </a>
              ) : (
                <p>Resume preview link not available from API.</p>
              )}
            </section>

            <section>
              <h4>ATS Details</h4>
              <p>
                <strong>ATS Score:</strong>{" "}
                {selectedCandidate.ats_score != null
                  ? Number(selectedCandidate.ats_score).toFixed(2)
                  : selectedCandidate.ats_match_percent != null
                    ? Number(selectedCandidate.ats_match_percent).toFixed(2)
                    : "-"}
              </p>
              <p>
                <strong>Skills Missing:</strong>{" "}
                {formatList(selectedCandidate.ats_missing_skills)}
              </p>
              <p>
                <strong>Education:</strong>{" "}
                {formatList(selectedCandidate.education)}
              </p>
            </section>

            <section>
              <h4>OA Details</h4>
              <p>
                <strong>OA Score:</strong>{" "}
                {selectedCandidate.oa_score !== null &&
                selectedCandidate.oa_total
                  ? `${selectedCandidate.oa_score}/${selectedCandidate.oa_total} (${selectedCandidate.oa_percentage ?? 0}%)`
                  : "-"}
              </p>
              <p>
                <strong>OA Status:</strong>{" "}
                {selectedCandidate.oa_status || "NOT_TAKEN"}
              </p>
              <p>
                <strong>OA Tab Switches:</strong>{" "}
                {selectedCandidate.oa_tab_switches ?? 0}
              </p>
            </section>

            <section>
              <h4>Interview Details</h4>
              <p>
                <strong>Interview Score:</strong>{" "}
                {selectedCandidate.interview_score != null
                  ? Number(selectedCandidate.interview_score).toFixed(2)
                  : "-"}
              </p>
              <p>
                <strong>Interview Tab Switches:</strong>{" "}
                {selectedCandidate.interview_tab_switches ?? 0}
              </p>
            </section>

            <section>
              <h4>XAI Snapshot</h4>
              <XaiSnapshot
                stageLabel="Overall Evaluation"
                stageXai={getXaiForStage(selectedCandidate)}
                modelExplanations={selectedCandidate?.xai?.model_explanations}
              />
            </section>
          </div>
        )}
      </aside>

      <div className="hrcc-footer-note">
        <span>Selected role: {formatRole(selectedRole)}</span>
      </div>

      {showCongrats && (
        <div className="hrcc-modal open">
          <div className="hrcc-modal-card">
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <span style={{ fontSize: "2.5rem" }}>🎉</span>
              <h3 style={{ marginTop: "10px" }}>Selection Complete!</h3>
              <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                {congratsCandidates.length} candidate{congratsCandidates.length !== 1 ? "s" : ""} selected for <strong>{formatRole(selectedRole)}</strong>.
                They will see a congratulations message on their dashboard.
              </p>
            </div>
            <ul style={{ padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "260px", overflowY: "auto" }}>
              {congratsCandidates.map((c, i) => (
                <li key={c.id || c.email} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "10px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <span style={{ fontWeight: 700, color: "var(--accent)", minWidth: "22px" }}>#{i + 1}</span>
                  <span style={{ fontWeight: 600 }}>{c.name || c.email}</span>
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)", marginLeft: "auto" }}>{c.email}</span>
                </li>
              ))}
            </ul>
            <div className="toolbar" style={{ marginTop: "20px" }}>
              <button
                className="btn hrcc-submit-btn"
                style={{ width: "100%" }}
                onClick={() => setShowCongrats(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HRDashboard;
