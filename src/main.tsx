// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./api/client";        // 既存の読み込み維持
import Root from "./Root";    // 追加

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
