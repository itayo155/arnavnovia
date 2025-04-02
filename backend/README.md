# Token Transfer Backend

This is the backend for the Token Transfer application. It provides APIs for user authentication and token transfers between users.

## Technologies Used

- Node.js
- Express
- TypeScript
- JSON Web Tokens (JWT) for authentication

## Project Structure

```
backend/
├── src/
│   ├── config/      # Configuration files
│   ├── controllers/ # Route controllers
│   ├── middleware/  # Custom middleware
│   ├── models/      # Data models
│   ├── routes/      # API routes
│   ├── utils/       # Utility functions
│   └── index.ts     # Application entry point
├── .env             # Environment variables
├── package.json     # Project dependencies
├── tsconfig.json    # TypeScript configuration
└── README.md        # Project documentation
```

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Installation

1. Install dependencies:
   ```
   npm install
   ```

2. Configure environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   NODE_ENV=development
   JWT_SECRET=your_jwt_secret_here
   JWT_EXPIRES_IN=1d
   ```

### Development

To run the application in development mode:
```
npm run dev
```

### Production Build

To build the application for production:
```
npm run build
```

To start the production server:
```
npm start
```

## API Endpoints

The backend will support the following endpoints (to be implemented):

- **Authentication**
  - POST /api/auth/register
  - POST /api/auth/login

- **Users**
  - GET /api/users
  - GET /api/users/:id

- **Tokens**
  - GET /api/tokens
  - POST /api/tokens/transfer 
