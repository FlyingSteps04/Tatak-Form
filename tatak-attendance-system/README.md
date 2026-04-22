# Tatak Attendance System

A Node.js + Express-based attendance management system with event scheduling, geocoding, audit logging, and user notifications.

## Features
- 🔐 **Authentication & Roles**: Secure routes with JWT and role-based access (`Admin`, `Officer`, `Student`).
- 📅 **Event Management**: Create, update, and manage events with location geocoding via OpenStreetMap Nominatim.
- 📝 **Audit Logs**: Track administrative actions (e.g., adding/updating events).
- 🔔 **Notifications**: Automatically notify users of new events, attendance logs, and system actions.
- 🎓 **Attendance Tracking**: Students can log attendance; admins/officers can monitor.

## Tech Stack
- **Backend**: Node.js, Express
- **Database**: MySQL
- **Geocoding**: OpenStreetMap Nominatim API
- **Authentication**: JWT

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/juanfelepe19/tatak-attendance-system.git
   cd tatak-attendance-system

2. Install dependencies:

    ```bash
    npm install

3. Configure environment variables:
    Create a .env file in the root directory with the following values:

    Code
    # Server configuration
    PORT=3000

    # Database connection
    SAS_Host=localhost
    SAS_User=root
    SAS_Password=yourpassword
    SAS_Database=testqua

    # Authentication
    SECRET_KEY=your_jwt_secret

    # Email / Notifications
    EMAIL_USER=your-email@example.com
    SG_API_KEY=your-sendgrid-api-key

4. Set up the database:

    Create a new MySQL database named attendance_db.

    Run the schema file to initialize tables:

    ```bash
    mysql -u root -p testqua < schema.sql

5. Start the server:

    ```bash
    npm start