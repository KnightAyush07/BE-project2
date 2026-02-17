import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  checkOaEligibility,
  checkInterviewEligibility,
  fetchInterviewQuestions,
  submitInterviewAnswers,
  checkCandidateStatus,
  submitApplication,
} from "../services/api";

const INTERVIEW_DURATION_SECONDS = 600;

function CandidateForm({ candidateData, role, hrId, jdData }) {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [oaEligibility, setOaEligibility] = useState(null);
  const [oaSubmitted, setOaSubmitted] = useState(false);
  const [oaResult, setOaResult] = useState(null);
  const [oaLoading, setOaLoading] = useState(false);
  const [oaError, setOaError] = useState("");
  const [oaChecking, setOaChecking] = useState(false);
  const [interviewEligibility, setInterviewEligibility] = useState(null);
  const [interviewQuestions, setInterviewQuestions] = useState([]);
  const [interviewAnswers, setInterviewAnswers] = useState({});
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewSubmitted, setInterviewSubmitted] = useState(false);
  const [interviewResult, setInterviewResult] = useState(null);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewError, setInterviewError] = useState("");
  const [interviewChecking, setInterviewChecking] = useState(false);
  const [interviewTimeLeft, setInterviewTimeLeft] = useState(
    INTERVIEW_DURATION_SECONDS
  );
  const [candidateStatus, setCandidateStatus] = useState(null);
  const [statusError, setStatusError] = useState("");

  const email = localStorage.getItem("authEmail") || candidateData?.email || "";
  const formattedInterviewTime = useMemo(() => {
    const minutes = Math.floor(interviewTimeLeft / 60);
    const seconds = interviewTimeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [interviewTimeLeft]);

  const loadEligibility = async () => {
    if (!email) return;
    setOaChecking(true);
    setOaError("");
    try {
      const data = await checkOaEligibility(email);
      if (data.error) {
        setOaError(data.error);
        return;
      }
      setOaEligibility(data);
      if (data.oa_status === "PASS" || data.oa_status === "FAIL") {
        setOaResult(data);
        setOaSubmitted(true);
      }
    } catch (err) {
      setOaError("Unable to check OA eligibility right now.");
    } finally {
      setOaChecking(false);
    }
  };

  const loadCandidateStatus = async () => {
    if (!email) return;
    setStatusError("");
    try {
      const data = await checkCandidateStatus(email);
      if (data?.error) {
        setStatusError(data.error);
        return;
      }
      setCandidateStatus(data);
    } catch (err) {
      setStatusError("Unable to fetch status right now.");
    }
  };

  const loadInterviewEligibility = async () => {
    if (!email) return;
    setInterviewChecking(true);
    setInterviewError("");
    try {
      const data = await checkInterviewEligibility(email);
      if (data.error) {
        setInterviewError(data.error);
        return;
      }
      setInterviewEligibility(data);
      if (
        data.interview_status === "PASS" ||
        data.interview_status === "FAIL"
      ) {
        setInterviewResult(data);
        setInterviewSubmitted(true);
      }
    } catch (err) {
      setInterviewError("Unable to check interview eligibility right now.");
    } finally {
      setInterviewChecking(false);
    }
  };

  const handleSubmit = async () => {
    const payload = {
      name: candidateData.name || "",
      email: email || "",
      phone: candidateData.phone || "",
      skills: candidateData.skills || [],
      education: candidateData.education || [],
      resume_text: candidateData.resume_text || "",
      role: role,
      hr_id: hrId,
      jd_text: jdData?.jd_text || "",
      jd_filename: jdData?.jd_filename || "",
    };
    try {
      await submitApplication(payload);
      localStorage.setItem("candidateRole", role);
      setSubmitted(true);
      loadEligibility();
      loadInterviewEligibility();
      loadCandidateStatus();
    } catch (err) {
      alert("Submission failed");
    }
  };

  useEffect(() => {
    if (!interviewStarted || interviewSubmitted) return;

    if (interviewTimeLeft <= 0) {
      handleInterviewSubmit(true);
      return;
    }

    const timer = setInterval(() => {
      setInterviewTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [interviewStarted, interviewSubmitted, interviewTimeLeft]);

  useEffect(() => {
    if (!email || !submitted) return;
    loadCandidateStatus();
    const interval = setInterval(loadCandidateStatus, 3000);
    return () => clearInterval(interval);
  }, [email, submitted]);

  const handleStartOa = async () => {
    setOaLoading(true);
    setOaError("");
    try {
      localStorage.setItem("candidateRole", role);
      navigate(`/oa/${role}`);
    } catch (err) {
      setOaError("Unable to start OA right now.");
    } finally {
      setOaLoading(false);
    }
  };

  const handleStartInterview = async () => {
    if (!interviewEligibility?.eligible) return;
    setInterviewLoading(true);
    setInterviewError("");
    try {
      const data = await fetchInterviewQuestions(role, email);
      if (data.error) {
        setInterviewError(data.error);
        return;
      }
      setInterviewQuestions(data);
      setInterviewStarted(true);
      setInterviewTimeLeft(INTERVIEW_DURATION_SECONDS);
    } catch (err) {
      setInterviewError("Failed to load interview questions.");
    } finally {
      setInterviewLoading(false);
    }
  };

  const handleInterviewAnswerChange = (qid, value) => {
    setInterviewAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const handleInterviewSubmit = async (auto = false) => {
    if (interviewSubmitted) return;
    setInterviewLoading(true);
    setInterviewError("");
    try {
      const payload = {
        email,
        role,
        answers: interviewAnswers,
        auto_submit: auto,
      };
      const data = await submitInterviewAnswers(payload);
      if (data.error) {
        setInterviewError(data.error);
        return;
      }
      setInterviewResult(data);
      setInterviewSubmitted(true);
    } catch (err) {
      setInterviewError("Interview submission failed.");
    } finally {
      setInterviewLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="stack">
        <h3 className="success">Application submitted successfully!</h3>
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
          <h3>Online Assessment (MCQ)</h3>
          <p>
            The assessment unlocks only after HR shortlists you. Check back
            here to start the test.
          </p>

          {oaError && <p className="helper error">{oaError}</p>}

          {!oaSubmitted && oaEligibility?.eligible && (
            <div className="stack">
              <p>Status: OA is ready.</p>
              <button
                className="btn primary"
                onClick={handleStartOa}
                disabled={oaLoading}
              >
                Start Quiz
              </button>
            </div>
          )}

          {!oaSubmitted && !oaEligibility?.eligible && (
            <p>Status: Waiting for HR shortlist to unlock OA.</p>
          )}

          {oaSubmitted && oaResult && (
            <div className="stack">
              <p>
                Score: {oaResult.score}/{oaResult.total} (
                {oaResult.percentage}%)
              </p>
              <p>
                Result: <strong>{oaResult.status}</strong>
              </p>
              <p>Decision pending from HR. Interview will unlock after HR approval.</p>
            </div>
          )}
        </div>

        <div className="card stack">
          <h3>Text Interview (AI-Safe)</h3>
          <p>
            Short answers, time-limited. This validates your OA + resume.
          </p>

          {interviewError && <p className="helper error">{interviewError}</p>}

          {!interviewEligibility && (
            <p>
              {interviewChecking ? "Checking eligibility..." : "Checking eligibility..."}
            </p>
          )}

          {!interviewEligibility?.eligible && !interviewSubmitted && (
            <p>Status: Interview locked until HR confirms after OA.</p>
          )}

          {interviewEligibility?.eligible && !interviewSubmitted && (
            <div className="stack">
              <p>Status: Interview is ready.</p>
              <button
                className="btn primary"
                onClick={handleStartInterview}
                disabled={interviewLoading}
              >
                Start Interview (10 minutes)
              </button>
            </div>
          )}

          {interviewStarted && !interviewSubmitted && (
            <div className="stack">
              <div className="helper">
                Time left: <strong>{formattedInterviewTime}</strong>
              </div>
              {interviewQuestions.map((q) => (
                <div key={q.id} className="stack">
                  <strong>{q.question}</strong>
                  <textarea
                    rows={4}
                    value={interviewAnswers[q.id] || ""}
                    onChange={(e) =>
                      handleInterviewAnswerChange(q.id, e.target.value)
                    }
                    placeholder="Write your answer here..."
                  />
                </div>
              ))}
              <button
                className="btn primary"
                onClick={() => handleInterviewSubmit(false)}
                disabled={interviewLoading}
              >
                Submit Interview
              </button>
            </div>
          )}

          {interviewSubmitted && interviewResult && (
            <div className="stack">
              <p>Score: {interviewResult.percentage}%</p>
              <p>
                Result: <strong>{interviewResult.status}</strong>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card stack">
      <h3>Confirm Your Details</h3>

      <p>
        <b>Name:</b> {candidateData.name}
      </p>
      <p>
        <b>Email:</b> {candidateData.email}
      </p>
      <p>
        <b>Phone:</b> {candidateData.phone}
      </p>
      <p>
        <b>Role:</b> {role}
      </p>

      <button className="btn primary" onClick={handleSubmit}>
        Submit Application
      </button>
    </div>
  );
}

export default CandidateForm;

