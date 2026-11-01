import { useState } from "react";
import { api } from "../api.js";
import { ChatBubbleIcon, LockIcon, UserIcon } from "./Icons.jsx";
import WaveArt from "./WaveArt.jsx";

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const authenticate = isLogin ? api.login : api.register;
      const { token, user } = await authenticate({ username, password });
      onAuthenticated(token, user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode() {
    setMode(isLogin ? "register" : "login");
    setError("");
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-brand-900 p-4 sm:p-8">
      <div className="flex w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/30 md:min-h-[580px]">
        <section className="flex w-full flex-col px-8 py-10 sm:px-12 md:w-[40%]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-800 text-white">
              <ChatBubbleIcon className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-brand-900">Chatter</span>
          </div>

          <div className="flex flex-1 flex-col justify-center py-10">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-800 text-white">
                <UserIcon className="h-7 w-7" />
              </div>
              <h1 className="text-xl font-semibold text-brand-900">{isLogin ? "Sign in" : "Create account"}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {isLogin ? "Enter your details to continue" : "It only takes a few seconds"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <label className="pill-input">
                <UserIcon className="h-4 w-4 shrink-0 text-brand-700" />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Username"
                  aria-label="Username"
                  required
                  autoFocus
                  autoComplete="username"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </label>
              <label className="pill-input">
                <LockIcon className="h-4 w-4 shrink-0 text-brand-700" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isLogin ? "Password" : "Password (8+ characters)"}
                  aria-label="Password"
                  required
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </label>

              {error && <p className="px-4 text-sm text-red-600">{error}</p>}

              <button type="submit" disabled={submitting} className="primary-button w-full py-2.5 text-sm uppercase">
                {submitting ? "Please wait…" : isLogin ? "Login" : "Sign up"}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-slate-500">
            {isLogin ? "Don't have an account?" : "Already registered?"}{" "}
            <button onClick={switchMode} className="font-semibold text-brand-800 hover:underline">
              {isLogin ? "Sign up now" : "Sign in"}
            </button>
          </p>
        </section>

        <section className="relative hidden flex-1 md:block">
          <WaveArt />
          <div className="relative flex h-full flex-col justify-end p-12 text-right">
            <h2 className="text-6xl font-extrabold tracking-tight text-white">Welcome.</h2>
            <p className="ml-auto mt-4 max-w-xs text-sm leading-relaxed text-brand-100">
              Real-time rooms, instant messages and live presence. Pick up every conversation right where you left
              it.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
