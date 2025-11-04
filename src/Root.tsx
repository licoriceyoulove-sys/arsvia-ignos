// src/Root.tsx
import React, { useEffect, useState } from "react";
import QuizApp from "./QuizApp";
import Login from "./api/components/Login";

type User = { id: string; name: string };

const Root: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth_user");
      if (raw) setUser(JSON.parse(raw));
    } catch {
      localStorage.removeItem("auth_user");
    }
  }, []);

  if (!user) return <Login onSuccess={(u) => setUser(u)} />;
  return <QuizApp />;
};

export default Root;
