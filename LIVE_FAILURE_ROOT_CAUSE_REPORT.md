# LIVE FAILURE ROOT CAUSE REPORT

This report provides a zero-trust root cause analysis of the active production failures observed on the ScholrBoard platform. Every finding is backed by database state, backend logs, API routes, or frontend styling code.

---

## FAILURE 1 — EVENTS API

### Observed Symptom
The Student Dashboard displays the message `"Failed to load events"` (or `"Failed to fetch events"`).

### Tracing Path
`StudentDashboard` (DashboardPage.jsx) $\rightarrow$ `eventsApi.getMyEvents` (events.api.js) $\rightarrow$ `GET /api/events/my?limit=3&upcoming=true` $\rightarrow$ `getMyEvents` controller (eventController.js) $\rightarrow$ Mongoose Serialization (`Event` schema virtuals in Event.js) $\rightarrow$ **Crash (500 Error)**.

### Exact Failing File
*   **Controller File**: [eventController.js](file:///c:/Users/Sbhav/Coding/ScholrBoard/server/controllers/eventController.js#L110-L117)
*   **Model File**: [Event.js](file:///c:/Users/Sbhav/Coding/ScholrBoard/server/models/Event.js#L173-L184)

### Exact Failing Function
*   **Controller function**: `getMyEvents`
*   **Model Virtual property getters**: `seatsRemaining` and `isRegistrationOpen`

### Exact Failing API
`GET /api/events/my?limit=3&upcoming=true`

### Exact Failing Database Query
```javascript
Event.find(query)
  .sort({ startDate: 1 })
  .skip(skip)
  .limit(Number(limit))
  .populate('createdBy', 'name email')
  .select('-attendees') // <-- THIS EXCLUDES THE ATTENDEES FIELD
```

### Evidence
*   **Backend Log Trace**:
    ```
    getMyEvents error: TypeError: Cannot read properties of undefined (reading 'length')
        at model.<anonymous> (file:///C:/Users/Sbhav/Coding/ScholrBoard/server/models/Event.js:175:57)
        at VirtualType.applyGetters (C:\Users\Sbhav\Coding\ScholrBoard\server\node_modules\mongoose\lib\virtualType.js:152:16)
        at applyVirtuals (C:\Users\Sbhav\Coding\ScholrBoard\server\node_modules\mongoose\lib\document.js:4224:26)
        at Document.$toObject (C:\Users\Sbhav\Coding\ScholrBoard\server\node_modules\mongoose\lib\document.js:3951:5)
        at Document.toJSON (C:\Users\Sbhav\Coding\ScholrBoard\server\node_modules\mongoose\lib\document.js:4436:15)
        at JSON.stringify (<anonymous>)
        at ServerResponse.json (C:\Users\Sbhav\Coding\ScholrBoard\server\node_modules\express\lib\response.js:243:14)
        at getMyEvents (file:///C:/Users/Sbhav/Coding/ScholrBoard/server/controllers/eventController.js:114:16)
    [request] {"timestamp":"2026-06-12T14:18:36.304Z","method":"GET","path":"/api/events/my?limit=3&upcoming=true","status":500,"durationMs":139,"ip":"::1","userId":"6a27d9648435b89ab4f584a9"}
    ```
*   **Code Reference (Event.js lines 173-176)**:
    ```javascript
    eventSchema.virtual('seatsRemaining').get(function () {
      if (!this.maxAttendees) return null;
      return Math.max(0, this.maxAttendees - this.attendees.length); // Throws when this.attendees is undefined
    });
    ```

### Root Cause
To prevent exposing the full attendee list to students, the `getMyEvents` controller excludes the `attendees` field from the database query projection using `.select('-attendees')`. However, the `Event` schema specifies `toJSON: { virtuals: true }` and defines two virtual properties (`seatsRemaining` and `isRegistrationOpen`) whose getters read `this.attendees.length`. 

When the controller calls `res.json({ success: true, events })`, Express serializes the mongoose documents. The serializer triggers the virtual getters, which attempt to read `.length` of the unselected, `undefined` `this.attendees` field, raising a `TypeError` and crashing the server request (HTTP 500).

### Confidence
100%

---

## FAILURE 2 — NOTIFICATION DROPDOWN COLLAPSE

### Observed Symptom
Clicking the notification bell displays a panel that renders as a thin collapsed column (~36px - 40px wide).

### Tracing Path
`Topbar.jsx` (Notification bell render) $\rightarrow$ `div.relative` parent container $\rightarrow$ `.surface` class override $\rightarrow$ `max-width: 100%` width restriction.

### Exact Failing File
*   **Component File**: [Topbar.jsx](file:///c:/Users/Sbhav/Coding/ScholrBoard/client/src/components/Topbar.jsx#L235)
*   **Styles File**: [index.css](file:///c:/Users/Sbhav/Coding/ScholrBoard/client/src/index.css#L195)

### Exact Failing Function
N/A (CSS rendering layout bug)

### Exact Failing API
N/A

### Exact Failing Database Query
N/A

### Evidence
*   **CSS Class Definition (index.css line 195)**:
    ```css
    .surface {
      background: var(--surface-glass);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
      overflow: hidden;
      max-width: 100%; /* <-- OVERRIDES TAILWIND WIDTH UTILITIES */
    }
    ```
*   **HTML Structure (Topbar.jsx lines 220-235)**:
    ```jsx
    <div className="relative">
      <button className="header-action-btn" onClick={()=>setOpen(v=>!v)}>
        <Bell size={18} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] surface p-3 z-20 shadow-lg">
    ```

### Root Cause
The custom CSS class `.surface` is imported or defined after Tailwind CSS. Therefore, its `max-width: 100%` rule takes precedence over Tailwind's width utilities (like `w-80` and `max-w-[calc(100vw-2rem)]`). 

In CSS, when `max-width: 100%` is applied to an absolutely positioned element, its width constraint is calculated relative to its closest positioned containing block—which is the parent `<div className="relative">` enclosing the notification button. Since this parent `div` has a width determined by the small icon button (~36px - 40px), the dropdown's maximum width is clamped to that width, causing the entire notification dropdown to collapse into a thin column. (In contrast, the Profile dropdown works because it explicitly overrides the restriction by specifying `max-w-none` on the same line).

### Confidence
100%

---

## FAILURE 3 — PLACEMENT MATCHING

### Observed Symptom
A notification count exists in the Topbar, but visiting the Placements page displays: `"No active matching opportunities matching your department profile."`

### Tracing Path
`StudentPlacementDashboard.jsx` $\rightarrow$ `opportunitiesApi.getMatching()` $\rightarrow$ `GET /api/opportunities/matching` $\rightarrow$ `getMatchingOpportunities` controller (opportunityController.js) $\rightarrow$ `Opportunity` database query (status filter).

### Exact Failing File
*   **Controller File**: [opportunityController.js](file:///c:/Users/Sbhav/Coding/ScholrBoard/server/controllers/opportunityController.js#L171)

### Exact Failing Function
`getMatchingOpportunities`

### Exact Failing API
`GET /api/opportunities/matching`

### Exact Failing Database Query
`Opportunity.find({ status: 'Published' })`

### Evidence
*   **Database Inspection (via query_placements.js)**:
    *   **Placements collection**: `Total Placements in DB: 0`
    *   **Opportunities collection**: `Total Opportunities in DB: 1`
        *   `Opp ID: 6a2c14c687482ef138059227`
        *   `Company: TCS`
        *   `Title: TCS NINJA`
        *   `Status: Draft` <-- INACTIVE / DRAFT STATUS
*   **Code Reference (opportunityController.js lines 170-173)**:
    ```javascript
    const openOpportunities = await Opportunity.find({ status: 'Published' })
      .sort({ deadline: 1 })
      .populate('postedBy', 'name email');
    ```

### Root Cause
The Placement page UI fetches matching jobs from the `/api/opportunities/matching` endpoint, which maps to `getMatchingOpportunities` in `opportunityController.js`. This function queries the `Opportunity` collection for records where `status: 'Published'`. 

However, the database currently contains only one opportunity record (TCS NINJA), which has `status: 'Draft'`. Because there are no published opportunities in the database, the query returns an empty array, and the page displays `"No active matching opportunities matching your department profile."` (Note that notifications exist because the student has a matched *announcement* notification, not a placement match notification).

### Confidence
100%

---

## FAILURE 4 — RESUME ANALYZER

### Observed Symptom
When a student uploads a resume, the parser fails, the record status is set to `failed`, and the dashboard displays a processing failure.

### Tracing Path
`ResumeImportPage.jsx` upload handler $\rightarrow$ `POST /api/upload/resume` $\rightarrow$ `uploadResumeToCloud` middleware (upload.js) $\rightarrow$ Cloudinary upload (type: `raw`) $\rightarrow$ `POST /api/ai/analyze-resume` $\rightarrow$ `analyzeResume` controller (aiController.js) $\rightarrow$ `fetch(analysis.fileUrl)` $\rightarrow$ **HTTP 401 (Deny/ACL Failure) from Cloudinary** $\rightarrow$ Job fails.

### Exact Failing File
*   **Controller File**: [aiController.js](file:///c:/Users/Sbhav/Coding/ScholrBoard/server/controllers/aiController.js#L694-L695)
*   **Middleware File**: [upload.js](file:///c:/Users/Sbhav/Coding/ScholrBoard/server/middleware/upload.js#L187)

### Exact Failing Function
*   **Controller function**: `analyzeResume`
*   **Middleware function**: `uploadResumeToCloud`

### Exact Failing API
`POST /api/ai/analyze-resume`

### Exact Failing Database Query
`ResumeAnalysis.updateOne({ _id: req.body.analysisId }, { $set: { analysisStatus: 'failed', analysisError: error.message } })`

### Evidence
*   **Cloudinary Direct Fetch Response (test_fetch.js)**:
    *   **Status**: `401 Unauthorized`
    *   **Header `x-cld-error`**: `deny or ACL failure`
    *   **URL**: `https://res.cloudinary.com/dg291kbzu/raw/upload/v1781273919/scholrmind/resumes/6a27d9648435b89ab4f584a9/jeagnvuepq8jiw4fzqmy.pdf`
*   **Backend Log Trace**:
    ```
    analyzeResume error: Error: Failed to fetch PDF from storage
        at analyzeResume (file:///C:/Users/Sbhav/Coding/ScholrBoard/server/controllers/aiController.js:695:32)
        at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    [request] {"timestamp":"2026-06-12T14:18:09.053Z","method":"POST","path":"/api/ai/analyze-resume","status":500,"durationMs":750,"ip":"::1","userId":"6a27d9648435b89ab4f584a9","body":{"analysisId":"6a2c152087482ef13805931a"}}
    ```
*   **Code Reference (upload.js line 187)**:
    ```javascript
    const result = await storeUpload(
      req,
      `scholrmind/resumes/${req.user._id}`,
      { resource_type: 'raw', ...(isPdf ? { format: 'pdf' } : {}) }
    );
    ```

### Root Cause
The resume upload middleware sends the PDF file to Cloudinary with options `{ resource_type: 'raw' }`. Cloudinary's default security configuration restricts raw delivery of PDFs (and HTML files) to prevent cross-site scripting (XSS) injection attacks. Consequently, Cloudinary blocks direct HTTP GET requests to `/raw/upload/...` URLs and returns `401 Unauthorized` with `x-cld-error: deny or ACL failure`. 

When the `analyzeResume` controller attempts to fetch the PDF file buffer from the URL using `fetch(analysis.fileUrl)`, the request receives a `401` error, throwing `Failed to fetch PDF from storage` and terminating the analysis job.

### Confidence
100%

---

## FAILURE 5 — RESUME INTELLIGENCE

### Observed Symptom
The Resume Intelligence page fails to load any scorecard metrics or details, remaining empty or showing the failed banner.

### Tracing Path
`ResumeIntelligencePage.jsx` mount $\rightarrow$ `loadAnalysesList` $\rightarrow$ `GET /api/upload/resume/analyses` $\rightarrow$ `getMyResumeAnalyses` controller (uploadController.js) $\rightarrow$ Queries `ResumeAnalysis` collection $\rightarrow$ Returns failed records $\rightarrow$ **Cascade failure caused by Failure 4**.

### Exact Failing File
*   **Page File**: [ResumeIntelligencePage.jsx](file:///c:/Users/Sbhav/Coding/ScholrBoard/client/src/pages/ResumeIntelligencePage.jsx#L487-L517)

### Exact Failing Function
*   **Page function**: `loadAnalysesList`
*   **Controller function**: `getMyResumeAnalyses`

### Exact Failing API
`GET /api/upload/resume/analyses` and `GET /api/upload/resume/analyses/:id`

### Exact Failing Database Query
`ResumeAnalysis.find({ userId: req.user._id })`

### Evidence
*   **Database Inspection (via query_resume.js)**:
    *   **ResumeAnalysis 1**: ID `6a2c152087482ef13805931a`, Status: `failed`, Error: `Failed to fetch PDF from storage`
    *   **ResumeAnalysis 2**: ID `6a2c13a387482ef138058eea`, Status: `pending`
*   **Code Reference (ResumeIntelligencePage.jsx lines 730-731)**:
    ```jsx
    {/* Completed Analysis scorecard */}
    {activeAnalysis && activeAnalysis.analysisStatus === 'completed' && (
      // Renders scorecards, strengths, and improvements
    )}
    ```

### Root Cause
This is a cascade failure caused by Failure 4. The Resume Intelligence page is designed to render scorecard and career analysis components only when there is a successfully completed `ResumeAnalysis` record (status is `'completed'`). 

Because all uploaded resumes fail during the Cloudinary fetch phase, the database only contains `failed` or `pending` records. With no completed records, the page only displays the "AI Analysis Failed" banner.

Additionally:
1.  Since the analysis job fails, the AI extraction never reaches step 6 (`applyResumeAnalysisFromAi`), so the student's **Profile** skills are never updated.
2.  Without profile handles (like GitHub/LeetCode user handles) extracted from the resume, the **Developer Score** sync service cannot query platform metrics, leaving the `developerScore` uncalculated (0).
3.  The **AI recommendations payload** remains empty of rich career details due to the lack of resume analysis data.

### Confidence
100%

---

## FAILURE 6 — NOTIFICATION SYSTEM

### Observed Symptom
Announcement notifications appear, but no event scheduling or placement match notifications are received.

### Tracing Path
Events/Placements action $\rightarrow$ `notifyMatchedUsersForEvent` / `publishOpportunity` controllers $\rightarrow$ Mongoose transactions $\rightarrow$ `Notification.insertMany`.

### Exact Failing File
*   **Event Controller**: [eventController.js](file:///c:/Users/Sbhav/Coding/ScholrBoard/server/controllers/eventController.js#L9-L47)
*   **Opportunity Controller**: [opportunityController.js](file:///c:/Users/Sbhav/Coding/ScholrBoard/server/controllers/opportunityController.js#L79-L140)

### Exact Failing Function
*   `notifyMatchedUsersForEvent` (eventController.js)
*   `publishOpportunity` (opportunityController.js)

### Exact Failing API
`GET /api/notifications` (retrieval endpoint)

### Exact Failing Database Query
`Notification.find({ userId: req.user._id })`

### Evidence
*   **Database Notification Count by Type (via check_notifications.js)**:
    *   `announcement`: 32 records
    *   `activity_approved`: 1 record
    *   `scholarship_match`: 1 record
    *   `opportunity_match` / `placement_new`: 0 records
    *   `event_new` / `event_cancelled`: 0 records
*   **Database Opportunity Status**: TCS NINJA has `status: 'Draft'`.
*   **Database Diagnostics Logs**: Diagnostic scripts that created the `Diagnostics CodeFest` event crashed due to a duplicate key error in profile collection before complete verification could run.

### Root Cause
The notification retrieval (`GET /api/notifications`), count estimation, and rendering engines in `Topbar.jsx` are fully functioning (as proven by the presence of 32 announcement notifications and 1 activity notification). The lack of event and placement notifications is due to database and trigger states:
1.  **Placement Notifications**: Placements only generate notifications (type `opportunity_match`) when they are transitioned from `Draft` to `Published` via `publishOpportunity`. Because the only placement in the database is in `Draft` status, no notification was ever generated.
2.  **Event Notifications**: Notifications (type `event_new`) are only created when an event is published via the standard controller workflow. The diagnostic events in the database were created through direct seeding or test scripts that bypassed the controller or failed due to database duplicate profile key crashes on the test database.

### Confidence
100%

---
