import React, { useCallback, useMemo, useRef, useState } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, storage, auth } from "./firebase";
import LibrarySection from "./components/cards/LibrarySection";
import CardEditModal from "./components/cards/CardEditModal";
import CardPreviewModal from "./components/cards/CardPreviewModal";
import BulkGiveModal from "./components/cards/BulkGiveModal";
import FeedbackDialog from "./components/common/FeedbackDialog";
import StreakFormModal from "./components/classes/StreakFormModal";
import RewardCardPickerModal from "./components/classes/RewardCardPickerModal";
import FloatScheduleModal from "./components/classes/FloatScheduleModal";
import ProfileModal from "./components/profile/ProfileModal";
import PinGateModal from "./components/profile/PinGateModal";
import ManageStudentModal from "./components/students/ManageStudentModal";
import BulkStreakModal from "./components/classes/BulkStreakModal";
import RequestsPanel from "./components/requests/RequestsPanel";
import LoginScreen from "./components/auth/LoginScreen";
import ClassesPanel from "./components/classes/ClassesPanel";
import StudentsPanel from "./components/students/StudentsPanel";
import { addStudent, editStudent, deleteStudent } from "./services/studentService";
import { verifyPin, changePin, resetPin } from "./services/studentAuthService";
import {
  createRequest as createRequestService,
  cancelRequest as cancelRequestService,
  rejectRequest as rejectRequestService,
  resolveRequestApproved,
} from "./services/requestService";
import {
  addStreakTypeForClass,
  changeStudentStreakValue,
  deleteStreakTypeForClass,
  resetStudentStreak,
  setStreakRewardCardsForClass,
  bulkChangeStreakValue,
  bulkResetStreak,
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
import { editClassName, endClassActivity } from "./services/classService";
import useBackgroundManager from "./hooks/useBackgroundManager";
import useClassData from "./hooks/useClassData";
import useAuthMode from "./hooks/useAuthMode";
import useActionFeedback from "./hooks/useActionFeedback";
import useStudentRequests from "./hooks/useStudentRequests";
/**
 * Pokemáticos — Firestore + Storage (main application shell)
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
  const [streakFormRequest, setStreakFormRequest] = useState(null);
  const [rewardPickerRequest, setRewardPickerRequest] = useState(null);
  const [scheduleRequest, setScheduleRequest] = useState(null);
  const [classRenameRequest, setClassRenameRequest] = useState(null);
  const [classArchiveRequest, setClassArchiveRequest] = useState(null);
  const {
    notice,
    levelUpNotice,
    confirmation,
    pendingAction,
    notify,
    notifyLevelUp,
    askConfirmation,
    resolveConfirmation,
    runAction,
  } = useActionFeedback();

  
  const [bulkGiveCard, setBulkGiveCard] = useState(null); // card object
  const [bulkGiveSelectedIds, setBulkGiveSelectedIds] = useState([]);
  // Admin manage modal selection (admin-only)
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // Profile modal selection (guest + admin)
  const [profileStudentId, setProfileStudentId] = useState(null);
  // Students whose PIN has already been verified this session
  const [unlockedProfileIds, setUnlockedProfileIds] = useState(() => new Set());
  const [showRequestsPanel, setShowRequestsPanel] = useState(false);
  const [showBulkStreaks, setShowBulkStreaks] = useState(false);

  const { pendingRequests, pendingCount } = useStudentRequests({ db });

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

  const profileNeedsPin =
    !!profileStudent && mode !== "admin" && !unlockedProfileIds.has(profileStudent.id);

  const giveableCardsForProfile = useMemo(
    () => (cards || []).filter((c) => (c.category || "points") === "points"),
    [cards]
  );

  const myPendingRequests = useMemo(
    () => pendingRequests.filter((r) => r.studentId === profileStudentId),
    [pendingRequests, profileStudentId]
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
    notify,
  });

  const [editCard, setEditCard] = useState(null);

  const runMutation = useCallback(
    async ({ action, loadingMessage, successMessage, errorMessage, confirmMessage }) => {
      return runAction({
        action,
        message: loadingMessage || "Working...",
        successMessage,
        errorMessage: errorMessage || "Something went wrong.",
        confirmMessage,
      });
    },
    [runAction]
  );

  function requestStreakForm(initial = {}) {
    return new Promise((resolve) => {
      setStreakFormRequest({
        initial,
        rewardCardIds: Array.isArray(initial.rewardCardIds) ? initial.rewardCardIds : [],
        resolve,
        title: initial.id ? "Edit streak" : "Create streak",
        toggleRewardCard: (cardId) => {
          setStreakFormRequest((current) => {
            if (!current) return current;
            const rewardCardIds = current.rewardCardIds.includes(cardId)
              ? current.rewardCardIds.filter((id) => id !== cardId)
              : [...current.rewardCardIds, cardId];
            return { ...current, rewardCardIds };
          });
        },
      });
    });
  }

  function resolveStreakForm(value) {
    streakFormRequest?.resolve(value);
    setStreakFormRequest(null);
  }

  function requestRewardCardSelection(defaultIds = []) {
    return new Promise((resolve) => {
      setRewardPickerRequest({
        selectedIds: [...defaultIds],
        resolve,
        toggleCard: (cardId) => {
          setRewardPickerRequest((current) => {
            if (!current) return current;
            const selectedIds = current.selectedIds.includes(cardId)
              ? current.selectedIds.filter((id) => id !== cardId)
              : [...current.selectedIds, cardId];
            return { ...current, selectedIds };
          });
        },
      });
    });
  }

  function resolveRewardCardSelection(value) {
    rewardPickerRequest?.resolve(value);
    setRewardPickerRequest(null);
  }

  function requestFloatSchedule(initial) {
    return new Promise((resolve) => {
      setScheduleRequest({ ...initial, resolve });
    });
  }

  function resolveFloatSchedule(value) {
    scheduleRequest?.resolve(value);
    setScheduleRequest(null);
  }

  function requestClassRename(currentName = "") {
    return new Promise((resolve) => {
      setClassRenameRequest({ currentName, resolve });
    });
  }

  function resolveClassRename(value) {
    classRenameRequest?.resolve(value);
    setClassRenameRequest(null);
  }

  function requestClassArchiveUrl(className = "") {
    return new Promise((resolve) => {
      setClassArchiveRequest({ className, resolve });
    });
  }

  function resolveClassArchiveUrl(value) {
    classArchiveRequest?.resolve(value);
    setClassArchiveRequest(null);
  }

  // ----- Guards -----
  function ensureClassSelected() {
    if (!activeClassId) {
      notify("Please select or create a class first.");
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
      alertFn: notify,
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
    return runMutation({
      loadingMessage: "Adding points...",
      successMessage: "Points added.",
      errorMessage: "Could not add points.",
      action: async () => {
        await quickAddPointsService({
          db,
          classId,
          studentId,
          amount,
          alertFn: notify,
        });
      },
    });
  }

  // Profile cosmetics (guest allowed if rules permit)
  async function saveStudentProfileCosmetics(
    classId,
    studentId,
    { nameEmojis, profileColor }
  ) {
    return runMutation({
      loadingMessage: "Saving profile...",
      successMessage: "Profile saved.",
      errorMessage: "Could not save profile. (Check Firestore rules)",
      action: async () => {
        const safeEmojis = (nameEmojis || "").toString().slice(0, 2);
        const safeColor = (profileColor || "").toString();
        await updateDoc(doc(db, `classes/${classId}/students/${studentId}`), {
          nameEmojis: safeEmojis,
          profileColor: safeColor,
        });
      },
    });
  }

  // ----- Student requests (card / points, pending professor approval) -----
  async function createStudentRequest(classId, student, payload) {
    return runMutation({
      loadingMessage: "Enviando petición...",
      successMessage: "Petición enviada.",
      errorMessage: "No se pudo enviar la petición.",
      action: async () => {
        return createRequestService(
          db,
          classId,
          {
            studentId: student.id,
            studentName: student.name,
            className: activeClass?.name || "",
            ...payload,
          },
          notify
        );
      },
    });
  }

  async function cancelStudentRequest(request) {
    return runMutation({
      loadingMessage: "Cancelando...",
      successMessage: "Petición cancelada.",
      errorMessage: "No se pudo cancelar la petición.",
      action: async () => cancelRequestService(db, request.classId, request.id, notify),
    });
  }

  async function approveStudentRequest(request) {
    return runMutation({
      loadingMessage: "Aprobando petición...",
      successMessage: "Petición aprobada.",
      errorMessage: "No se pudo aprobar la petición.",
      action: async () => {
        if (request.type === "points") {
          await quickAddPointsService({
            db,
            classId: request.classId,
            studentId: request.studentId,
            amount: request.amount,
            alertFn: notify,
          });
        } else if (request.type === "card") {
          const classSnap = await getDoc(doc(db, `classes/${request.classId}`));
          const requestClass = classSnap.exists() ? { id: request.classId, ...classSnap.data() } : null;
          await giveCardToStudentService({
            db,
            classId: request.classId,
            studentId: request.studentId,
            cardId: request.cardId,
            activeClass: requestClass,
            getCardDataFast,
            alertFn: notify,
            scheduleFn: requestFloatSchedule,
          });
        }
        await resolveRequestApproved(db, request.classId, request.id, notify);
      },
    });
  }

  async function rejectStudentRequest(request) {
    return runMutation({
      loadingMessage: "Rechazando...",
      successMessage: "Petición rechazada.",
      errorMessage: "No se pudo rechazar la petición.",
      action: async () => rejectRequestService(db, request.classId, request.id, notify),
    });
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

    return runMutation({
      loadingMessage: "Saving card...",
      successMessage: "Card saved.",
      errorMessage: "Could not save card.",
      action: async () => {
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
          alertFn: notify,
        });
      },
    });
  }

  async function deleteCard(cardId) {
    return runMutation({
      loadingMessage: "Deleting card...",
      successMessage: "Card deleted.",
      errorMessage: "Could not delete card.",
      confirmMessage: "Delete this card?",
      action: async () => {
        await deleteCardService({
          db,
          classId: activeClassId,
          cardId,
          alertFn: notify,
          confirmFn: askConfirmation,
        });
      },
    });
  }

  // Give card (silent success, no alert). Hard rule: don't give rewards-category cards here.
  async function giveCardToStudent(classId, studentId, cardId) {
    try {
      await giveCardToStudentService({
        db,
        classId,
        studentId,
        cardId,
        activeClass,
        getCardDataFast,
        alertFn: notify,
        scheduleFn: requestFloatSchedule,
      });
    } catch (err) {
      // already reported to the user via alertFn inside the service
    }
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
      alertFn: notify,
      scheduleFn: requestFloatSchedule,
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
      alertFn: notify,
    });
  }

  // ----- Rewards -----
  async function createReward({ title, cost, linkedCardId }) {
    if (!ensureClassSelected()) return;
    return runMutation({
      loadingMessage: "Saving reward...",
      successMessage: "Reward saved.",
      errorMessage: "Could not save reward.",
      action: async () => {
        await createRewardService({
          db,
          classId: activeClassId,
          title,
          cost,
          linkedCardId,
          alertFn: notify,
        });
      },
    });
  }

  async function deleteReward(rewardId) {
    return runMutation({
      loadingMessage: "Deleting reward...",
      successMessage: "Reward deleted.",
      errorMessage: "Could not delete reward.",
      confirmMessage: "Delete this reward?",
      action: async () => {
        await deleteRewardService({
          db,
          classId: activeClassId,
          rewardId,
          alertFn: notify,
          confirmFn: askConfirmation,
        });
      },
    });
  }

  async function redeemIndividual(classId, studentId, rewardId) {
    return runMutation({
      loadingMessage: "Redeeming reward...",
      successMessage: "Reward redeemed.",
      errorMessage: "Could not redeem reward.",
      action: async () => {
        await redeemIndividualService({
          db,
          classId,
          studentId,
          rewardId,
          rewards,
          students,
          cards,
          alertFn: (data) => {
            if (typeof data === "object" && data !== null && data.cards) {
              notifyLevelUp(data);
            } else {
              notify(data);
            }
          },
          confirmFn: askConfirmation,
        });
      },
    });
  }

  async function redeemGroup(classId, rewardId, participants) {
    return runMutation({
      loadingMessage: "Redeeming group reward...",
      successMessage: "Group reward redeemed.",
      errorMessage: "Could not redeem group reward.",
      confirmMessage: "Redeem this reward for the selected group?",
      action: async () => {
        await redeemGroupService({
          db,
          classId,
          rewardId,
          participants,
          rewards,
          students,
          cards,
          alertFn: notify,
          confirmFn: askConfirmation,
        });
      },
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
          {mode === "admin" && (
            <button className="btn" onClick={() => setShowRequestsPanel(true)}>
              Peticiones{pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          )}
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
          confirmFn={askConfirmation}
          alertFn={notify}
          onRenameClass={async (classId, currentName) => {
            const nextName = await requestClassRename(currentName);
            if (typeof nextName === "string" && nextName.trim()) {
              await editClassName(db, classId, nextName.trim(), notify);
            }
          }}
          onEndActivity={async (classId, className) => {
            const archiveUrl = await requestClassArchiveUrl(className);
            if (typeof archiveUrl === "string" && archiveUrl.trim()) {
              await endClassActivity(db, classId, archiveUrl, notify);
            }
          }}
        />

        {/* Only show these if a class is selected */}
        {activeClassId && activeClass?.archivedUrl ? (
          <section className="ended-class-panel" aria-labelledby="ended-class-title">
            <div className="ended-class-icon" aria-hidden="true">✦</div>
            <p className="ended-class-eyebrow">Class archive</p>
            <h2 id="ended-class-title">This class has ended</h2>
            <p>The activity is over, but the memories are still here.</p>
            <a className="btn primary ended-class-link" href={activeClass.archivedUrl} target="_blank" rel="noreferrer">
              Open class archive
            </a>
          </section>
        ) : activeClassId && (
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
              onAddStreak={() => setShowBulkStreaks(true)}
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
                  scheduleFn: requestFloatSchedule,
                  alertFn: notify,
                  getCardDataFast,
                })
              }
              onQuickAddPoints={quickAddPoints}
              onPreviewCard={setCardPreview}
              onAddStudent={() => {
                const name = newStudentRef.current?.value?.trim();
                if (!name) return notify("Enter name");
                addStudent(db, activeClassId, name, ensureClassSelected, newStudentRef, notify);
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
              onValidationError={notify}
            />
          </>
        )}
      </div>

      <CardPreviewModal
        cardPreview={cardPreview}
        onClose={() => setCardPreview(null)}
        onNavigate={ownedNav}
      />

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

      {/* PIN gate before opening a student's profile (guests only) */}
      {profileStudent && profileNeedsPin && (
        <PinGateModal
          student={profileStudent}
          onClose={() => setProfileStudentId(null)}
          onSubmit={(pin) => {
            if (verifyPin(profileStudent, pin)) {
              setUnlockedProfileIds((prev) => new Set(prev).add(profileStudent.id));
            } else {
              notify("PIN incorrecto.");
            }
          }}
        />
      )}

      {/* Bulk streak management (admin only, active class) */}
      {mode === "admin" && showBulkStreaks && activeClassId && (
        <BulkStreakModal
          className={activeClass?.name || ""}
          students={students}
          streakConfigs={activeClass?.streakConfigs || []}
          onClose={() => setShowBulkStreaks(false)}
          onBulkChange={(cfg, delta, selectedIds) =>
            runAction({
              action: () =>
                bulkChangeStreakValue({
                  db,
                  classId: activeClassId,
                  studentIds: selectedIds,
                  streakId: cfg.id,
                  delta,
                  cfg,
                  scheduleFn: requestFloatSchedule,
                  alertFn: notify,
                  getCardDataFast,
                }),
              message: "Updating streaks...",
              confirmMessage: `${delta > 0 ? "Add +1" : "Subtract -1"} to the ${cfg.emoji || ""} streak for ${selectedIds.length} student(s)?`,
              errorMessage: "Could not update streaks.",
            })
          }
          onBulkReset={(cfg, selectedIds) =>
            runAction({
              action: () =>
                bulkResetStreak({
                  db,
                  classId: activeClassId,
                  studentIds: selectedIds,
                  streakId: cfg.id,
                  alertFn: notify,
                }),
              message: "Resetting streaks...",
              confirmMessage: `Reset the ${cfg.emoji || ""} streak to 0 for ${selectedIds.length} student(s)? This cannot be undone.`,
              errorMessage: "Could not reset streaks.",
            })
          }
          onCreateStreakType={() =>
            addStreakTypeForClass({
              db,
              classId: activeClassId,
              classesList,
              cards,
              formFn: requestStreakForm,
              alertFn: notify,
            })
          }
        />
      )}

      {/* Requests panel (admin only, global across classes) */}
      {mode === "admin" && showRequestsPanel && (
        <RequestsPanel
          pendingRequests={pendingRequests}
          onApprove={approveStudentRequest}
          onReject={rejectStudentRequest}
          onClose={() => setShowRequestsPanel(false)}
        />
      )}

      {/* Profile modal */}
      {profileStudent && !profileNeedsPin && (
        <ProfileModal
          mode={mode}
          student={profileStudent}
          onClose={() => setProfileStudentId(null)}
          pastelColors={PASTEL_COLORS}
          onSave={(cosmetics) =>
            saveStudentProfileCosmetics(activeClassId, profileStudent.id, cosmetics)
          }
          onChangePin={(currentPin, newPin) =>
            changePin(db, activeClassId, profileStudent.id, profileStudent, currentPin, newPin, notify)
          }
          onValidationError={notify}
          giveableCards={giveableCardsForProfile}
          allCards={cards}
          rewards={rewards}
          onRedeemReward={(rewardId) =>
            redeemIndividual(activeClassId, profileStudent.id, rewardId)
          }
          myPendingRequests={myPendingRequests}
          onCreateRequest={(payload) => createStudentRequest(activeClassId, profileStudent, payload)}
          onCancelRequest={(request) => cancelStudentRequest(request)}
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
              scheduleFn: requestFloatSchedule,
              alertFn: notify,
              getCardDataFast,
            })
          }
          resetStudentStreak={(classId, studentId, streakId) =>
            resetStudentStreak({ db, classId, studentId, streakId, alertFn: notify })
          }
          deleteStreakTypeForClass={(classId, streakId) =>
            deleteStreakTypeForClass({ db, classId, streakId, alertFn: notify, confirmFn: askConfirmation })
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
              notify("Could not update sticky celebration.");
            }
          }}
          setStreakRewardCardsForClass={(classId, streakId, cfg) =>
            setStreakRewardCardsForClass({
              db,
              classId,
              classesList,
              cards,
              rewardCardPickerFn: requestRewardCardSelection,
              alertFn: notify,
              streakId,
              cfg,
            })
          }
          mode={mode}
          onEditStudent={(updates) => editStudent(db, activeClassId, selectedStudent.id, updates, notify)}
          onClose={() => setSelectedStudentId(null)}
          onDeleteStudent={() => deleteStudent(db, activeClassId, selectedStudent.id, setSelectedStudentId, setProfileStudentId, askConfirmation, notify)}
          onResetPin={async () => {
            if (!(await askConfirmation(`Reset PIN for ${selectedStudent.name} to 0000?`))) return;
            const ok = await resetPin(db, activeClassId, selectedStudent.id, notify);
            if (ok) notify("PIN reset to 0000.");
          }}
          onGiveCard={(cardId) => giveCardToStudent(activeClassId, selectedStudent.id, cardId)}
          onRemoveOne={(ownedId) => removeOwnedCardsBulk(activeClassId, selectedStudent.id, [ownedId])}
          onRemoveAll={(ownedIds) => removeOwnedCardsBulk(activeClassId, selectedStudent.id, ownedIds)}
          confirmFn={askConfirmation}
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

      <BulkGiveModal
        card={bulkGiveCard}
        students={students}
        selectedStudentIds={bulkGiveSelectedIds}
        onClose={() => setBulkGiveCard(null)}
        onToggleStudent={toggleBulkGiveStudent}
        onToggleSelectAll={toggleBulkGiveSelectAll}
        onGive={async () => {
          await giveCardToStudentsBulk(activeClassId, bulkGiveCard.id, bulkGiveSelectedIds);
          setBulkGiveCard(null);
        }}
      />

      <FeedbackDialog
        notice={notice}
        levelUpNotice={levelUpNotice}
        confirmation={confirmation}
        pendingAction={pendingAction}
        onDismissNotice={() => notify(null)}
        onDismissLevelUp={() => notifyLevelUp(null)}
        onResolveConfirmation={resolveConfirmation}
      />

      <StreakFormModal
        request={streakFormRequest}
        cards={cards}
        onClose={() => resolveStreakForm(null)}
        onSave={resolveStreakForm}
      />

      <RewardCardPickerModal
        request={rewardPickerRequest}
        cards={cards}
        onClose={() => resolveRewardCardSelection(undefined)}
        onSave={resolveRewardCardSelection}
      />

      <FloatScheduleModal
        request={scheduleRequest}
        onClose={() => resolveFloatSchedule(null)}
        onSave={resolveFloatSchedule}
      />

      {classRenameRequest && (
        <div className="modal-backdrop" role="presentation">
          <div className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-class-title">
            <h3 id="rename-class-title" style={{ marginTop: 0 }}>Rename class</h3>
            <input
              className="input"
              defaultValue={classRenameRequest.currentName}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const nextValue = e.currentTarget.value;
                  resolveClassRename(nextValue);
                }
              }}
            />
            <div className="feedback-dialog-actions" style={{ marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => resolveClassRename(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={(e) => {
                  const input = e.currentTarget.parentElement?.previousElementSibling;
                  resolveClassRename(input?.value ?? "");
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {classArchiveRequest && (
        <div className="modal-backdrop" role="presentation">
          <div className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="archive-class-title">
            <h3 id="archive-class-title" style={{ marginTop: 0 }}>End class activity</h3>
            <p className="muted">Enter the complete archive URL, including <strong>https://</strong>. Leaving it empty cancels the action.</p>
            <input
              className="input"
              type="url"
              placeholder="https://example.com/archive"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") resolveClassArchiveUrl(e.currentTarget.value);
              }}
            />
            <div className="feedback-dialog-actions" style={{ marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => resolveClassArchiveUrl(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={(e) => {
                  const input = e.currentTarget.parentElement?.previousElementSibling;
                  resolveClassArchiveUrl(input?.value ?? "");
                }}
              >
                End activity
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
