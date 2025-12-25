# HRMS Integration Architectural Solution

This document outlines a production-ready strategy to integrate real-time HRMS data into the TravelExpensePro system while minimizing data redundancy and maintaining high performance.

## 1. Core Philosophy: JIT & Progressive Sync

Instead of replicating the entire HRMS database, we implement a **Hybrid Synchronization** model:

- **JIT (Just-In-Time) Sync**: Fetch specific employee details only when they interact with the system (e.g., during SSO login or when a manager views a subordinate).
- **Bulk Sync (Daily)**: Perform a light bulk sync daily to update global attributes (like status or grade changes) and deactivate exit-dated users.

---

## 2. User & Profile Mapping Strategy

| HRMS Field       | Mapping to TravelExpensePro              | Logic                                                  |
| :--------------- | :--------------------------------------- | :----------------------------------------------------- |
| `Employee_ID`    | `OrganizationalProfile.external_hrms_id` | Stored as a secondary reference.                       |
| `Alpha_Emp_Code` | `OrganizationalProfile.employee_id`      | Used as the primary business key (e.g., "00019").      |
| `Work_Email`     | `User.username`                          | Primary login identity.                                |
| `Name`           | `User.first_name` & `last_name`          | Split based on first space.                            |
| `Gender`         | `User.gender`                            | Map "Male" -> "M", "Female" -> "F".                    |
| `Emp_Status`     | `User.is_active`                         | "Inactive" users are disabled immediately during sync. |

---

## 3. Master Data "Self-Healing" Normalization

To avoid manual entry of Departments, Designations, and Grades, the system will use a **lookup-or-create** pattern:

1.  **Incoming Data**: API returns `"Department": "Accounts"`.
2.  **Resolution**: The system checks `DepartmentMaster` for `dept_name="Accounts"`.
3.  **Action**:
    - If found, link the ID.
    - If NOT found, **automatically create** the new Department record.
4.  **Entitlements**: Once a new Grade is auto-created, the Admin receives a notification to configure travel entitlements (policy) for that new Grade.

---

## 4. Operational Workflows

### Phase A: SSO Login (JIT Sync)

When a user hits the SSO link:

1.  **Decrypt**: Get `Employee_ID` from the token.
2.  **Fetch Details**: Immediately call `GET /api/Employee/GetAllEmployees/<id>?cmpId=2`.
3.  **Update Profile**: Refresh the user's Department, Designation, Grade, and Mobile No from the fresh response.
4.  **Issue JWT**: Proceed with login. This ensures the user _always_ logs in with their current HRMS state.

### Phase B: Leave Integration

Leave balance is highly volatile and should **not** be stored locally.

1.  **Request Flow**: When a user selects "Apply Travel", the frontend/backend calls `GET /api/Employee/GetEmployeeLeaves`.
2.  **Validation**: The system checks if the user has enough balance or if the period overlaps with existing leaves.
3.  **Persistence**: Only the _applied_ leave reference is saved in our system to track the specific travel request.

### Phase C: Approval Hierarchy

1.  **Manager Resolution**: HRMS provides `Reporting_Manager_Name`.
2.  **Lookup**: Our system searches for a User with that name or `Alpha_Emp_Code` (if provided).
3.  **Fall back**: If the manager is not in our system yet, we create a "Shadow User" for the manager (inactive login but active for email approvals) until they log in via SSO.

---

## 5. Implementation Benefits

- **Zero Redundancy**: We don't store addresses, DOB, or other HR-centric data not needed for travel.
- **Always Accurate**: Grade changes or Department transfers sync automatically on login.
- **Security**: "Inactive" employees (Exit date reached) are locked out during the daily bulk sync.
- **Low Maintenance**: Master data (Departments/Grades) manages itself as the organization grows.

## 6. Next Steps for Implementation

1.  **Shadow Models**: Add `external_id` (int) and `alpha_code` (str) to `OrganizationalProfile`.
2.  **Integration Service**: Create a backend service layer specifically for calling HRMS APIs with proper error handling and timeouts.
3.  **Sync Tasks**: Schedule the daily Celery worker for bulk status checks.
