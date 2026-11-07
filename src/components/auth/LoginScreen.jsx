import EyeToggleButton from "../common/EyeToggleButton";

export default function LoginScreen({
  authChecked,
  checkingAdmin,
  showAdminForm,
  setShowAdminForm,
  adminEmail,
  setAdminEmail,
  adminPass,
  setAdminPass,
  adminError,
  setAdminError,
  enterReader,
  loginAdminEmailPassword,
  focusMode = false,
  onToggleFocus,
}) {
  const loginStyles = {
    container: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url("https://firebasestorage.googleapis.com/v0/b/pokematicos.firebasestorage.app/o/backgrounds%2FBackground%20panoramic.jpg?alt=media&token=33b4b912-6e8f-4bf4-8b67-94e250310150")',
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      fontFamily: "'Inter', sans-serif",
      padding: 20,
    },
    card: {
      background: "rgba(255, 255, 255, 0.15)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      border: "1px solid rgba(255, 255, 255, 0.3)",
      borderRadius: "24px",
      boxShadow: "0 24px 48px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.4)",
      padding: "36px 32px",
      width: "100%",
      maxWidth: "440px",
      textAlign: "center",
      boxSizing: "border-box",
      transition: "all 200ms ease",
    },
    title: {
      margin: 0,
      color: "#ffffff",
      fontSize: "1.75rem",
      fontWeight: "800",
      letterSpacing: "-0.02em",
      lineHeight: 1.25,
      textShadow: "0 2px 10px rgba(0, 0, 0, 0.35)",
    },
    subtitle: {
      color: "rgba(255, 255, 255, 0.85)",
      fontSize: "0.95rem",
      fontWeight: "600",
      margin: "8px 0 26px 0",
      letterSpacing: "0.01em",
    },
    studentBtn: {
      width: "100%",
      padding: "16px 20px",
      fontSize: "1.05rem",
      fontWeight: "700",
      color: "#ffffff",
      background: "linear-gradient(135deg, rgba(16, 185, 129, 0.88), rgba(5, 150, 105, 0.88))",
      border: "1px solid rgba(255, 255, 255, 0.3)",
      borderRadius: "14px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "10px",
      boxShadow: "0 6px 20px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
      transition: "all 180ms ease",
    },
    teacherBtn: {
      width: "100%",
      padding: "15px 20px",
      fontSize: "1rem",
      color: "#ffffff",
      background: "rgba(255, 255, 255, 0.16)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      border: "1px solid rgba(255, 255, 255, 0.32)",
      borderRadius: "14px",
      cursor: "pointer",
      fontWeight: "700",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.35)",
      transition: "all 180ms ease",
    },
    input: {
      width: "100%",
      padding: "14px 16px",
      marginBottom: "14px",
      borderRadius: "12px",
      border: "1px solid rgba(255, 255, 255, 0.4)",
      background: "rgba(255, 255, 255, 0.92)",
      fontSize: "1rem",
      color: "#0f172a",
      boxSizing: "border-box",
      outline: "none",
      boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.06)",
      transition: "all 160ms ease",
    },
  };

  if (focusMode) {
    return (
      <div style={{ ...loginStyles.container, alignItems: "flex-start", justifyContent: "flex-start", backgroundImage: loginStyles.container.backgroundImage.slice(loginStyles.container.backgroundImage.indexOf("url(")) }}>
        <EyeToggleButton focusMode onToggle={onToggleFocus} />
      </div>
    );
  }

  return (
    <div style={loginStyles.container}>
      <EyeToggleButton focusMode={false} onToggle={onToggleFocus} />

      <div style={loginStyles.card}>
        <h1 style={loginStyles.title}>CBA Cards and Points System</h1>

        {(!authChecked || checkingAdmin) ? (
          <div style={{ color: "#ffffff", padding: 24, fontWeight: 700, textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>Loading...</div>
        ) : !showAdminForm ? (
          <>
            <div style={loginStyles.subtitle}>
              Log in as a...
            </div>

            <button
              style={loginStyles.studentBtn}
              onClick={enterReader}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.5)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.4)";
              }}
            >
              🎒 Student (Guest)
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "22px 0" }}>
              <div style={{ height: 1, background: "rgba(255, 255, 255, 0.25)", flex: 1 }}></div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "rgba(255, 255, 255, 0.75)",
                  letterSpacing: "0.08em",
                }}
              >
                OR
              </span>
              <div style={{ height: 1, background: "rgba(255, 255, 255, 0.25)", flex: 1 }}></div>
            </div>

            <button
              style={loginStyles.teacherBtn}
              onClick={() => setShowAdminForm(true)}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.24)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.45)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.16)";
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.35)";
              }}
            >
              👨‍🏫 Teacher (Admin)
            </button>
          </>
        ) : (
          <>
            <div style={{ ...loginStyles.subtitle, fontSize: "1.1rem", fontWeight: 700, margin: "8px 0 20px", color: "#ffffff" }}>
              Access for teachers
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loginAdminEmailPassword();
              }}
            >
              <input
                style={loginStyles.input}
                type="email"
                placeholder="Email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                autoFocus
              />
              <input
                style={loginStyles.input}
                type="password"
                placeholder="Password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
              />

              {adminError && (
                <div
                  style={{
                    color: "#fecaca",
                    fontSize: "0.9rem",
                    marginBottom: 14,
                    background: "rgba(185, 28, 28, 0.55)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    padding: "8px 14px",
                    borderRadius: 12,
                    fontWeight: 600,
                  }}
                >
                  {adminError}
                </div>
              )}

              <button
                type="submit"
                style={{
                  ...loginStyles.studentBtn,
                  background: "linear-gradient(135deg, rgba(79, 70, 229, 0.9), rgba(67, 56, 202, 0.9))",
                  boxShadow: "0 6px 20px rgba(79, 70, 229, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.35)",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(79, 70, 229, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(79, 70, 229, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.35)";
                }}
              >
                Login
              </button>
            </form>

            <button
              type="button"
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                color: "#ffffff",
                padding: "10px 20px",
                borderRadius: "12px",
                fontWeight: 600,
                fontSize: "0.95rem",
                cursor: "pointer",
                marginTop: 18,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
                transition: "all 160ms ease",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.22)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
              }}
              onClick={() => {
                setShowAdminForm(false);
                setAdminError("");
              }}
            >
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}