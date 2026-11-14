-- ============================================================================
-- Test Suite 01: Schema Verification
-- Tests that all 8 tables, Foreign Keys, UNIQUE keys, CHECK constraints, and indexes exist.
-- ============================================================================

-- 1. Verify 8 Primary Domain Tables
SELECT table_name, engine, table_rows
  FROM information_schema.tables
 WHERE table_schema = 'proctoriq'
   AND table_type = 'BASE TABLE'
 ORDER BY table_name;

-- 2. Verify Foreign Keys
SELECT constraint_name, table_name, column_name, referenced_table_name, referenced_column_name
  FROM information_schema.key_column_usage
 WHERE table_schema = 'proctoriq'
   AND referenced_table_name IS NOT NULL
 ORDER BY table_name, constraint_name;

-- 3. Verify Unique Constraints
SELECT constraint_name, table_name, column_name
  FROM information_schema.key_column_usage
 WHERE table_schema = 'proctoriq'
   AND constraint_name LIKE 'uq_%'
 ORDER BY table_name, constraint_name;

-- 4. Verify Check Constraints
SELECT constraint_name, check_clause
  FROM information_schema.check_constraints
 WHERE constraint_schema = 'proctoriq'
 ORDER BY constraint_name;

-- 5. Verify Performance and Security Indexes
SELECT table_name, index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS indexed_columns, non_unique
  FROM information_schema.statistics
 WHERE table_schema = 'proctoriq'
   AND index_name NOT IN ('PRIMARY')
 GROUP BY table_name, index_name, non_unique
 ORDER BY table_name, index_name;

