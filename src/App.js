import React, { useMemo, useRef, useState } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, storage, auth } from "./firebase";
import LibrarySection from "./components/cards/LibrarySection";
import CardEditModal from "./components/cards/CardEditModal";
import ProfileModal from "./components/profile/ProfileModal";
import ManageStudentModal from "./components/students/ManageStudentModal";
import LoginScreen from "./components/auth/LoginScreen";
import ClassesPanel from "./components/classes/ClassesPanel";
import StudentsPanel from "./components/students/StudentsPanel";
import { addStudent, editStudent, deleteStudent } from "./services/studentService";
import {
  addStreakTypeForClass,
  changeStudentStreakValue,
  deleteStreakTypeForClass,
  resetStudentStreak,
  setStreakRewardCardsForClass,
} from "./services/streakService";
import {
  createReward as createRewardService,
  deleteReward as deleteRewardService,
} from "./services/rewardService";
import {
  quickAddPoints as quickAddPointsService,
  removeOwnedCardsBulk as removeOwnedCardsBulkService,
  redeemIndividual as redeemIndividualService,
  redeemGroup as redeemGroupService,
} from "./services/studentRewardService";
import {
  createCard as createCardService,
  updateCard as updateCardService,
  deleteCard as deleteCardService,
  giveCardToStudent as giveCardToStudentService,
  giveCardToStudentsBulk as giveCardToStudentsBulkService,
} from "./services/cardService";
import { safeLower, PASTEL_COLORS } from "./utils/helpers";
import useBackgroundManager from "./hooks/useBackgroundManager";
import useClassData from "./hooks/useClassData";
import useAuthMode from "./hooks/useAuthMode";
/**
 * Pokemáticos — Firestore + Storage (single-file App.js)
 *
 * What this version adds back (from your old localStorage version) + fixes:
 * - Guest vs Admin mode (guests cannot Manage; they can only view cards and open a Profile modal)
 * - Student filter
 * - Rewards redeem: choose Individual or Group BEFORE redeeming
 *   - Group redeem lets you assign shares across students that MUST sum exactly to reward cost
 * - Owned cards are grouped (×N). Remove all uses ONE confirm and ONE database update (no spam)
 * - Library shows LOCKED card image; when you give a card to a student they receive UNLOCKED image
 * - Giving a card is silent (no success alert)
 *
 * IMPORTANT SECURITY NOTE (guest profile customisation):
 * Guests can edit profile emojis/background color without login in this UI.
 * That requires Firestore rules to allow updating ONLY those fields,
 * otherwise saving will fail. See rule note at the bottom.
 */

