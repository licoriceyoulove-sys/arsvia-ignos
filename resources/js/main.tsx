import React from "react";
import ReactDOM from "react-dom/client";
import QuizApp from "./QuizApp";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QuizApp />
  </React.StrictMode>
);
