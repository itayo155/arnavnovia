# ArnavNovia Application Tasks

## Overview
This document outlines the remaining tasks for the ArnavNovia token transfer application, ordered by priority and complexity.

## Completed Tasks
- ✅ **Auto-refresh**: Implemented polling on the frontend to automatically update token balance every 5 seconds

## Remaining Tasks

### 1. Login with Username (Medium-Low Complexity)
**Context**: Currently, the application requires email login, which is cumbersome. We want to allow users to log in with their username instead, while still maintaining the email for password reset functionality.

**Plan**:
- Review and enhance the existing `getEmailByUsername` function in `authController.ts`
- Ensure the login flow properly handles username login
- Update the frontend UI to make it clear that users can log in with a username
- Add improved error handling and validation for both username and email login methods
- Test the login flow with various scenarios

**Files to modify**:
- `backend/src/controllers/authController.ts`
- `arnavnovia-front/HTML/index.html`
- `arnavnovia-front/HTML/js/api.js`

### 2. Events Area (Medium Complexity)
**Context**: We need to display a transaction history so users can see recent token transfers. The Supabase database already has a "transactions" table, but we're not currently writing to it.

**Plan**:
- Modify the `transferTokens` function in `userModel.ts` to record transactions
- Create a new endpoint in `tokenController.ts` to fetch transaction history
- Add the corresponding route in `tokenRoutes.ts`
- Create a new UI component in `dashboard.html` to display the transaction history
- Add the client-side JavaScript to fetch and display transactions
- Include the transaction history in the auto-refresh polling

**Files to modify**:
- `backend/src/models/userModel.ts`
- `backend/src/controllers/tokenController.ts`
- `backend/src/routes/tokenRoutes.ts`
- `arnavnovia-front/HTML/dashboard.html`
- `arnavnovia-front/HTML/js/api.js`

**Database considerations**:
- Ensure the transactions table has the following fields:
  - id
  - sender_id
  - receiver_id
  - amount
  - created_at

### 3. Make the HTML Pages Nicer (Medium Complexity)
**Context**: The current UI is functional but can be improved for better user experience.

**Plan**:
- Improve the overall color scheme and typography
- Make the design more responsive for different screen sizes
- Add transitions and subtle animations
- Improve form layouts and navigation
- Enhance the transaction history display with visual indicators for incoming/outgoing transfers
- Add better validation and feedback for user actions

**Files to modify**:
- `arnavnovia-front/HTML/index.html`
- `arnavnovia-front/HTML/dashboard.html`
- `arnavnovia-front/HTML/reset-password.html`
- Consider creating a separate CSS file instead of using inline styles

### 4. Management Page (High Complexity)
**Context**: We need an admin panel that allows administrators to manage users and tokens.

**Plan**:
1. **Backend work**:
   - Add an `is_admin` field to the users table
   - Create an admin middleware to protect admin-only routes
   - Create admin controllers for:
     - User management (list, add, update, remove users)
     - Token management (view, add, remove tokens for users)
   - Add admin routes to the API

2. **Frontend work**:
   - Create a new admin.html page with sections for:
     - User management
     - Token management
     - System settings
   - Implement client-side JavaScript for admin operations
   - Add proper authentication and route protection for admin pages

3. **Security considerations**:
   - Ensure proper access control for admin routes
   - Add confirmation dialogs for destructive actions
   - Add audit logging for administrative actions
   - Implement rate limiting for sensitive operations

**Files to create/modify**:
- `backend/src/middleware/adminMiddleware.ts`
- `backend/src/controllers/adminController.ts`
- `backend/src/routes/adminRoutes.ts`
- `arnavnovia-front/HTML/admin.html`
- `arnavnovia-front/HTML/js/admin.js`

## Note on Approach
For each task, the recommended approach is to:
1. Implement the backend functionality first
2. Test the API endpoints with a tool like Postman
3. Implement the frontend functionality
4. Test the complete feature end-to-end

Document any database schema changes or environment variables required for each feature.
