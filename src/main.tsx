// src/main.tsx
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import QuizApp from "./QuizApp";
import "./api/client"; // 既存の副作用読み込み維持
import Login from "./api/components/Login";

type User = { id: string; name: string };

function Root() {
  const [user, setUser] = useState<User | null>(null);

  // 起動時にローカル保存のログイン情報を読み込み
  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth_user");
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // 破損時は破棄
      localStorage.removeItem("auth_user");
    }
  }, []);

  // 未ログインならログイン画面を表示
  if (!user) {
    return <Login onSuccess={(u) => setUser(u)} />;
  }

  // ログイン済みならアプリ本体
  return <QuizApp />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
