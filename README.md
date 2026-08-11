# Supervision App

A comprehensive Next.js web application designed to manage supervisory workflows. It features a robust role-based access control system catering to three distinct user types: **Admin**, **Supervisor**, and **Supervisee**. 

This application facilitates the tracking of applications, supervision processes, and communication, utilizing modern web technologies for a seamless experience.

## ✨ Key Features

- **Role-Based Access Control (RBAC):** Tailored dashboards and permissions for Admins, Supervisors, and Supervisees.
- **Application Tracking:** Supervisees can submit and track applications, while supervisors/admins can review them.
- **Email Notifications & OTP:** Integrated SMTP module to send OTP verification emails and notifications. Designed to work with a local SMTP webhook for local development.
- **Modern Tech Stack:** 
  - **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
  - **Database & ORM:** SQLite with [TypeORM](https://typeorm.io/)
  - **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
  - **Authentication:** Custom JWT-based auth with `jose` and `bcryptjs`.
  - **Email:** `nodemailer` with YAML-based email templates.

## 🚀 Getting Started

Follow these instructions to set up the project locally for development and testing.

### 1. Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v20+ recommended)
- `npm` (comes with Node.js)

### 2. Installation

Clone the repository and install the dependencies:

```bash
npm install
```

### 3. Environment Variables

Create a `.env.local` file in the root directory. You can copy the variables below. This connects the app to your local environment and local SMTP server.

```env
# App Base URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# SMTP Email Configuration (Local Webhook Server)
SMTP_HOST=127.0.0.1
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=dev
SMTP_PASS=dev
SMTP_FROM_NAME="Supervision Portal"
SMTP_FROM_EMAIL=noreply@example.com
```

### 4. Setup SMTP Server (For Email Testing)
Connect to a SMTP Server for Email sending

### 5. Database Setup

The app uses SQLite, meaning no complex database installation is required. To initialize the database structure and populate it with initial seed data (like default roles or admin accounts), run:

```bash
npm run seed
```

### 6. Run the Development Server

Start the application in development mode:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. The page will auto-update as you edit the source files.

## 🛠️ Project Structure

- `app/`: Next.js App Router pages (routes, UI layouts, API endpoints).
- `lib/`: Core logic, database setup (`db/`), and email utilities (`email/`).
- `scripts/`: Development scripts (e.g., database seeding).
- `.env.local`: Local environment variables.

## 📄 Scripts

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Builds the application for production.
- `npm run start`: Starts the production server.
- `npm run lint`: Runs ESLint for code linting.
- `npm run seed`: Executes the database seeder script.
