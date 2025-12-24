# HRMS SSO Integration Technical Report

## 1. Overview

This report documents the architectural design and implementation of the Single Sign-On (SSO) integration between the external Human Resource Management System (HRMS) and the Travel Management application. The primary objective was to facilitate seamless user authentication while maintaining full compatibility with the existing frontend application and backend security protocols.

## 2. Backend Implementation (`sso_auth` app)

### 2.1 Core Components

A dedicated Django application `apps.sso_auth` was created to encapsulate SSO-specific logic, ensuring zero impact on the existing `apps.authentication` core.

- **AES Decryption Utility (`utils.py`):** Implemented AES-256-CBC decryption using `pycryptodome`. It handles Base64 decoding (including URL-safe character substitution) and PKCS7 unpadding for incoming HRMS tokens.
- **Token Validation (`validators.py`):** Implements a robust parsing engine for the HRMS parameter string format (`P1:ID$P2:UserName$P3:CmpID$P4:EmpID$P5:Flag`). It enforces mandatory field validation and authentication flag checks.
- **SSO Login View (`views.py`):** The central controller that orchestrates decryption, validation, and session creation.
  - **Admin Handling:** Automatically creates or retrieves Admin users (`emp_id: '0'`) in the database.
  - **JWT Generation:** Leverages `rest_framework_simplejwt` to issue identical access and refresh tokens used by the standard login flow.
  - **API Compatibility:** The response payload mirrors the existing `/api/auth/login/` endpoint precisely, including profile data, roles, and permissions, ensuring the frontend requires no logic changes for data consumption.

### 2.2 Configuration

- Registered `apps.sso_auth` in `settings.py`.
- Exposed `/sso/login/` endpoint via the main `urls.py`.
- Integrated `SSO_AES_KEY` and `SSO_AES_IV` as environment-controlled variables.

## 3. Frontend Integration

### 3.1 SSO Interceptor Component (`SSOHandler.tsx`)

A new React component `SSOHandler` was implemented and placed inside the `BrowserRouter` to serve as a high-level interceptor.

- **Parameter Detection:** Actively monitors the URL for the `?auth=` query parameter.
- **Backend Synchronization:** Handles the asynchronous API call to the backend SSO endpoint.
- **Persistence:** Directly updates `localStorage` with tokens, user metadata, and permissions.

### 3.2 Key Technical Fixes & Optimizations

The implementation addressed several critical integration hurdles:

- **Zustand Auth Store Sync:** Resolved a race condition where the `ProtectedRoute` would redirect users back to login because the global Zustand state (`isAuthenticated`) was out of sync with `localStorage`. Implemented an explicit `initializeAuth()` call post-login to synchronize states.
- **Navigation Consistency:** Fixed a redirect logic issue where the page would stay on the login screen. Shifted to `window.location.href` for the initial SSO redirect to ensure a clean state initialization.
- **Role-Based Redirection:** Implemented automated routing to specific dashboards (Admin, Travel Desk, Booking Agent, Employee) based on the `is_primary` role returned by the SSO response.

## 4. Verification & Status

- **Decryption:** Validated against provided HRMS samples.
- **Session Management:** Confirmed that JWT tokens issued via SSO are fully compatible with existing restricted APIs (e.g., `/api/auth/profile/`).
- **User Persistence:** Verified that SSO users are correctly persisted in the `User` model with appropriate roles.

## 5. Future Scope (Proposed)

- **Employee Virtual Sessions:** Implementation of in-memory sessions for non-admin employees to avoid database bloat.
- **Master Data Sync:** Automation of Company/Department/Designation synchronization via background tasks.
- **HRMS Logout Integration:** Configuration of unified log-out redirection back to the HRMS portal.

---

**Status:** Base Integration Complete & Verified.
