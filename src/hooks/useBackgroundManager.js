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
    if (activeClassId) {
      const nextBg = activeClass?.backgroundUrl || "";
      setStickyBackground(nextBg);
    }
  }, [activeClassId, activeClass]);

  async function uploadBackgroundImage(file) {
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
        await updateDoc(firestoreRef, { backgroundUrl: url });
        alert(`Background updated for ${activeClass.name}!`);
      } else {
        await setDoc(firestoreRef, { url });
        alert("Global default background updated!");
      }
    } catch (err) {
      console.error("uploadBackgroundImage error:", err);
      alert("Failed to upload background image.");
    }
  }

  async function clearBackgroundImage() {
    try {
      if (activeClassId) {
        await updateDoc(doc(db, "classes", activeClassId), {
          backgroundUrl: "",
        });
        alert(`Removed background for ${activeClass.name}. Now using default.`);
      } else {
        await setDoc(doc(db, "config", "background"), { url: "" });
        alert("Global background removed!");
      }
    } catch (err) {
      console.error("clearBackgroundImage error:", err);
      alert("Failed to remove background.");
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