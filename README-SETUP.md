# MOIJEY AI Co-Pilot - Setup Guide

Follow these steps to initialize and run the MOIJEY Sales Rep AI Co-Pilot locally or on your preferred cloud host.

## 1. Prerequisites
- **Postgres** (Supabase or Neon recommended)
- **Node.js 18+**
- **OpenAI API Key**

## 2. Environment Setup
Copy the `.env.example` to `.env` and fill in your credentials:

```bash
DATABASE_URL="your-supabase-connection-string"
NEXTAUTH_SECRET="random-secure-string"
OPEN_AI_API_KEY="sk-..."
```

## 3. Database Initialization
Run the initialization script against your database:
1. Open your Supabase/Neon SQL Editor.
2. Copy the contents of `src/lib/db/init.sql`.
3. Execute the SQL to create the tables and enable `pgvector`.

## 4. Install Dependencies
```bash
npm install
```

## 5. Seed Data
Initialize the workspace, roles, and create a default admin user:
```bash
node scripts/seed.js
```
**Default Credentials:**
- **Email:** `admin@moijey.com`
- **Password:** `moijey-admin-2026`

## 6. Run the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## 7. Workflow Instructions

### Admin (Knowledge Mgmt)
1. Log in at `/login` with the admin credentials.
2. Navigate to **Knowledge Base** to upload PDF/Word files.
3. Navigate to **Business Facts** to add core policies (e.g., warranty).

### Sales Rep (Asking Questions)
1. Go to the **Chat** interface.
2. Ask questions about the uploaded documents or business facts.
3. Toggle between **Short** and **Detailed** answers.
4. View verified citations for every response.
