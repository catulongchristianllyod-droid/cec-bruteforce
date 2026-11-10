
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import "./AdminDashboard.css";

export default function AdminDashboard({ onLogout }) {
  const [attempts, setAttempts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboardData = useCallback(async () => {
    try {
      const [attemptResult, alertResult] = await Promise.all([
        supabase
          .from("login_attempts")
          .select("*")
          .order("attempted_at", { ascending: false })
          .limit(1000),

        supabase
          .from("security_alerts")
          .select("*")
          .limit(100),
      ]);

      if (attemptResult.error) {
        throw attemptResult.error;
      }

      if (alertResult.error) {
        console.error(
          "Unable to load security alerts:",
          alertResult.error.message
        );
      }

      setAttempts(attemptResult.data || []);
      setAlerts(alertResult.data || []);
      setErrorMessage("");
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Dashboard error:", error);
      setErrorMessage(
        "Unable to load login records. Check your Supabase connection and permissions."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();

    const interval = setInterval(() => {
      loadDashboardData();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadDashboardData]);

  const successful = attempts.filter(
    (item) => item.status === "success"
  ).length;

  const failed = attempts.filter(
    (item) => item.status === "failed"
  ).length;

  const blocked = attempts.filter(
    (item) => item.status === "blocked"
  ).length;

  function formatDate(value) {
    if (!value) return "Unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Unavailable";
    }

    return date.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function getLocation(item) {
    const parts = [
      item.city,
      item.region,
      item.country,
    ].filter(Boolean);

    return parts.length
      ? parts.join(", ")
      : "Unavailable";
  }

  function getStatusClass(status) {
    if (status === "success") return "status-success";
    if (status === "failed") return "status-failed";
    if (status === "blocked") return "status-blocked";
    return "status-unknown";
  }

  function getAlertDescription(alert) {
    return (
      alert.message ||
      alert.description ||
      alert.alert_type ||
      alert.type ||
      "Security alert"
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <h1>🛡️ CEC Security Center</h1>
          <p>Brute-Force Attack Detection System</p>
        </div>

        {/* Updated Logout Design Only */}
        <button
          type="button"
          className="logout-button"
          onClick={onLogout}
          aria-label="Log out of CEC Security Center"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          <span>Logout</span>
        </button>
      </header>

      <section className="admin-content">
        <div className="dashboard-heading">
          <div>
            <h2>Security Overview</h2>
            <p>
              Monitoring authentication activity
            </p>
          </div>

          <div className="dashboard-controls">
            <span className="monitoring-label">
              ● Auto Refresh: 5 seconds
            </span>

            <button
              className="refresh-button"
              onClick={loadDashboardData}
            >
              Refresh Now
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="dashboard-error" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <span>Total Attempts</span>
            <strong>{attempts.length}</strong>
          </div>

          <div className="stat-card success-card">
            <span>Successful Logins</span>
            <strong>{successful}</strong>
          </div>

          <div className="stat-card failed-card">
            <span>Failed Logins</span>
            <strong>{failed}</strong>
          </div>

          <div className="stat-card blocked-card">
            <span>Blocked Attempts</span>
            <strong>{blocked}</strong>
          </div>

          <div className="stat-card alert-card">
            <span>Security Alerts</span>
            <strong>{alerts.length}</strong>
          </div>
        </div>

        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h3>Recent Login Activity</h3>
              <p>
                Latest 1,000 records from Supabase
              </p>
            </div>

            <span className="record-count">
              {attempts.length} records
            </span>
          </div>

          <div className="table-wrapper">
            <table className="login-table">
              <thead>
                <tr>
                  <th>Email / Username</th>
                  <th>Status</th>
                  <th>IP Address</th>
                  <th>ISP</th>
                  <th>City</th>
                  <th>Region</th>
                  <th>Country</th>
                  <th>Device / Browser</th>
                  <th>MAC Address</th>
                  <th>Date & Time</th>
                </tr>
              </thead>

              <tbody>
                {loading && attempts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="empty-table">
                      Loading login records...
                    </td>
                  </tr>
                ) : attempts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="empty-table">
                      No login records available.
                    </td>
                  </tr>
                ) : (
                  attempts.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.attempted_username ||
                          "Unknown"}
                      </td>

                      <td>
                        <span
                          className={
                            "status-badge " +
                            getStatusClass(item.status)
                          }
                        >
                          {item.status || "Unknown"}
                        </span>
                      </td>

                      <td>
                        {item.ip_address ||
                          "Unavailable"}
                      </td>

                      <td>
                        {item.isp || "Unavailable"}
                      </td>

                      <td>
                        {item.city || "Unavailable"}
                      </td>

                      <td>
                        {item.region || "Unavailable"}
                      </td>

                      <td>
                        {item.country || "Unavailable"}
                      </td>

                      <td
                        className="device-cell"
                        title={
                          item.device_info ||
                          item.user_agent ||
                          ""
                        }
                      >
                        {item.device_info ||
                          item.user_agent ||
                          "Unavailable"}
                      </td>

                      <td>Unavailable</td>

                      <td>
                        {formatDate(item.attempted_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h3>Security Alerts</h3>
              <p>
                Alerts saved in your Supabase database
              </p>
            </div>
          </div>

          {alerts.length === 0 ? (
            <p className="no-alerts">
              No security alerts recorded.
            </p>
          ) : (
            <div className="alerts-list">
              {alerts.map((alert, index) => (
                <div
                  className="security-alert"
                  key={alert.id || index}
                >
                  <strong>
                    ⚠️ {getAlertDescription(alert)}
                  </strong>

                  <span>
                    {formatDate(
                      alert.created_at ||
                      alert.detected_at
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="dashboard-footer">
          <p>
            Last Updated:{" "}
            {lastUpdated
              ? lastUpdated.toLocaleTimeString("en-PH", {
                  timeZone: "Asia/Manila",
                })
              : "Waiting..."}
          </p>

          <p>
            CEC Cybersecurity Monitoring Project
          </p>
        </footer>
      </section>
    </main>
  );
}
