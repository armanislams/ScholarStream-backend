# ScholarStream - Backend Server

ScholarStream Backend is the server-side application powering the ScholarStream platform. It handles user authentication, scholarship management, application processing, payments, and analytics.


## 🌟 Purpose
The backend serves as the centralized logic hub for ScholarStream, ensuring secure data handling and efficient communication between the database and the client application. It manages:
- **Data Persistence**: Storing users, scholarships, reviews, and applications.
- **Security**: Verifying user identities and roles.
- **Transactions**: Processing application fee payments.

## ✨ Key Features

### 🔐 Authentication & Security
- **JWT Verification**: Secures endpoints using Firebase Admin SDK.
- **Role-Based Access Control (RBAC)**: Distinct permissions for Students, Moderators, and Admins.

### 📚 Scholarship Management
- **CRUD Operations**: Create, read, update, and delete scholarship listings.
- **Advanced Search & Filtering**: text search, category filtering, and sorting.

### 📝 Application System
- **Submission Handling**: Processes student applications.
- **Status Tracking**: Updates application statuses (pending, processing, completed, rejected).

### 💳 Payments
- **Stripe Integration**: Secure checkout sessions for application fees.
- **Payment Verification**: Webhooks/Endpoints to confirm successful transactions.

### 📊 Analytics
- **Admin Dashboard**: Aggregated stats on users, funds, and applications.
- **Moderator Views**: monitoring application flows.

## 🛠️ Technology Stack

### Core Runtime
- **[Node.js](https://nodejs.org/)**: JavaScript runtime environment.
- **[Express.js](https://expressjs.com/)**: Fast, unopinionated web framework for Node.js.

### Database
- **[MongoDB](https://www.mongodb.com/)**: NoSQL database for flexible data storage (using Native Driver).

### Services & Tools
- **[Firebase Admin](https://firebase.google.com/docs/admin/setup)**: Server-side authentication and management.
- **[Stripe](https://stripe.com/docs/api)**: Payment processing API.
- **[Dotenv](https://www.npmjs.com/package/dotenv)**: Environment variable management.
- **[Cors](https://www.npmjs.com/package/cors)**: Cross-Origin Resource Sharing.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- MongoDB Connection String
- Firebase Service Account Key (JSON)
- Stripe Secret Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/armanislams/ScholarStream-backend.git
   cd scholar-stream-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env` file in the root directory and add the following keys:
   ```env
   PORT=5000
   MONGO_DB_USER=your_mongo_user
   MONGO_DB_PASS=your_mongo_password
   MONGO_DB_URI=your_cluster_address
   STRIPE_SECRET=your_stripe_secret_key
   FIREBASE_KEY=your_base64_encoded_service_account
   SITE_URL=http://localhost:5173 (Client URL for redirects)
   ```

   > **Note:** The `FIREBASE_KEY` should be a base64 encoded string of your service account JSON file.

4. **Run the server:**
   ```bash
   # Development (with nodemon)
   npm start
   ```

   The server will start on `http://localhost:5000` (or your defined PORT).

## 📄 API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/jwt` | Generate JWT token |
| `GET` | `/users` | Get all users (Admin) |
| `GET` | `/scholarships` | Get all scholarships with filters |
| `POST` | `/scholarship-payment-checkout` | Create Stripe payment session |
| `GET` | `/analytics/admin-stats` | Get admin dashboard stats |
