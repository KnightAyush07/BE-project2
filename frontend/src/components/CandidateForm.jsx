import { useEffect, useMemo, useState } from "react";
import {
  checkOaEligibility,
  fetchOaQuestions,
  submitOaAnswers,
  checkInterviewEligibility,
  fetchInterviewQuestions,
  submitInterviewAnswers,
} from "../services/api";

const OA_DURATION_SECONDS = 600;
const INTERVIEW_DURATION_SECONDS = 600;

function CandidateForm({ candidateData, role }) {
  const [submitted, setSubmitted] = useState(false);
  const [oaEligibility, setOaEligibility] = useState(null);
  const [oaQuestions, setOaQuestions] = useState([]);
  const [oaAnswers, setOaAnswers] = useState({});
  const [oaStarted, setOaStarted] = useState(false);
  const [oaSubmitted, setOaSubmitted] = useState(false);
  const [oaResult, setOaResult] = useState(null);
  const [oaLoading, setOaLoading] = useState(false);
  const [oaError, setOaError] = useState("");
  const [timeLeft, setTimeLeft] = useState(OA_DURATION_SECONDS);
  const [interviewEligibility, setInterviewEligibility] = useState(null);
  const [interviewQuestions, setInterviewQuestions] = useState([]);
  const [interviewAnswers, setInterviewAnswers] = useState({});
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewSubmitted, setInterviewSubmitted] = useState(false);
  const [interviewResult, setInterviewResult] = useState(null);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewError, setInterviewError] = useState("");
  const [interviewTimeLeft, setInterviewTimeLeft] = useState(
    INTERVIEW_DURATION_SECONDS
  );

  const email = candidateData?.email || "";
  const formattedOaTime = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [timeLeft]);

  const formattedInterviewTime = useMemo(() => {
    const minutes = Math.floor(interviewTimeLeft / 60);
    const seconds = interviewTimeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [interviewTimeLeft]);

  const loadEligibility = async () => {
    if (!email) return;
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
    }
  };

  const loadInterviewEligibility = async () => {
    if (!email) return;
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
    }
  };

  const handleSubmit = async () => {
    const payload = {
      name: candidateData.name || "",
      email: candidateData.email || "",
      phone: candidateData.phone || "",
      skills: candidateData.skills || [],
      education: candidateData.education || [],
      resume_text: candidateData.resume_text || "",
      role: role,
    };

    const response = await fetch("http://127.0.0.1:8000/application/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      setSubmitted(true);
      loadEligibility();
      loadInterviewEligibility();
    } else {
      alert("Submission failed");
    }
  };

  useEffect(() => {
    if (!oaStarted || oaSubmitted) return;

    if (timeLeft <= 0) {
      handleOaSubmit(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [oaStarted, oaSubmitted, timeLeft]);

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

  const handleStartOa = async () => {
    if (!oaEligibility?.eligible) return;
    setOaLoading(true);
    setOaError("");
    try {
      const data = await fetchOaQuestions(role, email);
      if (data.error) {
        setOaError(data.error);
        return;
      }
      setOaQuestions(data);
      setOaStarted(true);
      setTimeLeft(OA_DURATION_SECONDS);
    } catch (err) {
      setOaError("Failed to load OA questions.");
    } finally {
      setOaLoading(false);
    }
  };

  const handleAnswerChange = (qid, value) => {
    setOaAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const handleOaSubmit = async (auto = false) => {
    if (oaSubmitted) return;
    setOaLoading(true);
    setOaError("");
    try {
      const payload = {
        email,
        role,
        answers: oaAnswers,
        auto_submit: auto,
      };
      const data = await submitOaAnswers(payload);
      if (data.error) {
        setOaError(data.error);
        return;
      }
      setOaResult(data);
      setOaSubmitted(true);
      loadInterviewEligibility();
    } catch (err) {
      setOaError("OA submission failed.");
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
          <h3>Online Assessment (MCQ)</h3>
          <p>
            The assessment unlocks only after HR shortlists you. Check back
            here to start the test.
          </p>

          {oaError && <p className="helper error">{oaError}</p>}

          {!oaEligibility && (
            <button className="btn secondary" onClick={loadEligibility}>
              Check OA Availability
            </button>
          )}

          {oaEligibility && !oaEligibility.eligible && (
            <div className="stack">
              <p>Status: Not shortlisted yet.</p>
              <button className="btn secondary" onClick={loadEligibility}>
                Refresh Status
              </button>
            </div>
          )}

          {oaEligibility?.eligible && !oaSubmitted && (
            <div className="stack">
              <p>Status: Shortlisted — OA is ready.</p>
              <button
                className="btn primary"
                onClick={handleStartOa}
                disabled={oaLoading}
              >
                Start OA (10 minutes)
              </button>
            </div>
          )}

          {oaStarted && !oaSubmitted && (
            <div className="stack">
              <div className="helper">
                Time left: <strong>{formattedOaTime}</strong>
              </div>
              {oaQuestions.map((q) => (
                <div key={q.id} className="stack">
                  <strong>{q.question}</strong>
                  {q.options.map((opt) => (
                    <label key={opt}>
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={opt}
                        checked={oaAnswers[q.id] === opt}
                        onChange={() => handleAnswerChange(q.id, opt)}
                      />{" "}
                      {opt}
                    </label>
                  ))}
                </div>
              ))}
              <button
                className="btn primary"
                onClick={() => handleOaSubmit(false)}
                disabled={oaLoading}
              >
                Submit OA
              </button>
            </div>
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
              <button className="btn secondary" onClick={loadEligibility}>
                Refresh Status
              </button>
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
            <button
              className="btn secondary"
              onClick={loadInterviewEligibility}
            >
              Check Interview Availability
            </button>
          )}

          {interviewEligibility && !interviewEligibility.eligible && (
            <div className="stack">
              <p>Status: Interview locked. Pass the OA to unlock.</p>
              <button
                className="btn secondary"
                onClick={loadInterviewEligibility}
              >
                Refresh Status
              </button>
            </div>
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
              <button
                className="btn secondary"
                onClick={loadInterviewEligibility}
              >
                Refresh Status
              </button>
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
