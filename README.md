# Pennywise

**Making every penny count**

A full-stack personal finance management application built with **React, Node.js, Express and Tailwind CSS**.

## Features

- Overview dashboard with balance, income, expenses and savings rate
- Transaction CRUD with search and filters
- Monthly and category budgets with progress tracking
- Savings goals and contributions
- Recurring expense / subscription tracker
- Bill and receipt image uploads (no payment processing)
- Analytics and transparent expense forecast
- CSV export
- Persistent JSON-file storage for local development
- Single-owner email/password authentication across devices, with email and password changes
- Responsive plum interface using `#A47DAB` and darker complementary shades, with a mustard wordmark and logo

## Requirements

- Node.js 18.18+ (Node 20 LTS recommended)
- npm

## Run locally

From the project root:

```bash
npm install
npm --prefix server install
npm --prefix client install
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`).
The API runs on `http://localhost:5000`.
On the first run, enter the one-time setup token printed by the server in the app, then create your email and password. Sign in with those same credentials on any device using the hosted app. Optionally set `AUTH_SETUP_TOKEN` to a private value of at least 32 characters before starting; otherwise the server generates a token. If the server restarts before setup is complete, use the latest token printed in its logs. The server stores the email, a salted password hash, and a session-signing key in `auth.json`, never the plaintext password.

## Deploy on Render

Create a Node Web Service from the repository root with:

- Build command: `npm install && npm run build`
- Start command: `npm start`

The build installs the client and server dependencies, builds the frontend, and the server serves the frontend and API from the same origin. On first start, the server prints a one-time setup token to the Render logs; enter the latest token on the app's account setup screen and choose an email and a password of at least 12 characters. Treat the token as a secret. Alternatively, set a private `AUTH_SETUP_TOKEN` (at least 32 characters) in Render before deployment and enter that value on the setup screen. Setup is disabled once the account has been created. Remove `AUTH_SETUP_TOKEN` from the service environment afterward if you set it. `AUTH_USERNAME` and `AUTH_PASSWORD` are no longer used by this setup flow and may be removed.

To retain the existing records, uploaded receipts, and authentication data across deployments, attach a persistent disk at `/var/data` and set `DATA_DIR=/var/data`. Without persistent storage, files written on the service may be lost when its instance is replaced.
If the service already stores records in a different directory, copy its `db.json` and `uploads` into the persistent disk before changing `DATA_DIR`; pointing at a new empty directory will make the old records appear missing.

## Data and persistence

The server creates `server/data/db.json` on first run with empty collections. Transactions, budgets, goals, subscriptions, receipts metadata and settings are saved there as JSON. Authentication credentials (salted password hash and session-signing key) are kept separately in `server/data/auth.json`. Receipt image files are stored in `server/uploads/`. Use **Settings → Clear all data** to remove the saved records and receipt images; this does not remove authentication.

## Important prototype limitations

- This is not a production banking product.
- There are no payment rails, bank connections, card details or payment initiation features.
- Authentication is for one owner account; there is no public registration, account recovery, or multi-user account isolation.
- The email address is not verified, and password recovery email is not configured.
- Use HTTPS in deployment, keep the data disk private, and maintain backups. Authentication does not encrypt the JSON data or receipt files at rest.
- The forecast is a transparent weighted-average baseline, not a trained machine-learning model.
- JSON-file storage is suitable for a single-user app only. Use a database, backups, and secure object storage for larger deployments.
- Uploaded receipts are stored locally. Do not upload sensitive documents to a publicly hosted instance.

## Project structure

```text
pennywise/
├── client/                 # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── ...
├── server/                 # Express REST API
│   ├── data/
│   ├── uploads/
│   └── src/
│       ├── routes/
│       ├── store.js
│       └── index.js
├── PRD.md
└── README.md
```

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | API health |
| GET | `/api/auth/session` | Check whether the browser has a valid session |
| POST | `/api/auth/setup` | Create the first owner account with a one-time setup token |
| POST | `/api/auth/login` | Sign in with the owner email and password |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/auth/change-email` | Change the owner email while signed in |
| POST | `/api/auth/change-password` | Change the owner password while signed in |
| GET/POST | `/api/transactions` | List/create transactions |
| PUT/DELETE | `/api/transactions/:id` | Update/delete transaction |
| GET/POST | `/api/budgets` | List/create budgets |
| PUT/DELETE | `/api/budgets/:id` | Update/delete budget |
| GET/POST | `/api/goals` | List/create savings goals |
| POST | `/api/goals/:id/contributions` | Add a contribution |
| DELETE | `/api/goals/:id` | Delete a goal |
| GET/POST | `/api/subscriptions` | List/create recurring expenses |
| DELETE | `/api/subscriptions/:id` | Delete recurring expense |
| GET | `/api/analytics/summary` | Dashboard summary |
| GET | `/api/analytics/forecast` | Expense forecast |
| GET | `/api/receipts` | List receipt metadata |
| POST | `/api/receipts` | Upload receipt image |
| DELETE | `/api/receipts/:id` | Delete receipt |

No endpoint initiates, accepts or processes payments.
