# Card Reward System Fix

## The Problem

When creating activities with reward type "card" in the Activity Catalogue Manager, you could select "Card" as the reward type, but **were never prompted to choose which card to give**. This resulted in activities being saved without a `cardId`, causing:

1. **Invalid or incomplete code error** when trying to redeem the code
2. **No card actually being given** to the student even if redemption somehow succeeded

## Root Causes

There were two interconnected bugs:

### Bug 1: Missing Card Selection UI (ActivityCatalogueManager.jsx)
- The form had a `rewardType` dropdown with "card" option
- **But there was no field to select which card to give**
- No `cardId` was ever being captured or stored

### Bug 2: Missing Card Reward Logic (rewardCodeService.js)
- When an activity was created, the `cardId` wasn't being stored in the activity record
- When redeeming code, the system didn't have code to actually give the card to the student
- The `recordAndAwardAchievement()` function only awarded points, not cards

## The Fixes

### Fix 1: Add Card Selection to Activity Form

**File:** `src/components/admin/ActivityCatalogueManager.jsx`

Changes:
1. Added `cards` state to store available cards in the class
2. Added `loadCards()` function that fetches all cards from Firestore
3. Added `cardId: ""` to the initial form data
4. Added conditional card selector field that appears when reward type is "card" or "both"
5. Added validation that requires a card to be selected when reward type is card
6. Shows helpful error message if no cards exist in the class

### Fix 2: Store cardId in Activity Catalogue

**File:** `src/services/rewardCodeService.js` - `addActivityToCatalogue()` function

Changes:
1. Extract `cardId` from activity object
2. Validate that `cardId` is required when `rewardType` is "card"
3. Store `cardId` in the activity document when reward type is card

### Fix 3: Actually Give the Card on Redemption

**File:** `src/services/rewardCodeService.js` - `recordAndAwardAchievement()` function

Changes:
1. Check if `activity.rewardType === "card"` and `activity.cardId` exists
2. Verify the card exists in the database before giving it
3. Create a card entry in `classes/{classId}/students/{studentId}/cards/{cardId}`
4. Copy card data and add metadata (`obtainedAt`, `obtainedFrom`)
5. Update the achievement record to include the card info
6. Update rewards history to show card rewards with card ID

## How to Use

### For Teachers/Admins (Setting Up Activities)

1. Go to **Classes** → **Activity Catalogue**
2. Click **+ Add Activity**
3. Fill in:
   - Source ID (e.g., "DP4DP")
   - Activity ID (e.g., "plus")
   - Name and description
   - Points (if applicable)
   - **Reward Type:** Choose "Card" if you want to give a card
4. **New:** A "Select Card" dropdown will appear - choose the card you want to give
5. Click **Add Activity**

### For Students (Redeeming Codes)

1. Generate a code from DP4DP (or other source) using the activity you just created
2. Go to your profile → Redeem tab
3. Paste the code
4. On successful redemption:
   - You'll get the specified rewards (points and/or card)
   - The card will appear in your collection
   - Achievement will be recorded

## Testing

To test this fix:

1. Create a card in your class (if you don't have one)
2. Add an activity with:
   - Source ID: "test"
   - Activity ID: "testcard"
   - Reward Type: "Card"
   - Select a card
3. Generate a code using these values
4. Try redeeming it - you should:
   - Get a success message
   - See the card appear in your collection
   - See the activity recorded in achievements

## Files Modified

- `src/services/rewardCodeService.js` (2 functions updated)
- `src/components/admin/ActivityCatalogueManager.jsx` (UI enhancements)

## Backwards Compatibility

- Existing "points-only" activities work unchanged
- Existing activities with incomplete card data will still redeem but won't give cards (they need to be recreated with a proper cardId)
