import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import CandidatePage from "./pages/CandidatePage";
import HRPage from "./pages/HRPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/candidate" element={<CandidatePage />} />
        <Route path="/hr" element={<HRPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
