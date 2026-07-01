# Walkthrough — Manual Deposit System & Instrument Browser Fix

I have completed the manual deposit system and fixed the category segment browser crash. Here is a summary of the achievements and changes:

---

## 🛠️ Changes Implemented

### 1. Database Schema (`029_manual_deposits_options.sql`)
- **Table Created**: `payment_methods` containing `id`, `slot` (1, 2, 3), `is_active`, `upi_id`, `bank_name`, `account_name`, `account_number`, `ifsc_code`, `qr_code_url`, and `instructions`.
- **Pre-seeded**: Seaded 3 default payment methods for Options 1, 2, and 3.
- **Constraints Altered**: Dropped the old `deposit_requests_method_check` constraint on `deposit_requests` table to allow custom options.
- **Columns Added**: Added `payment_method_slot` (integer 1, 2, 3) to the `deposit_requests` table.
- **Security (RLS)**: Enabled RLS on `payment_methods` and allowed authenticated users to select active records.

### 2. Express Backend API
- **User Route (`backend/src/routes/deposits.js`)**:
  - `GET /api/deposits/payment-methods`: Fetches active manual payment channels.
  - `POST /api/deposits`:
    - Enforces mandatory fields: `amount` (minimum ₹500 INR), `utr_number`, and `screenshot_base64`.
    - Converts `screenshot_base64` payload into an image receipt file and writes it to `uploads/`.
    - Inserts a new pending deposit request linked to the selected Option slot.
- **Admin Route (`backend/src/routes/admin.js`)**:
  - `GET /api/admin/payment-methods`: Retrieves all configured payment options.
  - `PUT /api/admin/payment-methods/:slot`: Allows updating details, toggling active status, and uploading a base64 QR code to `uploads/` for each channel.

### 3. Trader App (User UI)
- **API and Store (`api.js`, `useWalletStore.js`, `useTradeStore.js`)**:
  - Extended `submitDeposit` to pass screenshot base64, payment option slot, and descriptive option names.
  - Added `getPaymentMethods()` endpoint wrapper.
- **Wallet UI (`Wallet.jsx`)**:
  - Replaced the simple UPI modal form with an advanced deposit option selector (Option 1, 2, 3 tabs).
  - Selected tab displays configured QR code scan image, UPI ID (with "Copy" clipboard button), bank transfer details (with holder name, account number, IFSC, and copy controls), and instructions.
  - Mandates Amount (₹500 minimum check), UTR number, and screenshot file upload (using FileReader to capture base64).
  - Displays a clean success message: *"Successful! Please wait to get your payment verified."*

### 4. Admin Panel (Admin UI)
- **API Client (`adminApi.js`)**:
  - Added `getPaymentMethods` and `updatePaymentMethod` calls.
- **Deposit approvals Page (`DepositApprovals.jsx`)**:
  - Added **Configure Channels** tab to directly manage the payment slot options.
  - Rendered 3 card modules for Option 1, 2, and 3 channels to easily edit UPI IDs, upload QR code images, modify bank transfer numbers, update user instructions, and toggle online/offline status.
  - Fixed "View Proof" action to open the static uploaded receipt screenshot in a new tab.
  - Bound "Rejection reason" notes text area and combined it with selected dropdown reason to save detailed rejection reasons when denying deposit transactions.

