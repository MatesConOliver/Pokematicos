import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

export default function useBackgroundManager({
  db,
  storage,
  activeClassId,
  activeClass,
  backgroundFlagValue = "A",
  notify,
}) {
  const [globalBackgroundUrl, setGlobalBackgroundUrl] = useState("");
  const [stickyBackground, setStickyBackground] = useState("");
  const bgInputRef = useRef(null);
  const hasLoadedInitialGlobal = useRef(false);

  useEffect(() => {
    const bgDocRef = doc(db, "config", "background");
    const unsub = onSnapshot(bgDocRef, (snap) => {
      if (snap.exists()) {
        setGlobalBackgroundUrl(snap.data().url || "");
      } else {
        setGlobalBackgroundUrl("");
      }
    });
    return () => unsub();
  }, [db]);

  useEffect(() => {
    if (!hasLoadedInitialGlobal.current && globalBackgroundUrl) {
      setStickyBackground(globalBackgroundUrl);
      hasLoadedInitialGlobal.current = true;
    }
  }, [globalBackgroundUrl]);

  useEffect(() => {
    if (!activeClassId) {
      setStickyBackground(globalBackgroundUrl || "");
      return;
    }

    const nextBg =
      (backgroundFlagValue === "B" && activeClass?.backgroundUrl_B) ||
      activeClass?.backgroundUrl ||
      globalBackgroundUrl ||
      "";
    setStickyBackground(nextBg);
  }, [activeClassId, activeClass, backgroundFlagValue, globalBackgroundUrl]);

  async function uploadBackgroundImage(file, variant = "A") {
    if (!file) return;

    try {
      const safeName = file.name.replace(/\s+/g, "_");
      const timestamp = Date.now();

      let storagePath;
      let firestoreRef;

      if (activeClassId) {
        storagePath = `classes/${activeClassId}/backgrounds/bg_${timestamp}_${safeName}`;
        firestoreRef = doc(db, "classes", activeClassId);
      } else {
        storagePath = `backgrounds/bg_${timestamp}_${safeName}`;
        firestoreRef = doc(db, "config", "background");
      }

      const ref = storageRef(storage, storagePath);
      const snapshot = await uploadBytes(ref, file);
      const url = await getDownloadURL(snapshot.ref);

      if (activeClassId) {
        const field = variant === "B" ? "backgroundUrl_B" : "backgroundUrl";
        await updateDoc(firestoreRef, { [field]: url });
        notify(`Option ${variant} background updated for ${activeClass?.name || "selected class"}!`);
      } else {
        await setDoc(firestoreRef, { url });
        notify("Global default background updated!");
      }
    } catch (err) {
      console.error("uploadBackgroundImage error:", err);
      notify("Failed to upload background image.");
    }
  }

  async function clearBackgroundImage(variant = "A") {
    try {
      if (activeClassId) {
        const field = variant === "B" ? "backgroundUrl_B" : "backgroundUrl";
        await updateDoc(doc(db, "classes", activeClassId), {
          [field]: "",
        });
        notify(
          variant === "B"
            ? `Removed Option B background for ${activeClass?.name || "selected class"}.`
            : `Removed Option A background for ${activeClass?.name || "selected class"}. Now using default.`
        );
      } else {
        await setDoc(doc(db, "config", "background"), { url: "" });
        notify("Global background removed!");
      }
    } catch (err) {
      console.error("clearBackgroundImage error:", err);
      notify("Failed to remove background.");
    }
  }

  return {
    stickyBackground,
    globalBackgroundUrl,
    bgInputRef,
    uploadBackgroundImage,
    clearBackgroundImage,
  };
}