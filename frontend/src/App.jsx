import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import CandidatePage from "./pages/CandidatePage";
import HRPage from "./pages/HRPage";
import OATest from "./pages/OATest";
import InterviewTest from "./pages/InterviewTest";

function App() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("uiTheme") || "dark"
  );

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("uiTheme", theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <button
        type="button"
        className="theme-toggle"
        onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
      >
        {theme === "dark" ? "Light Mode" : "Dark Mode"}
      </button>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/candidate" element={<CandidatePage />} />
        <Route path="/oa/:role" element={<OATest />} />
        <Route path="/oa-test" element={<OATest />} />
        <Route path="/interview/:role" element={<InterviewTest />} />
        <Route path="/hr" element={<HRPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
