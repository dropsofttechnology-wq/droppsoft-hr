# Droppsoft HR - Payroll & Attendance Management System

A comprehensive HR and Payroll Management System with Face Recognition, built with React and Appwrite.

## Features

- **Multi-Company Support**: Manage multiple companies with isolated data
- **Face Recognition Attendance**: Real-time 1:N face matching for clock-in/out
- **QR Code Authentication**: Quick QR code scanning for attendance
- **Automated Payroll**: Complete payroll calculations with Kenyan statutory compliance
- **Statutory Reports**: P10, P9, NSSF, SHIF, AHL reports
- **Employee Self-Service**: Payslips, attendance records, face enrollment

## Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Appwrite (Backend-as-a-Service)
- **Face Recognition**: face-api.js
- **QR Code**: html5-qrcode
- **Routing**: React Router

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Appwrite

1. Create an Appwrite project at https://cloud.appwrite.io
2. Copy your Appwrite credentials
3. Create `.env` file:

```env
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your-project-id
VITE_APPWRITE_DATABASE_ID=your-database-id
```

### 3. Set Up Appwrite Database

Run the setup script to create all required collections:

```bash
npm run setup:appwrite
```

Or manually create collections using the schema in `docs/appwrite-schema.md`

### 4. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Project Structure

```
droppsoft-hr/
├── src/
│   ├── components/       # React components
│   ├── pages/            # Page components
│   ├── services/         # Appwrite services
│   ├── utils/            # Utility functions
│   ├── hooks/            # Custom React hooks
│   ├── store/            # State management
│   └── styles/           # CSS/styles
├── public/               # Static assets
├── docs/                 # Documentation
└── appwrite/             # Appwrite configuration
```

## Documentation

- [Application Specification](./docs/APPLICATION_SPECIFICATION.md)
- [Appwrite Schema](./docs/appwrite-schema.md)
- [API Documentation](./docs/api.md)

## License

Proprietary - Droppsoft Technologies Ltd
