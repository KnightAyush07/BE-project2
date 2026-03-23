import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getOAQuestions, submitOATest } from "../services/api";

const TOTAL_DURATION_SECONDS = 20 * 60;

export default function OATest({ role: roleProp = "python_dev" }) {
  const navigate = useNavigate();
  const { role: roleParam } = useParams();
  const role =
    roleParam ||
    localStorage.getItem("candidateRole") ||
    roleProp;
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState(
    localStorage.getItem("authEmail") || ""
  );
  const [timeLeft, setTimeLeft] = useState(TOTAL_DURATION_SECONDS);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [warning, setWarning] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const loadQuestions = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getOAQuestions(role, { signal: controller.signal });
        if (data?.error) {
          setError(data.error);
          setQuestions([]);
          return;
        }
        const safeQuestions = Array.isArray(data) ? data : [];
        setQuestions(safeQuestions);
        setCurrentIndex(0);
        setAnswers({});
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Unable to load questions.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
    return () => controller.abort();
  }, [role]);

  useEffect(() => {
    if (submitted) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [submitted]);

  useEffect(() => {
    if (submitted || submittedRef.current) return;
    if (timeLeft === 0) {
      submitTest(true);
    }
  }, [timeLeft, submitted]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && !submittedRef.current) {
        setTabSwitches((prev) => {
          const next = prev + 1;
          setWarning(
            `Tab switch detected (${next}/3). Further switches will submit the test.`
          );
          if (next >= 3) {
            submitTest(true);
          }
          return next;
        });
      }
    };

    const handleContextMenu = (event) => {
      event.preventDefault();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  const answeredCount = useMemo(
    () => Object.keys(answers).filter((key) => answers[key]).length,
    [answers]
  );

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
      if (!email) {
        submittedRef.current = false;
        setSubmitting(false);
        setError("Please enter your email to submit.");
        return;
      }

      const time_taken = TOTAL_DURATION_SECONDS - timeLeft;
      const hrIdRaw = localStorage.getItem("candidateHrId");
      const hr_id = hrIdRaw ? Number(hrIdRaw) : undefined;
      await submitOATest({
        email,
        role,
        answers,
        time_taken,
        tab_switches: tabSwitches,
        ...(hr_id ? { hr_id } : {}),
        auto_submit: auto,
      });

      setSubmitted(true);
      setTimeout(() => navigate("/candidate"), 1200);
    } catch (err) {
      submittedRef.current = false;
      setError(err.message || "Unable to submit test.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentQuestion = questions[currentIndex];

  if (submitted) {
    return (
      <section className="page oa-pro">
        <div className="oa-submit-card">
          <h2>Test Submitted Successfully</h2>
          <p>Thank you. Your assessment has been recorded.</p>
          <p>
            Please wait for HR to review your test. You will receive a yes/no
            decision once you are shortlisted and approved.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="page oa-pro">
      <header className="oa-topbar">
        <div className="oa-brand">
          <p className="oa-kicker">Online Assessment</p>
          <h1>{role.replace(/_/g, " ").toUpperCase()} MCQ Test</h1>
        </div>
        <div className="oa-meta">
          <div className="oa-timer">
            <span className="oa-timer-label">Time Left</span>
            <span className="oa-timer-value">{formattedTime}</span>
          </div>
          <div className="oa-email">
            <label>Email</label>
            <input
              type="email"
              placeholder="candidate@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              readOnly={Boolean(localStorage.getItem("authEmail"))}
            />
          </div>
        </div>
      </header>

      {warning && <div className="oa-warning">{warning}</div>}
      {error && <div className="oa-error">{error}</div>}

      <div className="oa-layout">
        <aside className="oa-panel oa-panel-left">
          <div className="oa-panel-title">Question Palette</div>
          <div className="oa-palette">
            {questions.map((q, idx) => (
              <button
                key={q.id || idx}
                type="button"
                className={`oa-pill ${answers[q.id] ? "answered" : ""} ${
                  idx === currentIndex ? "active" : ""
                }`}
                onClick={() => setCurrentIndex(idx)}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <div className="oa-summary">
            Answered {answeredCount}/{questions.length}
          </div>
        </aside>

        <main className="oa-panel oa-panel-center">
          {loading && <div className="oa-card">Loading questions...</div>}
          {!loading && currentQuestion && (
            <div className="oa-card">
              <div className="oa-question-header">
                <span className="oa-question-number">
                  Question {currentIndex + 1}
                </span>
                <span className="oa-question-count">{questions.length} Total</span>
              </div>
              <h2 className="oa-question-text">{currentQuestion.question}</h2>
              <div className="oa-options">
                {currentQuestion.options.map((option) => (
                  <label className="oa-option" key={option}>
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                      value={option}
                      checked={answers[currentQuestion.id] === option}
                      onChange={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [currentQuestion.id]: option,
                        }))
                      }
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {!loading && !currentQuestion && (
            <div className="oa-card">No questions available for this role.</div>
          )}

          <div className="oa-actions">
            <button
              className="btn secondary"
              onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
              disabled={currentIndex === 0}
            >
              Previous
            </button>
            <button
              className="btn secondary"
              onClick={() =>
                setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1))
              }
              disabled={currentIndex === questions.length - 1}
            >
              Next
            </button>
            <button
              className="btn primary"
              onClick={() => submitTest(false)}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Test"}
            </button>
          </div>
        </main>
      </div>
    </section>
  );
}
