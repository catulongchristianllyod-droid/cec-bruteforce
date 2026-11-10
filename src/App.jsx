
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import AdminDashboard from "./AdminDashboard";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function checkUser(currentSession) {
      if (!currentSession?.user) {
        if (active) {
          setSession(null);
          setIsAdmin(false);
          setChecking(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("security_admins")
        .select("user_id")
        .eq("user_id", currentSession.user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error(
          "Admin verification failed:",
          error.message
        );
      }

      setSession(currentSession);
      setIsAdmin(!error && Boolean(data));
      setChecking(false);
    }

    supabase.auth.getSession().then(
      ({ data, error }) => {
        if (error) {
          console.error(
            "Session check failed:",
            error.message
          );
        }

        if (active) {
          checkUser(data?.session ?? null);
        }
      }
    );

    const { data: listener } =
      supabase.auth.onAuthStateChange(
        (_event, newSession) => {
          setTimeout(() => {
            if (active) {
              checkUser(newSession);
            }
          }, 0);
        }
      );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(event) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      // Authenticate through the monitoring backend.
      const { data, error } =
        await supabase.functions.invoke(
          "login-monitor",
          {
            body: {
              email: email.trim(),
              password,
            },
          }
        );

      if (error) {
        console.error(
          "Login monitor request failed:",
          error.message
        );

        const status = error.context?.status;

        if (status === 429) {
          setMessage(
            "Too many login attempts. Please try again later."
          );
        } else if (status === 401) {
          setMessage("Invalid email or password.");
        } else {
          setMessage(
            "Login service unavailable. Please try again later."
          );
        }

        return;
      }

      if (
        !data?.session?.access_token ||
        !data?.session?.refresh_token
      ) {
        setMessage(
          "Unable to establish your session."
        );
        return;
      }

      // Establish the session in the browser.
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError || !sessionData?.session) {
        console.error(
          "Session establishment failed:",
          sessionError?.message
        );

        setMessage(
          "Login succeeded, but your session could not be established."
        );
        return;
      }

      const currentSession = sessionData.session;

      // Verify administrator permissions.
      const { data: admin, error: adminError } =
        await supabase
          .from("security_admins")
          .select("user_id")
          .eq("user_id", currentSession.user.id)
          .maybeSingle();

      if (adminError) {
        console.error(
          "Admin verification error:",
          adminError.message
        );

        setMessage(
          "Unable to verify administrator access."
        );
        return;
      }

      setSession(currentSession);
      setIsAdmin(Boolean(admin));

      if (!admin) {
        setMessage(
          "Login successful, but this account is not an administrator."
        );
      }
    } catch (error) {
      console.error(
        "Login connection error:",
        error
      );

      setMessage(
        "Connection error. Please try again."
      );
    } finally {
      setPassword("");
      setLoading(false);
    }
  }

  async function handleLogout() {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "Logout failed:",
        error.message
      );

      setMessage(
        "Unable to log out. Please try again."
      );
      return;
    }

    setSession(null);
    setIsAdmin(false);
    setMessage("");
    setPassword("");
  }

  if (checking) {
    return (
      <main className="page">
        <section className="login-card">
          <h2>CEC Security System</h2>
          <p>Checking your account...</p>
        </section>
      </main>
    );
  }

  if (session && isAdmin) {
    return (
      <AdminDashboard
        onLogout={handleLogout}
      />
    );
  }

  if (session && !isAdmin) {
    return (
      <main className="page">
        <section className="login-card">
          <div className="shield">🛡️</div>

          <h1>Login Successful</h1>

          <p className="subtitle">
            Your account is authenticated,
            but you do not have
            administrator access.
          </p>

          <button
            type="button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="login-card">
        <div className="shield">🛡️</div>

        <h1>CEC Secure Login</h1>

        <p className="subtitle">
          Brute-Force Attack Detection System
        </p>

        <form onSubmit={handleLogin}>
          <label htmlFor="email">
            Email Address
          </label>

          <input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            autoComplete="username"
            required
          />

          <label htmlFor="password">
            Password
          </label>

          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            autoComplete="current-password"
            required
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Checking..."
              : "Sign In"}
          </button>
        </form>

        {message && (
          <div
            className="message error"
            role="status"
          >
            {message}
          </div>
        )}

        <p className="footer">
          CEC Cybersecurity Monitoring Project
        </p>
      </section>
    </main>
  );
}
