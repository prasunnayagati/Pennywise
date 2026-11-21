# Product Requirements Document (PRD)
## Pennywise — Making every penny count

**Version:** 1.0  
**Status:** Prototype specification  
**Product type:** Responsive web application  
**Primary currency:** INR (configurable display preference)

---

## 1. Product summary

Pennywise is a simple personal-finance workspace that helps an individual record income and expenses, understand spending patterns, set budgets, track savings goals, retain bill images and view a basic estimate of future expenses.

The product is an organizer and analysis tool. It is **not** a wallet, payment gateway, banking application or bill-payment service. Users manually record transactions that happened elsewhere. Pennywise never collects payment credentials or initiates a payment.

## 2. Problem statement

People often track expenses across memory, messages, paper receipts and spreadsheets. This makes it difficult to understand where money goes, notice overspending early, plan savings or retain supporting receipts.

Pennywise brings these activities into one uncluttered interface and converts recorded transactions into understandable summaries.

## 3. Product vision

Make everyday personal-finance tracking quick, understandable and useful without overwhelming users with complex financial terminology or unnecessary features.

## 4. Goals

1. Make recording a transaction take less than one minute.
2. Show a useful financial snapshot immediately on the dashboard.
3. Make category budgets and remaining limits easy to understand.
4. Give users a place to attach bill/receipt images to their records.
5. Show transparent spending summaries and a clearly labelled estimate.
6. Work well on desktop, tablet and mobile.
7. Keep the interface professional, calm and accessible.

### Non-goals

- Direct payments, money transfers or payment collection.
- Bank account/card linking or credential storage.
- Tax filing, investment advice, credit scoring or lending.
- Claims of guaranteed AI predictions.
- Multi-user production authentication in this prototype.

## 5. Target users

**Primary persona — Individual expense tracker**
- Wants to record salary/income and daily spending.
- Needs simple monthly budgets.
- Wants to understand spending by category.
- May save receipt images for later reference.
- Prefers a quick, low-friction interface.

**Secondary persona — Student / early-career professional**
- Has variable income or allowance.
- Wants to plan savings goals.
- Needs a simple view of recurring subscriptions and bills.

## 6. Product principles and UX direction

- **Simple first:** common tasks should be reachable in one or two actions.
- **Clarity over decoration:** no gradient backgrounds, excessive animation or dense dashboards.
- **Professional visual language:** plum `#A47DAB` as the primary accent, darker plum controls, warm off-white canvas, white cards, neutral borders and restrained status colors.
- **Responsive:** sidebar on wide screens; compact icon navigation on smaller screens.
- **Honest intelligence:** forecasts and health indicators must be described as estimates based on user-entered data.
- **Privacy-conscious:** do not ask for bank credentials or payment details.

## 7. Information architecture

Primary navigation:
1. Dashboard
2. Transactions
3. Budgets
4. Analytics
5. Forecast
6. Savings goals
7. Bills & receipts
8. Recurring expenses
9. Reports
10. Settings

## 8. Functional requirements

### FR-01 Dashboard
- Display current balance, income, expenses and net savings.
- Provide a period selector.
- Display spending by category.
- Display income vs expense trend.
- Show recent transactions.
- Show a basic financial-health indicator and data-derived observations.
- Provide quick actions for adding a transaction, budget, goal and receipt.

**Acceptance criteria:** adding or editing a transaction updates the dashboard totals and charts after the API response succeeds.

### FR-02 Transactions
- Create income and expense records.
- Required fields: description, amount, type, category and date.
- Optional note and receipt attachment.
- Edit and delete records.
- Search by description/category/note.
- Filter by type, category and month.
- Export records as CSV.

**Validation:** amount must be greater than zero; description, type, category and date are required.

### FR-03 Budgets
- Create one monthly limit per category.
- Edit and remove budgets.
- Calculate category spending from expense transactions.
- Display amount spent, remaining amount and percentage used.
- Visually flag budgets that have reached or exceeded their limit.

### FR-04 Analytics
- Summarize income, expenses and net savings for the selected month.
- Visualize category distribution.
- Visualize monthly cash flow.
- Present plain-language observations derived from recorded activity.

### FR-05 Expense forecast
- Estimate the next month's expenses using available monthly expense history.
- Show the number of months used and the calculation explanation.
- Clearly label output as an estimate, not financial advice.
- Avoid false precision when there is little history.

