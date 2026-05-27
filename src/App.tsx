import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/members" element={<Navigate to="/" replace />} />
        <Route path="/whoarethey" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