### 5. Bug Fix: Mobile Instrument Browser Segment Blank Page Crash
- **File Fixed**: [`InstrumentBrowser.jsx`](file:///c:/Users/HP/Desktop/Trading%20Company%20Project/apps/trader-app/src/components/ui/InstrumentBrowser.jsx)
- **Bug**: The code had a reference to an undeclared/unpassed variable `fmtPrice` inside `InstrumentRow` props assignment (`fmtPrice={fmtPrice}`). This threw a runtime `ReferenceError` when expanding any category folder (Stocks, Indices, Forex, etc.) or when typing in search, causing the React render tree to crash and render a blank page.
- **Fix**: Removed the unused and undeclared `fmtPrice` prop. `InstrumentRow` now correctly formats prices using the statically imported `formatPrice` helper.

## 8. Market Hours & Holiday Calendar Enforcement
- **Segment Timings Matrix**: Created `marketHours.js` utility specifying timezone-aware market session timing ranges (in IST) for NSE (`nse_equity`, `fo_futures` Monday-Friday 09:15 - 15:30), MCX (Monday-Friday 09:00 - 23:30), Forex/Global Indices (weekday 24h), US Equities (Monday-Friday 09:30 - 16:00 America/New_York time), and Crypto (24/7).
- **Holiday Calendar Check**: Integrated checks with the `market_holidays` database table to automatically block placements on official exchange holidays for NSE and MCX.
- **Hot-Path Pre-Trade Check**: Leveraged the local cache memory singleton inside `validator.js` to perform segment validation instantly with zero database queries when the cache is warm.

## 9. EOD Auto-Cut (Intraday Position Auto-Squareoff) Cron
- **Self-Healing Cron Scheduler**: Implemented a minutely background job in `marketHoursCron.js` that evaluates all active open positions in the database.
- **Graceful Liquidation**: If any open position is found outside its allowed trading hours (or when a market closes), the cron automatically triggers `close_position_v2` to realize P&L, release margin, debit wallet fees, log the audit history, emit Socket.IO updates to update client dashboards in real-time, and dispatch PWA push notifications to the user.

## 10. Bracket Order Multi-Leg Modification
- **API Extension**: Updated `PUT /api/orders/:id` in `orders.js` to accept and validate modifying the Stop Loss and Target price parameters of pending limit bracket orders, preventing invalid parameters (such as setting an SL above entry for a buy) on edit.
- **Frontend Enhancements**: Modified `ModifyOrderForm` in `Orders.jsx` to dynamically render custom Stop Loss and Target input boxes when editing a pending bracket order, complete with client-side verification.

## 17. Trades & Orders Integration
- **Backend Admin Overrides (`admin.js`)**:
  - Implemented order modification (dynamic leverage margin recalculation, database block/release updates, wallet cache invalidation, and execution engine sync) and cancellation handlers.
  - Implemented trade modification (gross/net P&L delta calculations, User wallet balance corrections, manual ledger journal postings, and audit logging) and deletion/ghosting handlers.
- **Frontend Master Trades Ledger (`Trades.jsx`)**:
  - Refactored the UI column rendering to align with completed round-trip fields: Entry Price, Exit Price, Qty, and Net PNL (dynamically highlighted in green or red depending on gains/losses).
  - Wired live state hooks to search (`searchTerm`), market segment selection (`marketFilter`), and closed date (`dateFilter`) for instantaneous client-side filtering.
  - Hooked up Modify and Delete (Ghost) confirm modal forms to request mandatory audit reasons and invoke corresponding backend override endpoints.
  - Built a native CSV report exporter using the browser `Blob` object for memory safety and encoding compatibility under high volumes.

---

## 🧪 Verification Plan

### Build Verification
All packages compiled successfully:
- **`trader-app`**: Compiled with 0 errors via `npm run build`.
- **`admin-panel`**: Compiled successfully with 0 errors via `npm run build`.
- **`backend`**: Node check syntax checks (`node --check`) passed successfully on all source codes, route files, and execution scripts.

## 18. Market Control Integration
- **Database Table Setup & Seeding (`market_control`)**:
  - Identified that the `market_control` table was missing in database migrations. Created `public.market_control` containing columns `id`, `segment`, `trading_status`, `start_time`, `end_time`, and `manual_halt`, and granted permissions to `service_role`.
  - Pre-seeded the table with standard session hours for dabba trading segments (`nse_equity`, `bse_equity`, `fo_futures`, `fo_options`, `mcx`, `forex`, `crypto`).
  - Pre-seeded the `market_holidays` table with exchange holidays and registered the `exchange` parameter.
- **Backend Enforcement (`marketHours.js`)**:
  - Connected `checkMarketHours` validator check directly to the `market_control` database table.
  - Placed immediate validation blocks: If a segment's `trading_status` is updated to `'closed'` or `'halted'` (or if `manual_halt` is active), order placements are blocked with descriptive warning reasons before being sent to queues.
- **Frontend Panel Overhauls (`MarketControl.jsx`)**:
  - **Trading Sessions**: Wired list items to dynamic database timings. Toggling session status runs atomic updates, and editing session timings saves directly to `start_time` and `end_time` parameters in the database.
  - **Circuit Breakers / Instrument Controls**: Replaced static placeholders with live database instruments configuration via `getInstruments()`. Built search filtering and modal update actions to adjust circuits, margins, leverage, and trading access.
  - **Upcoming Holidays**: Replaced placeholders with real `market_holidays` list. Wired up "+ Declare Holiday" form modal and "Remove Holiday" deletion triggers.
  - **Emergency Controls**: Connected the header "Halt All Markets" toggle directly to the active `global_kill_switch` setting, with a prominent red emergency banner displayed whenever halted.

### 1. Manual Validation Checklist
1. **Instrument Browser Expansion**: Login to Trader app → click Watchlist edit/add icon (+) → select any segment category folder (e.g. NSE India Stocks, Global Indices) → verify it expands cleanly showing instrument listings without crashing.
2. **Instrument Browser Search**: Start typing a search query in the browser (e.g. "RELIANCE") → verify matching results show up instantly.
3. **Option Selection**: Go to Funds → click Add Funds → verify you can see Option 1, 2, 3.
4. **Details Display**: Confirm QR, UPI ID, copy button, and bank details change dynamically based on the selected Option tab.
5. **Form Validations**:
   - Try submitting with an amount < 500 (shows validation error).
   - Try submitting without UTR or screenshot (Deposit button is disabled).
6. **Deposit Submission**: Upload an image, enter a UTR and amount >= 500, click Submit. Confirm success message is shown and modal closes.
7. **Admin Configuration**: Open Admin panel → go to Deposits → select "Configure Channels" tab. Edit the details of Option 1/2/3 and upload a new QR code image. Click Save. Go back to Trader app and confirm the new details are visible.
8. **Manual Approval/Rejection**: In Admin panel, click Pending Deposits tab. Locate your transaction, click View Receipt to verify the uploaded screenshot. Click Approve to credit the user's wallet, or click Reject and specify notes.

### 2. Live Services Status
- **Backend API Server (Local)**: Running on `http://localhost:4000/` (Task ID: `task-2352`)
- **Trader App (Local)**: Running on `http://localhost:3000/` (Task ID: `task-2354`)
- **Admin Panel (Local)**: Running on `http://localhost:5173/` (Task ID: `task-2356`)
- **Backend API Server (Production AWS EC2)**: Running on `https://api.stockslab.live/` (PM2 Process: `tradex-backend`)

---

## 🚀 Deployment Verification

### Git Push
- **Repository URL**: `https://github.com/stockslabindia/project.git`
- **User Authenticated**: `stockslabindia` via Windows Credential Manager
- **Branch**: `main`
- **Push Status**: Successfully pushed local commit `06780e5` to remote origin.

### AWS EC2 Deploy
- **Server IP**: `51.20.248.9` (AWS Stockholm EC2)
- **Deployment Pathway**: Git-over-SSH direct push (`git config receive.denyCurrentBranch updateInstead`) using `stockslab-backend-aws-key.pem`
- **PM2 Reload**: Updated production backend dependencies and restarted PM2 app `tradex-backend`.
- **Health Check Status**: Verified via `https://api.stockslab.live/health` -> `{"status":"ok"}`.
