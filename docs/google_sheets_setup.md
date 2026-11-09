# Google Sheets Webhook Setup Guide (Option 1: $0 Serverless Database)

This guide shows you how to connect RemoteJobsHub to a free Google Sheet using a Google Apps Script Webhook. Whenever a candidate signs up for the **Free Digest ($0)**, **1-Month VIP Alerts ($5/mo)**, or the **3-Month Sprint Pass ($10)**, their record is appended to your private Google Sheet in real time.

---

## Step 1: Create Your Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com/) and create a new spreadsheet named:  
   **`RemoteJobsHub Subscribers`**
2. In the first tab (named `Sheet1`), set the column headers in Row 1:

| Column A | Column B | Column C | Column D | Column E | Column F | Column G | Column H |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Timestamp** | **Email** | **Role** | **Scope** | **Keywords** | **Plan** | **ExpiresAt** | **Status** |

---

## Step 2: Add Google Apps Script Webhook

1. In your Google Sheet top menu, click **Extensions** ➔ **Apps Script**.
2. Delete any boilerplate code in `Code.gs` and paste the following script:

```javascript
/**
 * RemoteJobsHub - Candidate Alerts & Subscriber Webhook
 * Handles incoming POST requests and appends rows to Google Sheets.
 */
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);

    // Format fields
    const timestamp = data.subscribedAt || new Date().toISOString();
    const email = data.email || '';
    const role = data.roleCategory || 'all';
    const scope = data.location || 'worldwide';
    const keywords = data.keywords || '';
    const plan = data.plan || 'free';
    const expiresAt = data.expiresAt || '';
    const status = data.status || 'active';

    // Prevent duplicate entries for the same email
    const values = sheet.getDataRange().getValues();
    let updated = false;

    for (let i = 1; i < values.length; i++) {
      if (values[i][1] && values[i][1].toString().toLowerCase() === email.toLowerCase()) {
        // Update existing subscriber row
        sheet.getRange(i + 1, 1, 1, 8).setValues([[
          timestamp,
          email,
          role,
          scope,
          keywords,
          plan,
          expiresAt,
          status
        ]]);
        updated = true;
        break;
      }
    }

    if (!updated) {
      // Append new row: [Timestamp, Email, Role, Scope, Keywords, Plan, ExpiresAt, Status]
      sheet.appendRow([
        timestamp,
        email,
        role,
        scope,
        keywords,
        plan,
        expiresAt,
        status
      ]);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: updated ? "Subscriber updated" : "Subscriber added",
      email: email,
      plan: plan
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Optional GET test handler
function doGet(e) {
  return ContentService.createTextOutput("RemoteJobsHub Webhook is active and healthy.")
    .setMimeType(ContentService.MimeType.TEXT);
}
```

3. Click the 💾 **Save** icon (or press `Ctrl + S`).

---

## Step 3: Deploy as Web App

1. Click the blue **Deploy** button (top right) ➔ **New deployment**.
2. Click the gear icon ⚙️ next to *Select type* and choose **Web app**.
3. Fill in the fields:
   - **Description**: `RemoteJobsHub Subscriber Endpoint`
   - **Execute as**: `Me (<your_email>@gmail.com)`
   - **Who has access**: `Anyone` *(Crucial so candidate forms can post without logging in)*
4. Click **Deploy**.
5. Click **Authorize access**, choose your Google account, click **Advanced**, and then click **Go to RemoteJobsHub (unsafe)** (standard Google warning for personal scripts).
6. Copy the **Web App URL** generated. It will look like:  
   `https://script.google.com/macros/s/AKfycbx.../exec`

---

## Step 4: Connect to RemoteJobsHub Frontend

You have two simple ways to set your Web App URL:

### Method A: Set in `dashboard/app.js` (Easiest)
Open `dashboard/app.js` and set:
```javascript
const GOOGLE_SHEET_WEBHOOK_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
```

### Method B: Or via `dashboard/index.html`
Add before `<script src="app.js...>`:
```html
<script>
  window.REMOTE_JOBS_HUB_WEBHOOK_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
</script>
```

---

## Step 5: Connect to Backend Alert Dispatcher

To let Python read the subscribers list directly from Google Sheets:

1. In your Google Sheet, click **File** ➔ **Share** ➔ **Publish to web**.
2. Choose **Entire Document** (or `Sheet1`), and select format **Comma-separated values (.csv)**.
3. Click **Publish** and copy the published link:  
   `https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv`
4. Set it as an environment variable in GitHub Repository Secrets or locally:
   ```bash
   export SUBSCRIBERS_SHEET_CSV_URL="https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv"
   ```
5. When the GitHub Action or cron runs `python -m aggregator.alerts.dispatcher --instant`, it will fetch active subscribers directly from your Google Sheet, check if `ExpiresAt` is valid, and send direct-ATS alerts automatically!
