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
      background: "white",
      padding: "40px",
      borderRadius: "16px",
      boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
      width: "100%",
      maxWidth: "400px",
      textAlign: "center",
    },
    title: {
      margin: "0 0 10px 0",
      color: "#333",
      fontSize: "2rem",
      fontWeight: "800",
    },
    subtitle: {
      color: "#666",
      marginBottom: "30px",
      fontSize: "0.95rem",
    },
    studentBtn: {
      width: "100%",
      padding: "16px",
      fontSize: "1.1rem",
      fontWeight: "600",
      color: "white",
      background: "#10B981",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "10px",
      marginBottom: "16px",
      boxShadow: "0 4px 6px rgba(16, 185, 129, 0.3)",
      transition: "transform 0.1s",
    },
    teacherBtn: {
      width: "100%",
      padding: "12px",
      fontSize: "0.95rem",
      color: "#555",
      background: "#f3f4f6",
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
      cursor: "pointer",
      fontWeight: "500",
    },
    input: {
      width: "100%",
      padding: "12px",
      marginBottom: "12px",
      borderRadius: "8px",
      border: "1px solid #ddd",
      fontSize: "1rem",
      boxSizing: "border-box",
    },
  };

  return (
    <div style={loginStyles.container}>
      <div style={loginStyles.card}>
        <h1 style={loginStyles.title}>CBA Card System</h1>

        {(!authChecked || checkingAdmin) ? (
          <div style={{ color: "#666", padding: 20 }}>Cargando...</div>
        ) : !showAdminForm ? (
          <>
            <p style={loginStyles.subtitle}>Selecciona cómo quieres entrar</p>

            <button
              style={loginStyles.studentBtn}
              onClick={enterReader}
              onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.02)"}
              onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              🎒 Soy Alumno (Invitado)
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0", opacity: 0.5 }}>
              <div style={{ height: 1, background: "#ccc", flex: 1 }}></div>
              <span style={{ fontSize: 12 }}>O</span>
              <div style={{ height: 1, background: "#ccc", flex: 1 }}></div>
            </div>

            <button
              style={loginStyles.teacherBtn}
              onClick={() => setShowAdminForm(true)}
            >
              👨‍🏫 Soy Profe (Admin)
            </button>
          </>
        ) : (
          <>
            <p style={loginStyles.subtitle}>Acceso para profesores</p>
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
                <div style={{ color: "crimson", fontSize: "0.9rem", marginBottom: 12 }}>
                  {adminError}
                </div>
              )}

              <button
                type="submit"
                style={{ ...loginStyles.studentBtn, background: "#4F46E5", boxShadow: "0 4px 6px rgba(79, 70, 229, 0.3)" }}
              >
                Entrar
              </button>
            </form>

            <button
              style={{ background: "none", border: "none", color: "#666", cursor: "pointer", textDecoration: "underline", marginTop: 10 }}
              onClick={() => {
                setShowAdminForm(false);
                setAdminError("");
              }}
            >
              ← Volver atrás
            </button>
          </>
        )}
      </div>
    </div>
  );
}