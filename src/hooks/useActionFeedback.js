import { useCallback, useMemo, useState } from "react";

export default function useActionFeedback() {
  const [notice, setNotice] = useState(null);
  const [levelUpNotice, setLevelUpNotice] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  const notify = useCallback((message) => {
    if (!message) {
      setNotice(null);
      return;
    }
    setNotice({ message });
  }, []);

  const notifyLevelUp = useCallback((data) => {
    if (!data) {
      setLevelUpNotice(null);
      return;
    }
    setLevelUpNotice(typeof data === "string" ? { message: data } : data);
  }, []);

  const askConfirmation = useCallback((message) => {
    return new Promise((resolve) => {
      setConfirmation({ message, resolve });
    });
  }, []);

  const resolveConfirmation = useCallback(
    (value) => {
      if (confirmation?.resolve) {
        confirmation.resolve(value);
      }
      setConfirmation(null);
    },
    [confirmation]
  );

  const runAction = useCallback(
    async ({
      action,
      message = "Working...",
      successMessage,
      errorMessage = "Something went wrong.",
      confirmMessage,
    }) => {
      if (confirmMessage) {
        const confirmed = await askConfirmation(confirmMessage);
        if (!confirmed) return false;
      }

      setPendingAction(message);

      try {
        const result = await action();
        if (successMessage) {
          notify(successMessage);
        }
        return result;
      } catch (error) {
        console.error("runAction error", error);
        notify(errorMessage);
        return false;
      } finally {
        setPendingAction(null);
      }
    },
    [askConfirmation, notify]
  );

  return useMemo(
    () => ({
      notice,
      setNotice,
      levelUpNotice,
      setLevelUpNotice,
      confirmation,
      pendingAction,
      notify,
      notifyLevelUp,
      askConfirmation,
      resolveConfirmation,
      runAction,
    }),
    [
      askConfirmation,
      confirmation,
      notify,
      notifyLevelUp,
      levelUpNotice,
      pendingAction,
      resolveConfirmation,
      runAction,
      notice,
    ]
  );
}