**Prototype method:** weighted average of the latest available monthly totals, with a greater weight on the latest month. This is a baseline for demonstrating the workflow; a future ML model should be validated against historical holdout data.

### FR-06 Savings goals
- Create a named goal with target amount, saved amount and optional target date.
- Add contributions.
- Display progress percentage and remaining amount.
- Remove a goal.

### FR-07 Bills and receipts
- Upload image files (JPG, PNG, WEBP).
- Store the image locally and associate it with a transaction when uploaded through the transaction form.
- Display image previews and allow deletion.
- Validate file type and size on the server.
- No OCR is required for the initial prototype; receipt extraction can be a future enhancement.

### FR-08 Recurring expenses
- Record recurring expense name, amount, frequency and next due date.
- List and remove recurring records.
- These are reminders/records only; no payment is initiated.

### FR-09 Reports
- Summarize monthly income, expenses and net.
- Export transaction data to CSV.

### FR-10 Settings
- Save display name and currency preference.
- Clear all saved records and receipt images after confirmation.
- Explain local storage and prototype privacy limitations.

## 9. Non-functional requirements

- Responsive layout at common mobile, tablet and desktop widths.
- Accessible labels, keyboard-operable controls and readable contrast.
- Server-side validation for all write operations.
- Restrict receipt uploads by MIME type and file size.
- Handle API errors with useful messages.
- Persist prototype records between server restarts using a local JSON data file.
- Keep API and UI concerns separated.
- No secrets or payment credentials in source code.

## 10. Data model

### Transaction
`id, description, amount, type, category, date, note, receiptId, createdAt, updatedAt`

### Budget
`id, category, monthlyLimit, createdAt, updatedAt`

### SavingsGoal
`id, name, targetAmount, savedAmount, targetDate, createdAt`

### RecurringExpense
`id, name, amount, frequency, nextDueDate, category, createdAt`

### Receipt
`id, originalName, storedName, mimeType, size, transactionId, uploadedAt`

### Settings
`displayName, currency, monthlyIncomeTarget`

## 11. API requirements

- `GET /api/health`
- `GET, POST /api/transactions`
- `PUT, DELETE /api/transactions/:id`
- `GET, POST /api/budgets`
- `PUT, DELETE /api/budgets/:id`
- `GET, POST /api/goals`
- `POST /api/goals/:id/contributions`
- `DELETE /api/goals/:id`
- `GET, POST /api/subscriptions`
- `DELETE /api/subscriptions/:id`
- `GET /api/analytics/summary`
- `GET /api/analytics/forecast`
- `GET, POST /api/receipts`
- `DELETE /api/receipts/:id`
- `GET, PUT /api/settings`
- `POST /api/reset`

## 12. Success measures for prototype evaluation

- A user can add, edit, filter and delete a transaction without assistance.
- Dashboard values update after a transaction change.
- Budget progress reflects the category's recorded expenses.
- A receipt image can be uploaded, previewed and deleted.
- A savings contribution updates goal progress.
- CSV export opens as a valid spreadsheet.
- Layout remains usable on a narrow mobile screen.
- Forecast calculation is explainable and clearly caveated.

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Demo data mistaken for real financial data | Mark sample data and estimates clearly |
| Local JSON file is not multi-user safe | Document PostgreSQL migration before deployment |
| Receipt images may contain private data | Local-only prototype; file validation and size limit |
| Forecast is inaccurate with sparse history | Show data coverage and transparent method |
| Browser/server storage may be lost | Add backup/export guidance; production backup plan |

## 14. Future roadmap

**Phase 2 — Persistence and security**
- PostgreSQL with migrations.
- User registration/login, hashed passwords and session security.
- Per-user data isolation and authorization.
- Secure receipt storage.

**Phase 3 — Intelligence**
- OCR for receipt fields with user confirmation.
- Recurring transaction detection.
- Time-series expense forecasting evaluated against a baseline.
- Explainable anomaly detection.

**Phase 4 — Product quality**
- Automated tests and CI.
- Accessibility audit.
- Deployment, monitoring, backups and privacy policy.
- Optional PWA/offline support.

## 15. Out of scope and explicit payment restriction

Pennywise must not include payment buttons, payment gateway SDKs, bank/card collection, money transfers, checkout flows or payment initiation. Users manually log transactions that have already occurred elsewhere.
