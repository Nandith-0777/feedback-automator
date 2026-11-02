"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
  Star,
} from "lucide-react";

const RATINGS = ["Excellent", "Very Good", "Good", "Fair", "Poor"];
const STAGES = [
  ["login", "Connect to ERP"],
  ["batch", "Find your batch"],
  ["semester", "Find your semester"],
  ["config", "Load feedback session"],
  ["pending", "Find pending forms"],
  ["submit", "Submit & verify"],
];

export default function HomePage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState("set-all");
  const [rating, setRating] = useState("");
  const [faculties, setFaculties] = useState(null);
  const [ratings, setRatings] = useState({});
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState({});
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const running = useRef(false);
  const activityRef = useRef(null);
  const hasActivity =
    busy || Boolean(faculties) || Boolean(summary) || Boolean(error);

  useEffect(() => {
    if (hasActivity && window.matchMedia("(max-width: 760px)").matches) {
      // Dismiss the phone keyboard before bringing the next task into view.
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      activityRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    }
  }, [busy, faculties, summary, error, hasActivity]);

  async function run(event, customRatings = null) {
    event.preventDefault();
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setSummary(null);
    setLogs([]);
    setSteps({});
    let terminal = false;
    try {
      const response = await fetch("/api/automate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          feedbackMode: mode,
          rating: Number(rating),
          facultyRatings: customRatings,
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Unable to start. Please try again.");
      }
      if (!response.body)
        throw new Error("This browser cannot stream progress.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      function receive(line) {
        if (!line.trim()) return;
        const item = JSON.parse(line);
        if (item.type === "status")
          setSteps((previous) => ({ ...previous, [item.step]: item }));
        if (item.type === "log")
          setLogs((previous) => [...previous, item.message]);
        if (item.type === "need_ratings") {
          terminal = true;
          setFaculties(item.faculties);
          setRatings({});
        }
        if (item.type === "error") {
          terminal = true;
          setError(item.message);
        }
        if (item.type === "done") {
          terminal = true;
          setSummary(item.summary);
          setFaculties(null);
          setPassword("");
          if (item.logs) setLogs(item.logs);
        }
      }
      try {
        while (true) {
          const { value, done } = await reader.read();
          buffer += done
            ? decoder.decode()
            : decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          lines.forEach(receive);
          if (done) {
            receive(buffer);
            break;
          }
        }
      } finally {
        reader.releaseLock();
      }
      if (!terminal)
        throw new Error(
          "Connection ended before results were confirmed. Reconnect to check remaining forms.",
        );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      running.current = false;
    }
  }

  const complete = summary && summary.failed === 0;
  const progress = Math.round(
    STAGES.reduce((sum, [key]) => sum + (steps[key]?.progress || 0), 0) /
      STAGES.length,
  );
  const ready = faculties?.every((faculty) => ratings[faculty.id]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/">
          <span className="brand-icon">
            <GraduationCap size={23} />
          </span>
          <span>
            feedback<span className="brand-light"> / automator</span>
          </span>
        </a>
        <a
          className="text-link"
          href="https://github.com/Nandith-0777/feedback-automator"
          target="_blank"
          rel="noreferrer"
        >
          View source <ArrowUpRight size={16} />
        </a>
      </header>
      <main>
        <section className="intro">
          <div className="eyebrow">
            <span /> BUILT FOR VIDYA STUDENTS
          </div>
          <h1>
            <span className="desktop-title">Less clicking.</span>
            <span className="mobile-title">Feedback, simplified.</span>
            <br className="hero-break" />
            <span className="desktop-title">More time for you.</span>
          </h1>
          <p>
            <span className="desktop-title">
              Your feedback, without the repetitive forms. Choose your ratings
              and let us handle each submission to Vidya ERP.
            </span>
            <span className="mobile-title">
              Choose your ratings. We’ll handle the forms.
            </span>
          </p>
          <div className="intro-notes">
            <span>
              <CheckCircle2 size={16} /> Automatic submission
            </span>
            <span>
              <ShieldCheck size={16} /> ERP confirmation checked
            </span>
          </div>
        </section>

        <div className={`workspace ${hasActivity ? "has-activity" : ""}`}>
          <section className="panel setup">
            <div className="panel-heading">
              <div className="step-number">01</div>
              <div>
                <h2>Your feedback</h2>
                <p>Connect your account and choose your ratings.</p>
              </div>
            </div>
            <form onSubmit={(event) => run(event)}>
              <fieldset disabled={busy || Boolean(faculties)}>
                <label htmlFor="username">ERP username</label>
                <input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="e.g. TL24BTAI0000"
                  autoComplete="username"
                  required
                  spellCheck={false}
                  autoCapitalize="characters"
                  enterKeyHint="next"
                />
                <div className="label-row">
                  <label htmlFor="password">Password</label>
                  <span>Your ERP login password</span>
                </div>
                <div className="password-field">
                  <input
                    id="password"
                    type={visible ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder="Enter password"
                    enterKeyHint="done"
                  />
                  <button
                    type="button"
                    aria-label={visible ? "Hide password" : "Show password"}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="section-divider" />
                <label>How would you like to rate?</label>
                <div
                  className="mode-options"
                  role="group"
                  aria-label="Rating mode"
                >
                  <button
                    type="button"
                    className={mode === "set-all" ? "mode selected" : "mode"}
                    aria-pressed={mode === "set-all"}
                    onClick={() => setMode("set-all")}
                  >
                    <Star size={19} />
                    <strong>Same for everyone</strong>
                    <small>One rating across all forms</small>
                    <span className="radio-dot" />
                  </button>
                  <button
                    type="button"
                    className={mode === "custom" ? "mode selected" : "mode"}
                    aria-pressed={mode === "custom"}
                    onClick={() => setMode("custom")}
                  >
                    <SlidersHorizontal size={19} />
                    <strong>By faculty</strong>
                    <small>Choose for each teacher</small>
                    <span className="radio-dot" />
                  </button>
                </div>
                {mode === "set-all" ? (
                  <>
                    <label htmlFor="rating">Your rating</label>
                    <div className="select-wrap">
                      <select
                        id="rating"
                        value={rating}
                        onChange={(event) => setRating(event.target.value)}
                        required
                      >
                        <option value="" disabled>
                          Choose a rating
                        </option>
                        {RATINGS.map((label, index) => (
                          <option key={label} value={index + 1}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={17} />
                    </div>
                    <p className="field-note">
                      Applied to every question in each pending form.
                    </p>
                  </>
                ) : (
                  <p className="field-note custom-note">
                    First, we’ll find your pending forms. Then you can choose a
                    rating for each faculty member.
                  </p>
                )}
                <div className="submit-actions">
                  <button className="primary-button" type="submit">
                    {busy ? (
                      <>
                        <Loader2 className="spin" size={18} /> Working on your
                        feedback…
                      </>
                    ) : (
                      <>
                        {mode === "custom"
                          ? "Find my feedback forms"
                          : "Submit my feedback"}
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                  <p className="submit-note">
                    {mode === "set-all"
                      ? "This submits your selected rating to ERP automatically."
                      : "You’ll review your ratings before submitting."}
                  </p>
                </div>
              </fieldset>
            </form>
            <div className="privacy-note">
              <LockKeyhole size={16} />
              <p>
                Credentials are used for this request and aren’t saved by this
                app.
              </p>
            </div>
          </section>

          <section
            ref={activityRef}
            className="panel activity"
            aria-label="Feedback progress"
            tabIndex={-1}
          >
            <div className="activity-heading">
              <div className="panel-heading">
                <div className="step-number">02</div>
                <div>
                  <h2>
                    {faculties
                      ? "Your faculty, your ratings"
                      : "We’ll take it from here"}
                  </h2>
                  <p>
                    {faculties
                      ? `${faculties.length} pending forms ready to review.`
                      : "Follow every step, from login to confirmed submission."}
                  </p>
                </div>
              </div>
              <span className={`status-pill ${busy ? "active" : ""}`}>
                {busy
                  ? "In progress"
                  : faculties
                    ? "Your turn"
                    : summary
                      ? complete
                        ? "Complete"
                        : "Needs attention"
                      : "Ready when you are"}
              </span>
            </div>
            {error && (
              <div className="result error" role="alert">
                <strong>We couldn’t finish</strong>
                <p>{error}</p>
              </div>
            )}
            {summary && (
              <div
                className={`result ${complete ? "success" : "error"}`}
                role="status"
              >
                <strong>
                  {complete
                    ? summary.total
                      ? "Your feedback is submitted."
                      : "You’re all caught up."
                    : "Some forms need another try."}
                </strong>
                <p>
                  {summary.completed} confirmed · {summary.failed} failed
                  {!summary.total && " · No pending forms found"}
                </p>
              </div>
            )}
            {faculties ? (
              <form onSubmit={(event) => run(event, ratings)}>
                <div className="faculty-list">
                  {faculties.map((faculty, index) => (
                    <div className="faculty-row" key={faculty.id}>
                      <span className="faculty-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <label htmlFor={`faculty-${faculty.id}`}>
                          {faculty.name}
                        </label>
                        <p>{faculty.course}</p>
                        <select
                          id={`faculty-${faculty.id}`}
                          required
                          disabled={busy}
                          value={ratings[faculty.id] || ""}
                          onChange={(event) =>
                            setRatings({
                              ...ratings,
                              [faculty.id]: Number(event.target.value),
                            })
                          }
                        >
                          <option value="" disabled>
                            Choose a rating
                          </option>
                          {RATINGS.map((label, i) => (
                            <option value={i + 1} key={label}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="faculty-actions">
                  <p className="rating-count" aria-live="polite">
                    {Object.keys(ratings).length} of {faculties.length} ratings
                    chosen
                  </p>
                  <button className="primary-button" disabled={busy || !ready}>
                    {busy
                      ? "Submitting & verifying…"
                      : `Submit ${faculties.length} feedback forms`}
                    <ArrowRight size={18} />
                  </button>
                  <button
                    type="button"
                    className="back-button"
                    disabled={busy}
                    onClick={() => setFaculties(null)}
                  >
                    Back to setup
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="progress-summary">
                  <span>
                    {busy
                      ? "Making progress"
                      : summary
                        ? "Run finished"
                        : "Submission progress"}
                  </span>
                  <strong>{progress}%</strong>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="Submission progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div style={{ width: `${progress}%` }} />
                </div>
                <ol className="steps">
                  {STAGES.map(([key, label], index) => {
                    const step = steps[key];
                    const failed = key === "submit" && summary?.failed > 0;
                    return (
                      <li
                        key={key}
                        className={
                          step?.progress === 100 && !failed
                            ? "step done"
                            : step?.progress > 0
                              ? "step current"
                              : "step"
                        }
                      >
                        <span className="step-indicator">
                          {step?.progress === 100 && !failed ? (
                            <Check size={16} />
                          ) : busy &&
                            step?.progress > 0 &&
                            step.progress < 100 ? (
                            <Loader2 size={16} className="spin" />
                          ) : (
                            String(index + 1).padStart(2, "0")
                          )}
                        </span>
                        <div>
                          <strong>{label}</strong>
                          <p>
                            {step?.message ||
                              [
                                "Securely connect with your student login",
                                "Locate the right feedback forms",
                                "Use your latest semester",
                                "Check the available feedback session",
                                "Skip forms already submitted",
                                "Send your ratings and confirm with ERP",
                              ][index]}
                          </p>
                        </div>
                        {key === "submit" && step?.total > 0 && (
                          <span className="count">
                            {step.completed}/{step.total}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
                <div className="activity-bottom">
                  <ShieldCheck size={19} />
                  <p>
                    Done means submitted.
                    <br />
                    <span>Each form is checked against its status in ERP.</span>
                  </p>
                </div>
              </>
            )}
            {logs.length > 0 && (
              <details className="logs">
                <summary>View activity details</summary>
                <pre>{logs.join("\n")}</pre>
              </details>
            )}
          </section>
        </div>
        <footer>
          <span>Made for a little less busywork.</span>
          <a
            href="https://erp.vidyaacademy.ac.in/#"
            target="_blank"
            rel="noreferrer"
          >
            Open Vidya ERP <ArrowUpRight size={14} />
          </a>
        </footer>
      </main>
    </div>
  );
}
