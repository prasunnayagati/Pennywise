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

## Deploy on Render

Create a Node Web Service from the repository root with:

- Build command: `npm install && npm run build`
- Start command: `npm start`

The build installs the client and server dependencies, builds the frontend, and the server serves the frontend and API from the same origin. To persist JSON records and receipt images across deployments, attach a persistent disk at `/var/data` and set `DATA_DIR=/var/data`. Without a persistent disk, files written on the service may be lost when its instance is replaced. The app has no authentication; do not enter sensitive financial information on a public deployment.

## Data and persistence

The server creates `server/data/db.json` on first run with empty collections. Transactions, budgets, goals, subscriptions, receipts metadata and settings are saved there as JSON. Receipt image files are stored in `server/uploads/`. Use **Settings → Clear all data** to remove the saved records and receipt images.

## Important prototype limitations

- This is a local development prototype, not a production banking product.
- There are no payment rails, bank connections, card details or payment initiation features.
- Authentication and multi-user account isolation are not implemented.
- The forecast is a transparent weighted-average baseline, not a trained machine-learning model.
- JSON-file storage is suitable for a single-user demo only. Use PostgreSQL, migrations, authentication, authorization, backups and secure object storage before deployment.
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
