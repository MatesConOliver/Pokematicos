# Integration Guide: PKM Reward Code System

Complete step-by-step instructions for integrating the reward code components into Pokemáticos.

---

## Overview

You're adding four components to your existing Pokemáticos application:

1. **RewardCodeService** (backend) - Handles code validation, activity lookup, and achievement recording
2. **PublicStudentIdDisplay** (UI) - Shows student's Public ID in profile settings
3. **RewardCodeRedemption** (UI) - Allows students to paste codes and redeem rewards
4. **ActivityCatalogueManager** (UI) - Admin panel for managing activity catalogue

---

## Step 1: Import Backend Service

### File: `src/services/rewardCodeService.js`

This file already exists and is complete. Verify it's in place:

```bash
ls -la src/services/rewardCodeService.js
```

**What it provides:**
- `redeemRewardCode()` - Main redemption function
- `addActivityToCatalogue()` - Add activities (admin)
- `updateActivityInCatalogue()` - Edit activities (admin)
- `getActivityFromCatalogue()` - Lookup activity details
- `deleteActivityFromCatalogue()` - Remove activities (admin)

---

## Step 2: Add Student UI - PublicStudentIdDisplay

### Location: Profile Modal → Settings Tab

**File location:** `src/components/profile/PublicStudentIdDisplay.jsx` (already created)

**1. Import in ProfileModal.jsx:**

```javascript
// At top of src/components/profile/ProfileModal.jsx
import PublicStudentIdDisplay from "./PublicStudentIdDisplay";
```

**2. Add to Settings Tab:**

Find the settings tab section (around line 833) and add the component before the Personalization section:

```javascript
{activeTab === "settings" && (
  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
    {/* Add this block FIRST */}
    <PublicStudentIdDisplay student={student} alertFn={onValidationError} />

    {/* Existing Personalization section */}
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#ffffff" }}>
      <div style={{ ... }}>Personalization</div>
      {/* ... rest of personalization ... */}
    </div>
    
    {/* ... rest of settings ... */}
  </div>
)}
```

**3. Pass required props:**

Make sure ProfileModal receives `onValidationError` (it already should):

```javascript
export default function ProfileModal({
  mode,
  student,
  onClose,
  onSave,
  onChangePin,
  onValidationError,  // ← Already present
  // ... rest of props
})
```

---

## Step 3: Add Student UI - RewardCodeRedemption

### Location: Profile Modal → New "Redeem" Tab (or existing "Rewards" Tab)

**File location:** `src/components/profile/RewardCodeRedemption.jsx` (already created)

### Option A: Create New "Redeem" Tab (Recommended)

**1. Import in ProfileModal.jsx:**

```javascript
import RewardCodeRedemption from "./RewardCodeRedemption";
```

**2. Add new tab button (around line 191, after "history" tab):**

```javascript
<button
  type="button"
  className="btn"
  onClick={() => setActiveTab("redeem")}
  style={{
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottom: activeTab === "redeem" ? "3px solid #2563eb" : "3px solid transparent",
    background: activeTab === "redeem" ? "#eff6ff" : "transparent",
    color: activeTab === "redeem" ? "#1d4ed8" : "#4b5563",
    fontWeight: activeTab === "redeem" ? 700 : 500,
    padding: "8px 14px",
    fontSize: 13,
  }}
>
  🎁 Redeem
</button>
```

**3. Update initial activeTab state (line 19):**

```javascript
const [activeTab, setActiveTab] = useState("requests"); 
// Keep as "requests" for default
// Tabs now: "requests" | "rewards" | "history" | "settings" | "redeem"
```

**4. Add tab content (end of content section, before closing div):**

```javascript
{activeTab === "redeem" && (
  <div style={{ padding: "20px", flex: 1, overflowY: "auto" }}>
    <RewardCodeRedemption
      student={student}
      onRedeemSuccess={() => {
        // Refresh student data by closing/reopening modal
        // Or call parent's onSave to refresh
        onValidationError("Achievement redeemed! Refreshing...");
      }}
      alertFn={onValidationError}
    />
  </div>
)}
```

### Option B: Add to Existing "Rewards" Tab

If you prefer to keep it together with existing rewards, find the `{activeTab === "rewards"` section and add the component there.

---

## Step 4: Add Admin UI - ActivityCatalogueManager

### Location: ClassesPanel → Admin Section

**File location:** `src/components/admin/ActivityCatalogueManager.jsx` (already created)

**1. Import in ClassesPanel.jsx:**

```javascript
import ActivityCatalogueManager from "../admin/ActivityCatalogueManager";
```

**2. Add state for showing/hiding the catalogue manager:**

```javascript
const [showActivityCatalogue, setShowActivityCatalogue] = useState(false);
```

**3. Add button in admin section (around line 64):**

Find the `{mode === "admin" && (` section and add:

```javascript
{mode === "admin" && (
  <div style={{ marginTop: 16 }}>
    <button
      className="btn primary"
      onClick={() => setShowActivityCatalogue(!showActivityCatalogue)}
      style={{ marginBottom: 16 }}
    >
      {showActivityCatalogue ? "Hide" : "Show"} Activity Catalogue
    </button>
    
    {showActivityCatalogue && (
      <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <ActivityCatalogueManager 
          classId={activeClassId}
          alertFn={alertFn}
        />
      </div>
    )}
  </div>
)}
```

---

## Step 5: Update Firestore Security Rules

