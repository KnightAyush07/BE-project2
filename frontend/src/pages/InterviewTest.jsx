import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  checkInterviewEligibility,
  fetchInterviewQuestions,
  submitInterviewAnswers,
} from "../services/api";

const TOTAL_DURATION_SECONDS = 10 * 60;

export default function InterviewTest() {
  const navigate = useNavigate();
  const { role: roleParam } = useParams();
  const role = roleParam || localStorage.getItem("candidateRole") || "python_dev";
  const email = localStorage.getItem("authEmail") || "";

  const [eligible, setEligible] = useState(false);
  const [status, setStatus] = useState("NOT_TAKEN");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
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
      setResult(data);
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

        const interviewStatus = (eligibility?.interview_status || "NOT_TAKEN").toUpperCase();
        setStatus(interviewStatus);

        if (interviewStatus === "PASS" || interviewStatus === "FAIL") {
          setSubmitted(true);
          setResult({
            percentage: eligibility?.interview_percentage ?? 0,
            status: interviewStatus,
          });
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

    const handleVisibility = () => {
      if (document.hidden && !submittedRef.current) {
        setTabSwitches((prev) => {
          const next = prev + 1;
          setWarning(
            `Tab switch detected (${next}/3). Further switches will submit the interview.`
          );
          if (next >= 3) {
            submitTest(true);
          }
          return next;
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [loading, submitted, eligible]);

  if (submitted) {
    return (
      <section className="page">
        <div className="card stack">
          <h2>Interview Submitted</h2>
          <p>
            Status: <strong>{result?.status || status}</strong>
          </p>
          <p>
            Score: <strong>{result?.percentage ?? 0}%</strong>
          </p>
          <button className="btn secondary" onClick={() => navigate("/candidate")}>
            Back to Candidate Dashboard
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="card stack">
        <h2>Online Text AI Interview</h2>
        <p>
          Role: <strong>{role.replace(/_/g, " ")}</strong>
        </p>
        <p>
          Time Left: <strong>{formattedTime}</strong>
        </p>
        {tabSwitches > 0 && (
          <p>
            Tab switches: <strong>{tabSwitches}/3</strong>
          </p>
        )}

        {loading && <p>Loading interview...</p>}
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
            {questions.map((q) => (
              <div key={q.id} className="form-row">
                <label>{q.question}</label>
                <textarea
                  rows={4}
                  value={answers[q.id] || ""}
                  onChange={(event) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: event.target.value }))
                  }
                  placeholder="Write your answer here..."
                />
              </div>
            ))}
            <div className="toolbar">
              <button
                className="btn primary"
                onClick={() => submitTest(false)}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Interview"}
              </button>
              <button className="btn secondary" onClick={() => navigate("/candidate")}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
