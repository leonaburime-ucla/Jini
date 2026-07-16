# Secure Search Query Builder

Build a search query builder for a document management system in Python.

## Requirements

1. Accept search parameters: query text, filters (status, author, dateRange, tags), pagination (page, pageSize), sort (field, direction).
2. Build a parameterized SQL query for a PostgreSQL `documents` table.
3. All user-provided values must be parameterized — never string-interpolated into SQL.
4. Validate: pageSize max 100, page >= 1, sort field must be from allowed list (title, created_at, updated_at, author), direction must be ASC or DESC.
5. Filter combinations: all filters are optional, multiple tags use IN clause, dateRange uses BETWEEN.
6. Return: { sql: string, params: any[], totalCountSql: string, totalCountParams: any[] }.
7. Log search operations with: query length, filter count, page, pageSize. Never log the actual query text or filter values (could contain PII).

## Constraints

- Pure Python
- Must include tests
- Must prevent SQL injection in all paths
