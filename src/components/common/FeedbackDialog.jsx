import { useEffect } from "react";

export default function FeedbackDialog({ notice, confirmation, onDismissNotice, onResolveConfirmation }) {
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(onDismissNotice, 4200);
    return () => window.clearTimeout(timer);
  }, [notice, onDismissNotice]);

  return (
    <>
      {notice && (
        <div className="feedback-notice" role="status">
          <span>{notice.message}</span>
          <button type="button" className="feedback-dismiss" onClick={onDismissNotice} aria-label="Close notification">
            x
          </button>
        </div>
      )}

      {confirmation && (
        <div className="modal-backdrop" role="presentation">
          <div className="feedback-dialog" role="alertdialog" aria-modal="true" aria-labelledby="feedback-dialog-title">
            <div className="feedback-dialog-icon" aria-hidden="true">!</div>
            <h3 id="feedback-dialog-title">Please confirm</h3>
            <p>{confirmation.message}</p>
            <div className="feedback-dialog-actions">
              <button type="button" className="btn" onClick={() => onResolveConfirmation(false)}>
                Cancel
              </button>
              <button type="button" className="btn danger" onClick={() => onResolveConfirmation(true)}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
