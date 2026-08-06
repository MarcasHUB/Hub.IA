# Architecture Debt

## 1. Multiple Organizations for Operators
- **Issue**: The `operators` table uses `id` as its Primary Key, which maps 1:1 to `auth.users.id`. This enforces a hard limit where a single user (email) can only have ONE operator record in the entire system, preventing true multi-tenancy at the operational level.
- **Current Workaround**: The system uses `user_roles` to allow users to access multiple organizations, but this bypasses the `operators` table, leading to issues with role-specific logic, permissions, and operator associations (like `gestor_id`) which are tied to a single organization.
- **Future Fix**: 
  - Change the Primary Key of `operators` to a unique UUID (e.g., `id` = UUID v4).
  - Add a `user_id` column to `operators` referencing `auth.users.id`.
  - Create a unique constraint on `(user_id, organization_id)`.
  - Update all frontend and backend queries to look up operators by `user_id` AND `organization_id`.
  - Migrate existing data.