export default function App() {
  // ----- Mode -----
  const {
    mode,
    setMode,
    authUser,
    authChecked,
    showAdminForm,
    setShowAdminForm,
    adminEmail,
    setAdminEmail,
    adminPass,
    setAdminPass,
    adminError,
    setAdminError,
    checkingAdmin,
    enterReader,
    loginAdminEmailPassword,
    logout,
  } = useAuthMode({ auth, db });

  // ----- Data -----
  const [activeClassId, setActiveClassId] = useState(null);

  const {
    classesList,
    students,
    cards,
    rewards,
    loadingClasses,
    loadingStudents,
    loadingCards,
    loadingRewards,
    errorMsg,
  } = useClassData({ db, activeClassId });

  // ----- UI -----
  const [studentFilter, setStudentFilter] = useState("");
  const [cardPreview, setCardPreview] = useState(null);

  
  const [bulkGiveCard, setBulkGiveCard] = useState(null); // card object
  const [bulkGiveSelectedIds, setBulkGiveSelectedIds] = useState([]);
  // Admin manage modal selection (admin-only)
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // Profile modal selection (guest + admin)
  const [profileStudentId, setProfileStudentId] = useState(null);

  const newClassNameRef = useRef(null);
  const newStudentRef = useRef(null);

  // two file inputs for cards
  const lockedFileInputRef = useRef(null);
  const unlockedFileInputRef = useRef(null);

  const activeClass = useMemo(
    () => classesList.find((c) => c.id === activeClassId) || null,
    [classesList, activeClassId]
  );

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const profileStudent = useMemo(
    () => students.find((s) => s.id === profileStudentId) || null,
    [students, profileStudentId]
  );

  const {
    stickyBackground,
    globalBackgroundUrl,
    bgInputRef,
    uploadBackgroundImage,
    clearBackgroundImage,
  } = useBackgroundManager({
    db,
    storage,
    activeClassId,
    activeClass,
  });

  const [editCard, setEditCard] = useState(null);

  // ----- Guards -----
  function ensureClassSelected() {
    if (!activeClassId) {
      alert("Please select or create a class first.");
      return false;
    }
    return true;
  }

  // ----- Class actions (extracted to services/classService.js) -----

  // Navigate through owned cards
  function ownedNav(delta) {
    setCardPreview((prev) => {
      if (!prev?.ownedList || prev.ownedList.length === 0) return prev;

      const max = prev.ownedList.length - 1;
      const currentIndex = Number.isFinite(prev.ownedIndex) ? prev.ownedIndex : 0;
      const nextIndex = Math.min(max, Math.max(0, currentIndex + delta));

      return { ...prev, ownedIndex: nextIndex };
    });
  }

  async function updateCard(cardId, updates) {
    await updateCardService({
      db,
      storage,
      classId: activeClassId,
      cardId,
      updates,
      alertFn: alert,
    });
  }


  // --- CLASS STREAK TYPES (per class) ---

  async function getCardDataFast(classId, cardId) {
    const local = (Array.isArray(cards) ? cards : []).find((c) => c.id === cardId);
    if (local) return local;

    const snap = await getDoc(doc(db, `classes/${classId}/cards/${cardId}`));
    if (!snap.exists()) return null;
    return { id: cardId, ...snap.data() };
  }

  async function quickAddPoints(classId, studentId, amount) {
    await quickAddPointsService({
      db,
      classId,
      studentId,
      amount,
      alertFn: alert,
    });
  }

  // Profile cosmetics (guest allowed if rules permit)
  async function saveStudentProfileCosmetics(
    classId,
    studentId,
    { nameEmojis, profileColor }
  ) {
    const safeEmojis = (nameEmojis || "").toString().slice(0, 2);
    const safeColor = (profileColor || "").toString();
    try {
      await updateDoc(doc(db, `classes/${classId}/students/${studentId}`), {
        nameEmojis: safeEmojis,
        profileColor: safeColor,
      });
    } catch (err) {
      console.error(err);
      alert("Could not save profile. (Check Firestore rules)");
    }
  }

  // ----- Cards: locked + unlocked -----
  async function createCard({
    title,
    description,
    points = 0,
    category = "points",
    linkedStreakIds = [],
    lockedFile,
    unlockedFile,
  }) {
    if (!ensureClassSelected()) return;

    await createCardService({
      db,
      storage,
      classId: activeClassId,
      title,
      description,
      points,
      category,
      linkedStreakIds,
      lockedFile,
      unlockedFile,
      lockedFileInputRef,
      unlockedFileInputRef,
      alertFn: alert,
    });
  }

  async function deleteCard(cardId) {
    await deleteCardService({
      db,
      classId: activeClassId,
      cardId,
      alertFn: alert,
    });
  }

  // Give card (silent success, no alert). Hard rule: don't give rewards-category cards here.
  async function giveCardToStudent(classId, studentId, cardId) {
    await giveCardToStudentService({
      db,
      classId,
      studentId,
      cardId,
      activeClass,
      getCardDataFast,
      alertFn: alert,
    });
  }

  // Bulk give: give ONE library card to MANY students (points are multiplied by each student's multiplier).
  // Uses per-student reads to keep it correct even if points/cards changed elsewhere.
  async function giveCardToStudentsBulk(classId, cardId, studentIds) {
    await giveCardToStudentsBulkService({
      db,
      classId,
      cardId,
      studentIds,
      activeClass,
      getCardDataFast,
      alertFn: alert,
    });
  }

  function openBulkGive(card) {
    setBulkGiveCard(card);
    setBulkGiveSelectedIds([]);
  }

  function toggleBulkGiveStudent(studentId) {
    setBulkGiveSelectedIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  }

  function toggleBulkGiveSelectAll() {
    setBulkGiveSelectedIds((prev) => (prev.length === students.length ? [] : students.map((s) => s.id)));
  }
  
  // Owned cards removal (bulk) - ONE updateDoc
  async function removeOwnedCardsBulk(classId, studentId, ownedIds) {
    await removeOwnedCardsBulkService({
      db,
      classId,
      studentId,
      ownedIds,
      alertFn: alert,
    });
  }

  // ----- Rewards -----
  async function createReward({ title, cost, linkedCardId }) {
    if (!ensureClassSelected()) return;
    await createRewardService({
      db,
      classId: activeClassId,
      title,
      cost,
      linkedCardId,
      alertFn: alert,
    });
  }

  async function deleteReward(rewardId) {
    await deleteRewardService({
      db,
      classId: activeClassId,
      rewardId,
      alertFn: alert,
    });
  }

  async function redeemIndividual(classId, studentId, rewardId) {
    await redeemIndividualService({
      db,
      classId,
      studentId,
      rewardId,
      rewards,
      students,
      cards,
      alertFn: alert,
    });
  }

  async function redeemGroup(classId, rewardId, participants) {
    await redeemGroupService({
      db,
      classId,
      rewardId,
      participants,
      rewards,
      students,
      cards,
      alertFn: alert,
    });
  }

  // ----- IMPROVED LOGIN SCREEN -----
  if (!mode) {
    return <LoginScreen
      authChecked={authChecked}
      checkingAdmin={checkingAdmin}
      showAdminForm={showAdminForm}
      setShowAdminForm={setShowAdminForm}
      adminEmail={adminEmail}
      setAdminEmail={setAdminEmail}
      adminPass={adminPass}
      setAdminPass={setAdminPass}
      adminError={adminError}
      setAdminError={setAdminError}
      enterReader={enterReader}
      loginAdminEmailPassword={loginAdminEmailPassword}
    />;
  }

  const filteredStudents = (() => {
    const q = safeLower(studentFilter).trim();
    if (!q) return students;
    return students.filter((s) => safeLower(s.name).includes(q));
  })();

  const classTotalPoints = students.reduce(
    (sum, s) => sum + Number(s.currentPoints || 0),
    0
  );

  return (
    <div
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        minHeight: "100vh",
        padding: 12,
        backgroundImage: stickyBackground ? `url(${stickyBackground})` : "none",
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        transition: "background-image 1s ease-in-out" // Optional: makes the switch smooth
      }}
    >
      {mode === "admin" && (
      <>
        <input
          type="file"
          accept="image/*"
          ref={bgInputRef}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              uploadBackgroundImage(file);
              e.target.value = "";
            }
          }}
        />
        
        {/* Visual cue for the admin */}
        <div style={{ marginBottom: 5, fontSize: "0.8rem", opacity: 0.7 }}>
          {activeClassId 
            ? `Editing Background for: ${activeClass?.name || "selected class"}` 
            : "Editing Global Background"}
        </div>
  
        <button
          className="btn"
          onClick={() => bgInputRef.current?.click()}
        >
          {activeClassId ? "Set Class Background" : "Set Global Background"}
        </button>
  
        {/* Show "Remove" if the CURRENT context has a background set */}
        {((activeClassId && activeClass?.backgroundUrl) || (!activeClassId && globalBackgroundUrl)) && (
          <button
            className="btn"
            onClick={clearBackgroundImage}
          >
            {activeClassId ? "Revert to Global" : "Remove Global Bg"}
          </button>
        )}
      </>
    )}
      <style>{`
        .card-thumb { transition: transform 160ms ease, box-shadow 160ms ease; transform-origin: center; }
        .card-thumb:hover { transform: scale(1.14); box-shadow: 0 10px 24px rgba(0,0,0,0.25); z-index: 30; }

        /* Contenedor que se mueve por toda la tarjeta */
        .floating-emoji {
          position: absolute;
          top: 0;               /* punto de partida */
          left: 0;
          pointer-events: none;
          animation: drift 16s linear infinite;
        }

        /* Círculo brillante + emoji dentro */
        .floating-emoji-glow {
          width: 90px;
          height: 90px;
          border-radius: 100px;
          display: flex;
          align-items: center;
          justify-content: center;

          /* círculo de luz */
          background: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.98) 0%,
            rgba(255, 255, 255, 0.6) 35%,
            rgba(255, 255, 255, 0.0) 75%
          );

          box-shadow:
            0 0 25px rgba(255, 255, 255, 0.95),
            0 0 55px rgba(255, 255, 255, 0.9),
            0 0 95px rgba(255, 255, 255, 0.8);

          font-size: 60px;     /* tamaño del emoji */
          animation: glowPulse 2.6s ease-in-out infinite;
        }

        /* Movimiento bien grande por toda la tarjeta */
        @keyframes drift {
          0% { transform: translate(-30%, -30%) rotate(0deg); }
          25% { transform: translate(200%, -10%) rotate(8deg); }
          50% { transform: translate(250%, 80%) rotate(16deg); }
          75% { transform: translate(-10%, 70%) rotate(8deg); }
          100% { transform: translate(-30%, -30%) rotate(0deg); }
        }

        /* Soft breathing glow */
        @keyframes glowPulse {
          0% { transform: scale(0.95); opacity: 0.55; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.55; }
        }

        /* Emoji party for reaching maximum streak */
        .emoji-party-layer{
          position:absolute;
          inset:0;
          pointer-events:none;
          z-index: 20;
        }

        .emoji-party-particle{
          position:absolute;
          bottom:-24px;
          will-change: transform, opacity;
          animation-name: partyUp;
          animation-timing-function: ease-out;
          animation-iteration-count: infinite;
        }

        @keyframes partyUp{
          0%   { transform: translate(-50%, 0) scale(0.85); opacity: 0; }
          12%  { opacity: 1; }
          70%  { opacity: 0.9; }
          100% { transform: translate(-50%, -160px) scale(1.15); opacity: 0; }
        }

        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:1000; }
        .modal { background: white; border-radius: 10px; padding: 12px; max-width: 980px; width: 92%; max-height: 90vh; overflow:auto; }

        .muted { color:#6b7280; font-size:13px; }

        .btn{
          padding: 9px 12px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background: white;
          cursor: pointer;
          font-weight: 600;
        }
        .btn:hover{ background:#f9fafb; }
        .btn.primary{
          background:#2563eb;
          color:white;
          border:none;
          box-shadow: 0 6px 16px rgba(37,99,235,.22);
        }
        .btn.primary:hover{ filter: brightness(0.98); }

        .pill { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: #f3f4f6; border: 1px solid #e5e7eb; }
        .column-title-pill {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.25);
          font-size: 14px;
        }

        .input, .select, textarea{
          width: 100%;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          background: #fff;
          outline: none;
        }
        .input:focus, .select:focus, textarea:focus{
          border-color: #93c5fd;
          box-shadow: 0 0 0 4px rgba(147,197,253,.35);
        }

        .panel{
          border: 1px solid #eee;
          background: white;
          border-radius: 14px;
          padding: 12px;
        }

        .chip{
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding: 4px 10px;
          border-radius: 999px;
          background:#f3f4f6;
          font-size: 12px;
          font-weight: 700;
          color:#111827;
        }

        input, textarea, select { font-family: inherit; }
      `}</style>

      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>CBA card system</h1>
          <div style={{ color: "#555" }}>
            {mode === "admin" ? "Admin mode" : "Guest mode"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {authUser ? (
            <button className="btn" onClick={logout}>
              Cerrar sesión
            </button>
          ) : (
            <button className="btn" onClick={() => setMode(null)}>
              Cambiar rol
            </button>
          )}
        </div>
      </header>

      {errorMsg && (
        <div style={{ marginBottom: 12, color: "crimson" }}>{errorMsg}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 360px", gap: 14 }}>
        {/* LEFT: Classes */}
        <ClassesPanel
          loadingClasses={loadingClasses}
          classesList={classesList}
          activeClassId={activeClassId}
          setActiveClassId={setActiveClassId}
          mode={mode}
          db={db}
          newClassNameRef={newClassNameRef}
        />

        {/* Only show these if a class is selected */}
        {activeClassId && (
          <>
            <StudentsPanel
              activeClass={activeClass}
              activeClassId={activeClassId}
              classTotalPoints={classTotalPoints}
              filteredStudents={filteredStudents}
              loadingStudents={loadingStudents}
              mode={mode}
              studentFilter={studentFilter}
              setStudentFilter={setStudentFilter}
              onAddStreak={(classId) => addStreakTypeForClass({
                db,
                classId,
                classesList,
                cards,
                promptFn: window.prompt.bind(window),
                alertFn: window.alert.bind(window),
              })}
              onManageStudent={setSelectedStudentId}
              onProfileStudent={setProfileStudentId}
              onChangeStudentStreak={(classId, studentId, streakId, delta, cfg) =>
                changeStudentStreakValue({
                  db,
                  classId,
                  studentId,
                  streakId,
                  delta,
                  maxValueOrCfg: cfg,
                  promptFn: window.prompt.bind(window),
                  alertFn: window.alert.bind(window),
                  getCardDataFast,
                })
              }
              onQuickAddPoints={quickAddPoints}
              onPreviewCard={setCardPreview}
              onAddStudent={() => {
                const name = newStudentRef.current?.value?.trim();
                if (!name) return alert("Enter name");
                addStudent(db, activeClassId, name, ensureClassSelected, newStudentRef);
                if (newStudentRef.current) newStudentRef.current.value = "";
              }}
              newStudentRef={newStudentRef}
            />

            <LibrarySection
              mode={mode}
              cards={cards}
              rewards={rewards}
              loadingCards={loadingCards}
              loadingRewards={loadingRewards}
              streakConfigs={activeClass?.streakConfigs || []}
              lockedInputRef={lockedFileInputRef}
              unlockedInputRef={unlockedFileInputRef}
              onCreateCard={createCard}
              onPreviewCard={setCardPreview}
              onOpenBulkGive={openBulkGive}
              onEditCard={setEditCard}
              onDeleteCard={deleteCard}
              onCreateReward={createReward}
              onDeleteReward={deleteReward}
            />
          </>
        )}
      </div>

      {/* Card preview modal */}
      {cardPreview && (
        <div
          className="modal-backdrop"
          onClick={() => setCardPreview(null)}
        >
          {/* If it comes from the library (locked card) -> show full info modal */}
          {cardPreview.isLibraryCard ? (
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div
                  style={{
                    width: 360,
                    maxWidth: "100%",
                    height: 500,
                    maxHeight: "70vh",
                    background: "#f6f6f6",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  {cardPreview.imageURL ? (
                    <img
                      src={cardPreview.imageURL}
                      alt={cardPreview.title}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <div style={{ padding: 12 }}>{cardPreview.title}</div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 220 }}>
                  <h3 style={{ marginTop: 0 }}>{cardPreview.title}</h3>
                  <div className="muted">{cardPreview.description}</div>
                  <div style={{ marginTop: 8, fontWeight: 700 }}>
                    {cardPreview.points || 0} pts
                  </div>

                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn" onClick={() => setCardPreview(null)}>
                      Close
                    </button>
                    
                  </div>
                </div>
              </div>
            </div>
          ) : (
            (() => {
              /* Owned card (unlocked) -> image only */
              const ownedList = cardPreview.ownedList || null;
              const ownedIndex = Number.isFinite(cardPreview.ownedIndex) ? cardPreview.ownedIndex : 0;
              const currentOwned = ownedList ? ownedList[ownedIndex] : cardPreview;

              return (
                <div
                 className="ownedCardModal"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    maxWidth: "min(85vw, 720px)",
                    width: "85vw",
                    height: "min(70vh, 520px)",
                    maxHeight: "70vh",
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "transparent",
                    position: "relative",
                    boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {currentOwned?.imageURL ? (
                    <>
                      <img
                        src={currentOwned?.imageURL}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />

                      {/* Left button */}
                      <button
                        type="button"
                        className="cardNavBtn cardNavLeft"
                        disabled={!ownedList || ownedIndex <= 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          ownedNav(-1);
                        }}
                        aria-label="Previous card"
                      >
                        <span className="cardNavIcon" aria-hidden="true">‹</span>
                      </button>

                      {/* Right button */}
                      <button
                        type="button"
                        className="cardNavBtn cardNavRight"
                        disabled={!ownedList || ownedIndex >= ownedList.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          ownedNav(+1);
                        }}
                        aria-label="Next card"
                      >
                        <span className="cardNavIcon" aria-hidden="true">›</span>
                      </button>

                      {/* Counter (1 / N) */}
                      {ownedList && ownedList.length > 0 && (
                        <div className="cardNavCounter">
                          {ownedIndex + 1} / {ownedList.length}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ padding: 16, color: "white", textAlign: "center" }}>
                      {cardPreview.title || "Card"}
                    </div>
                  )}

                  <button
                    onClick={() => setCardPreview(null)}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      borderRadius: "999px",
                      border: "none",
                      padding: "4px 8px",
                      fontSize: 14,
                      cursor: "pointer",
                      background: "rgba(0,0,0,0.6)",
                      color: "white",
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* Card edit modal */}
      {mode === "admin" && editCard && (
        <CardEditModal
          card={editCard}
          streakConfigs={activeClass?.streakConfigs || []}
          onClose={() => setEditCard(null)}
          onSave={async (updates) => {
            await updateCard(editCard.id, updates);
            setEditCard(null);
          }}
        />
      )}

      {/* Profile modal */}
      {profileStudent && (
        <ProfileModal
          mode={mode}
          student={profileStudent}
          onClose={() => setProfileStudentId(null)}
          pastelColors={PASTEL_COLORS}
          onSave={(cosmetics) =>
            saveStudentProfileCosmetics(activeClassId, profileStudent.id, cosmetics)
          }
        />
      )}

      {/* Manage student modal (admin only) */}
      {mode === "admin" && selectedStudent && (
        <ManageStudentModal
          student={selectedStudent}
          classId={activeClassId}
          students={students}
          cards={cards}
          rewards={rewards}
          streakConfigs={activeClass?.streakConfigs || []}
          changeStudentStreakValue={(classId, studentId, streakId, delta, cfg) =>
            changeStudentStreakValue({
              db,
              classId,
              studentId,
              streakId,
              delta,
              maxValueOrCfg: cfg,
              promptFn: window.prompt.bind(window),
              alertFn: window.alert.bind(window),
              getCardDataFast,
            })
          }
          resetStudentStreak={(classId, studentId, streakId) =>
            resetStudentStreak({ db, classId, studentId, streakId, alertFn: window.alert.bind(window) })
          }
          deleteStreakTypeForClass={(classId, streakId) =>
            deleteStreakTypeForClass({ db, classId, streakId, alertFn: window.alert.bind(window) })
          }
          setStickyCelebrateForClass={async (classId, streakId, stickyCelebrate) => {
            try {
              const classRef = doc(db, `classes/${classId}`);
              const snap = await getDoc(classRef);
              if (!snap.exists()) return;
              const data = snap.data();
              const list = data.streakConfigs || [];
              const updated = list.map((cfg) =>
                cfg.id === streakId ? { ...cfg, stickyCelebrate: !!stickyCelebrate } : cfg
              );
              await updateDoc(classRef, { streakConfigs: updated });
            } catch (err) {
              console.error("setStickyCelebrateForClass error", err);
              alert("Could not update sticky celebration.");
            }
          }}
          setStreakRewardCardsForClass={(classId, streakId, cfg) =>
            setStreakRewardCardsForClass({
              db,
              classId,
              classesList,
              cards,
              promptFn: window.prompt.bind(window),
              alertFn: window.alert.bind(window),
              streakId,
              cfg,
            })
          }
          mode={mode}
          onEditStudent={(updates) => editStudent(db, activeClassId, selectedStudent.id, updates)}
          onClose={() => setSelectedStudentId(null)}
          onDeleteStudent={() => deleteStudent(db, activeClassId, selectedStudent.id, setSelectedStudentId, setProfileStudentId)}
          onGiveCard={(cardId) => giveCardToStudent(activeClassId, selectedStudent.id, cardId)}
          onRemoveOne={(ownedId) => removeOwnedCardsBulk(activeClassId, selectedStudent.id, [ownedId])}
          onRemoveAll={(ownedIds) => removeOwnedCardsBulk(activeClassId, selectedStudent.id, ownedIds)}
          onRedeemIndividual={(rewardId) => {
            // Pass classId, studentId, rewardId
            redeemIndividual(activeClassId, selectedStudentId, rewardId);
          }}
          onRedeemGroup={(rewardId, sharesMap) => {
            // 1. Convert the "Map" {id: 10} into an "Array" [[id, 10]]
            const participants = Object.entries(sharesMap)
              .filter(([_, amount]) => Number(amount) > 0); // Only include those who pay
            
            // 2. Call the main function with the correct arguments
            redeemGroup(activeClassId, rewardId, participants);
          }}
          setCardPreview={setCardPreview}
        />
      )}

      {/* Bulk give modal */}
      {bulkGiveCard && (
        <div className="modal-backdrop" onClick={() => setBulkGiveCard(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Give card</h3>
            <div style={{ fontWeight: 900, marginTop: 6 }}>{bulkGiveCard.title}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Select students to receive this card. Points will be multiplied by each student's multiplier.
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn" onClick={toggleBulkGiveSelectAll}>
                {bulkGiveSelectedIds.length === students.length ? "Deselect all" : "Select all"}
              </button>
              <div className="muted">{bulkGiveSelectedIds.length} selected</div>
            </div>

            <div
              style={{
                marginTop: 12,
                maxHeight: 320,
                overflow: "auto",
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 10,
                background: "#fff",
              }}
            >
              {students.map((s) => (
                <label
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 6px",
                    borderBottom: "1px solid #f2f2f2",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={bulkGiveSelectedIds.includes(s.id)}
                    onChange={() => toggleBulkGiveStudent(s.id)}
                  />
                  <span style={{ fontWeight: 800 }}>{s.name}</span>
                  <span className="muted" style={{ marginLeft: "auto" }}>
                    x{typeof s.multiplier === "number" ? s.multiplier : 1}
                  </span>
                </label>
              ))}
              {students.length === 0 && <div className="muted">No students in this class yet.</div>}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => setBulkGiveCard(null)}>
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={bulkGiveSelectedIds.length === 0}
                onClick={async () => {
                  await giveCardToStudentsBulk(activeClassId, bulkGiveCard.id, bulkGiveSelectedIds);
                  setBulkGiveCard(null);
                }}
              >
                Give to selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




/**
 * Firestore rules note (optional but recommended if you allow guest editing):
 *
 * match /classes/{classId}/students/{studentId} {
 *   allow read: if true;
 *   // only allow updating profile cosmetics for guests
 *   allow update: if request.resource.data.diff(resource.data).changedKeys().hasOnly(['nameEmojis','profileColor']);
 * }
 *
 * With Auth later, you can lock this down properly per-student.
 */
