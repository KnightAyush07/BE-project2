import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  checkInterviewEligibility,
  fetchInterviewQuestions,
  submitInterviewAnswers,
} from "../services/api";
import { bindAssessmentSecurity } from "../utils/assessmentSecurity";

const TOTAL_DURATION_SECONDS = 10 * 60;

export default function InterviewTest() {
  const navigate = useNavigate();
  const { role: roleParam } = useParams();
  const role =
    roleParam || localStorage.getItem("candidateRole") || "python_dev";
  const email = localStorage.getItem("authEmail") || "";

  const [eligible, setEligible] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(TOTAL_DURATION_SECONDS);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [warning, setWarning] = useState("");
  const submittedRef = useRef(false);

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }, [timeLeft]);
  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => value.trim()).length,
    [answers],
  );

  const submitTest = async (auto = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError("");

    try {
      const data = await submitInterviewAnswers({
        email,
        role,
        answers,
        tab_switches: tabSwitches,
        auto_submit: auto,
      });
      if (data?.error) {
        throw new Error(data.error);
      }
      setSubmitted(true);
    } catch (err) {
      submittedRef.current = false;
      setError(err.message || "Interview submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        if (!email) {
          setError("Please login as candidate first.");
          return;
        }

        const eligibility = await checkInterviewEligibility(email);
        if (eligibility?.error) {
          setError(eligibility.error);
          return;
        }

        const interviewStatus = (
          eligibility?.interview_status || "NOT_TAKEN"
        ).toUpperCase();
        if (interviewStatus === "PASS" || interviewStatus === "FAIL") {
          setSubmitted(true);
          return;
        }

        if (!eligibility?.eligible) {
          setEligible(false);
          return;
        }

        setEligible(true);
        const data = await fetchInterviewQuestions(role, email);
        if (data?.error) {
          throw new Error(data.error);
        }
        setQuestions(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Unable to load interview.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [email, role]);

  useEffect(() => {
    if (loading || submitted || !eligible) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, submitted, eligible]);

  useEffect(() => {
    if (loading || submitted || !eligible) return;
    if (timeLeft === 0) {
      submitTest(true);
    }
  }, [timeLeft, loading, submitted, eligible]);

  useEffect(() => {
    if (loading || submitted || !eligible) return;
    return bindAssessmentSecurity({
      submittedRef,
      onTabSwitch: () => {
        setTabSwitches((prev) => {
          const next = prev + 1;
          setWarning(
            `Tab switch detected (${next}/3). Further switches will submit the interview.`,
          );
          if (next >= 3) {
            submitTest(true);
          }
          return next;
        });
      },
      onBlockedAction: (message) => setWarning(message),
      onAutoSubmit: () => submitTest(true),
    });
  }, [loading, submitted, eligible]);

  if (submitted) {
    return (
      <section className="page">
        <div className="card stack">
          <h2>Interview Submitted</h2>
          <p>Interview completed. Please wait for HR to contact you.</p>
          <button
            className="btn secondary"
            onClick={() => navigate("/candidate")}
          >
            Back to Candidate Dashboard
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page interview-page">
      <div className="card stack interview-shell">
        <div className="interview-header">
          <div>
            <p className="oa-kicker">AI Interview</p>
            <h2>Online Text AI Interview</h2>
            <p>
              Role: <strong>{role.replace(/_/g, " ")}</strong>
            </p>
          </div>
          <div className="interview-status-card">
            <span className="recording-dot" aria-hidden="true" />
            <span>{eligible && !submitted ? "Recording answers" : "Standby"}</span>
            <strong>{formattedTime}</strong>
          </div>
        </div>
        {tabSwitches > 0 && (
          <p>
            Tab switches: <strong>{tabSwitches}/3</strong>
          </p>
        )}

        {loading && (
          <p className="helper">
            <span className="spinner" aria-hidden="true" />
            Loading interview...
          </p>
        )}
        {warning && <p className="helper error">{warning}</p>}
        {error && <p className="helper error">{error}</p>}
        {!loading && !eligible && !error && (
          <p>Interview is not available for this profile yet.</p>
        )}
        {!loading && eligible && questions.length === 0 && !error && (
          <p>No interview questions available right now.</p>
        )}

        {!loading && eligible && questions.length > 0 && (
          <>
            <div className="interview-progress">
              <span>
                Answered {answeredCount}/{questions.length}
              </span>
              <div className="oa-progress-track">
                <span
                  style={{
                    width: `${
                      questions.length
                        ? Math.round((answeredCount / questions.length) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            {questions.map((q) => (
              <div key={q.id} className="form-row interview-question-card">
                <label>{q.question}</label>
                <textarea
                  rows={4}
                  value={answers[q.id] || ""}
                  onChange={(event) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: event.target.value,
                    }))
                  }
                  placeholder="Write your answer here..."
                />
              </div>
            ))}
            <div className="interview-transcript-card">
              <div>
                <span className="recording-dot small" aria-hidden="true" />
                <strong>Live transcript</strong>
              </div>
              <p>
                {Object.values(answers).filter(Boolean).join(" ") ||
                  "Your typed answers will appear here as a clean review transcript."}
              </p>
            </div>
            <div className="toolbar">
              <button
                className={`btn primary ${submitting ? "loading" : ""}`}
                onClick={() => submitTest(false)}
                disabled={submitting}
              >
                {submitting && <span className="spinner" aria-hidden="true" />}
                {submitting ? "Submitting..." : "Submit Interview"}
              </button>
              <button
                className="btn secondary"
                onClick={() => navigate("/candidate")}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