Add these rules to your Firestore security rules. Replace `YOUR_ADMIN_CHECK` with your existing admin check logic:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ... existing rules ...

    // Activity Catalogue (per class)
    match /classes/{classId}/activityCatalogue/{activity} {
      // Admins can read/write
      allow read, write: if YOUR_ADMIN_CHECK(resource.auth.uid, classId);
    }

    // Student Achievements (per student, per class)
    match /classes/{classId}/students/{studentId}/achievements/{achievement} {
      // Students can read their own achievements
      allow read: if request.auth.uid == studentId;
      // Backend can write (via Cloud Function or trusted client)
      allow write: if YOUR_ADMIN_CHECK(request.auth.uid, classId);
    }
  }
}
```

---

## Step 6: Test End-to-End

### Manual Testing Checklist

**1. Student ID Display:**
- [ ] Go to student profile → Settings tab
- [ ] See "Public ID" section with Firestore UID displayed
- [ ] Copy button works (copies ID to clipboard)

**2. Admin Activity Catalogue:**
- [ ] Log in as admin
- [ ] Go to Classes panel
- [ ] Click "Show Activity Catalogue" button
- [ ] See form to add new activities
- [ ] Fill: Source ID, Activity ID, Description, Points
- [ ] Click "Add Activity"
- [ ] Activity appears in the catalogue grid
- [ ] Can edit and delete activities

**3. Code Generation (External App):**
- [ ] Use the code generation guide to create a test code
- [ ] Example:
  ```
  Student ID: "user-abc123xyz456def789"
  Source ID: "test_app"
  Activity ID: "test001"
  Generated code: "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
  ```

**4. Code Redemption:**
- [ ] Student goes to Profile → Redeem tab
- [ ] Paste test code
- [ ] Code validates
- [ ] Achievement recorded ✓
- [ ] Points awarded ✓
- [ ] Success message shown

**5. Duplicate Prevention:**
- [ ] Try redeeming the same code again
- [ ] Should show: "You have already completed this activity"

**6. Invalid Codes:**
- [ ] Try a malformed code
- [ ] Try a code for wrong student
- [ ] Try a code for non-existent activity
- [ ] Try a code for inactive activity
- [ ] Each shows appropriate error message

---

## Step 7: Database Schema Reference

The system uses these Firestore collections (auto-created):

### Activity Catalogue
```
classes/{classId}/activityCatalogue/{sourceId}_{activityId}
{
  sourceId: string,
  activityId: string,
  description: string,
  pointsAward: number,
  rewardType: "points" | "card" | "both",
  isActive: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Student Achievements
```
classes/{classId}/students/{studentId}/achievements/{sourceId}_{activityId}
{
  sourceId: string,
  activityId: string,
  pointsAwarded: number,
  redeemedAt: timestamp,
  rewardType: string
}
```

---

## Step 8: Troubleshooting

### Issue: Build fails with missing component

**Solution:** Ensure all files exist:
```bash
ls -la src/services/rewardCodeService.js
ls -la src/components/profile/PublicStudentIdDisplay.jsx
ls -la src/components/profile/RewardCodeRedemption.jsx
ls -la src/components/admin/ActivityCatalogueManager.jsx
```

### Issue: Code validation fails with "Code is invalid"

**Solutions:**
1. Check code format: Must be 28 base36 chars, e.g., `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`
2. Check CRC-8 calculation: Use the test vectors in the specification
3. Ensure student ID matches: Code must be generated with correct student Public ID

### Issue: Activity not found in catalogue

**Solutions:**
1. Verify activity was added via ActivityCatalogueManager
2. Check exact spelling of sourceId and activityId (case-insensitive, but spelling must match)
3. Ensure activity is Active (toggle in catalogue)
4. Verify you're in the correct class

### Issue: Firestore quota exceeded

**Solutions:**
1. This system is optimized for ~100 students × 1000 activities = ~100K documents
2. Each redemption = 3 reads + 1 batch write (4 Firestore operations)
3. Normal usage: ~0.1€ per 1000 redemptions (well within budget)

---

## Deployment Checklist

Before going live:

- [ ] All components imported and placed in UI
- [ ] Firestore security rules updated
- [ ] Manual end-to-end test passed
- [ ] Create test activity in catalogue
- [ ] Generate test code from external app
- [ ] Student can redeem test code
- [ ] Achievement recorded and points awarded
- [ ] Duplicate redemption prevented
- [ ] External app guide shared with developers
- [ ] Documentation up to date

---

## Files Modified

```
src/components/profile/ProfileModal.jsx
  - Added imports for PublicStudentIdDisplay, RewardCodeRedemption
  - Added "redeem" tab
  - Added PublicStudentIdDisplay to settings tab
  - Added RewardCodeRedemption to redeem tab

src/components/classes/ClassesPanel.jsx
  - Added import for ActivityCatalogueManager
  - Added state for showing/hiding catalogue
  - Added button and conditional render for ActivityCatalogueManager

firestore.rules (Firestore Security Rules)
  - Added rules for activityCatalogue collection
  - Added rules for student achievements collection
```

## Files Created (Already Complete)

```
src/services/rewardCodeService.js
src/components/profile/PublicStudentIdDisplay.jsx
src/components/profile/RewardCodeRedemption.jsx
src/components/admin/ActivityCatalogueManager.jsx
```

---

## Next Steps

1. Follow steps 1-7 above to integrate components
2. Test using the checklist in Step 6
3. Share the **External App Integration Guide** with developers building external applications
4. Deploy to production
5. Monitor Firestore usage in first month

---

**Questions?** Refer to:
- `/home/codespace/.copilot/session-state/.../files/EXTERNAL-APP-INTEGRATION-GUIDE.md` - For external app developers
- `/home/codespace/.copilot/session-state/.../files/pkm-reward-code-spec-revised.md` - Technical specification
- `/home/codespace/.copilot/session-state/.../files/PHASE-2-COMPLETION-SUMMARY.md` - Feature overview
