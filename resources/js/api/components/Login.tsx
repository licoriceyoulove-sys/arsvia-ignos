import React, { useState } from "react";
import { login } from "../auth";

type Props = {
  onSuccess: (user: { id: string; name: string }) => void;
};

const Login: React.FC<Props> = ({ onSuccess }) => {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) {
      setError("IDとパスワードを入力してください");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await login(userId.trim(), password);
      // 画面遷移用に軽く保存（必要に応じて外す/変更OK）
      localStorage.setItem("auth_user", JSON.stringify(res.user));
      onSuccess(res.user);
    } catch (err: any) {
      setError(err?.message || "ログインに失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-50 via-slate-100 to-slate-200">
      <div className="w-full max-w-sm px-5">
        {/* ガラスカード */}
        <div className="rounded-3xl p-6 backdrop-blur-xl bg-white/20 border border-white/30 shadow-2xl ring-1 ring-white/20">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-black text-white font-bold grid place-items-center">I</div>
            <div className="font-bold text-lg text-slate-900">Ignos</div>
          </div>

          <h1 className="text-xl font-semibold text-slate-900 mb-4">ログイン</h1>
          <p className="text-sm text-slate-600 mb-4">
            招待されたIDとパスワードを入力してください。
          </p>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-800">ID</span>
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-white/50 bg-white/50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500"
                placeholder="your-id"
                autoComplete="username"
                inputMode="text"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-800">パスワード</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-white/50 bg-white/50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>

            {error && (
              <div className="text-sm text-red-600 bg-white/60 rounded-xl px-3 py-2 border border-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className={`w-full py-3 rounded-2xl font-bold text-white transition
                ${busy ? "bg-slate-400" : "bg-slate-900 hover:opacity-90"}`}
            >
              {busy ? "サインイン中…" : "サインイン"}
            </button>
          </form>

          <div className="mt-4 text-[12px] text-slate-500">
            学校・教育委員会向けのテスト用アカウントをご利用ください。
          </div>
        </div>

        {/* うっすらした“影”/ ガラス感を強調 */}
        <div className="mt-4 blur-xl opacity-60 h-8 rounded-full bg-white/50" />
      </div>
    </div>
  );
};

export default Login;
