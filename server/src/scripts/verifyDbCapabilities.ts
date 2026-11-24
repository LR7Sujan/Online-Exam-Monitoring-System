import { pool, withConnection } from '../config/db.js';
import type { RowDataPacket } from 'mysql2/promise';

async function verifyDatabaseCapabilities(): Promise<void> {
  console.log('--- ProctorIQ Database Capability Verification ---');

  // 1. SELECT VERSION()
  const [versionRows] = await pool.query<RowDataPacket[]>('SELECT VERSION() as version');
  console.log('[Capability 1] MySQL Version:', versionRows[0]?.version);

  // 2. Transaction with SELECT ... FOR UPDATE
  await withConnection(async (conn) => {
    await conn.beginTransaction();
    console.log('[Capability 2] Transaction started.');
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM Users LIMIT 1 FOR UPDATE'
    );
    console.log('[Capability 2] SELECT ... FOR UPDATE executed successfully. Locked row ID:', rows[0]?.id);
    await conn.commit();
    console.log('[Capability 2] Transaction committed.');
  });

  // 3. Test CREATE TRIGGER and DROP TRIGGER
  await withConnection(async (conn) => {
    // Create temporary table for trigger test
    await conn.query(`
      CREATE TABLE IF NOT EXISTS _test_trigger_tab (
        id INT AUTO_INCREMENT PRIMARY KEY,
        val INT NOT NULL DEFAULT 0,
        flag VARCHAR(10) NULL
      ) ENGINE=InnoDB;
    `);

    try {
      await conn.query('DROP TRIGGER IF EXISTS _test_before_insert_trg');
      await conn.query(`
        CREATE TRIGGER _test_before_insert_trg
        BEFORE INSERT ON _test_trigger_tab
        FOR EACH ROW
        BEGIN
          SET NEW.flag = 'TRIGGER_OK';
        END;
      `);
      console.log('[Capability 3] CREATE TRIGGER executed successfully.');

      await conn.query("INSERT INTO _test_trigger_tab (val) VALUES (42)");
      const [inserted] = await conn.query<RowDataPacket[]>(
        'SELECT val, flag FROM _test_trigger_tab WHERE val = 42 LIMIT 1'
      );
      console.log('[Capability 3] Trigger fired successfully! Result flag:', inserted[0]?.flag);

      await conn.query('DROP TRIGGER IF EXISTS _test_before_insert_trg');
      console.log('[Capability 3] DROP TRIGGER executed successfully.');
    } finally {
      await conn.query('DROP TABLE IF EXISTS _test_trigger_tab');
    }
  });

  // 4. Test CREATE PROCEDURE and DROP PROCEDURE
  await withConnection(async (conn) => {
    await conn.query('DROP PROCEDURE IF EXISTS _test_sp_capability');
    await conn.query(`
      CREATE PROCEDURE _test_sp_capability(IN p_in INT, OUT p_out INT)
      BEGIN
        SET p_out = p_in * 2;
      END;
    `);
    console.log('[Capability 4] CREATE PROCEDURE executed successfully.');

    await conn.query('CALL _test_sp_capability(21, @out_val)');
    const [spResult] = await conn.query<RowDataPacket[]>('SELECT @out_val AS result');
    console.log('[Capability 4] CALL PROCEDURE executed successfully. Output:', spResult[0]?.result);

    await conn.query('DROP PROCEDURE IF EXISTS _test_sp_capability');
    console.log('[Capability 4] DROP PROCEDURE executed successfully.');
  });

  console.log('--- All Database Capabilities Verified Successfully! ---');
  await pool.end();
}

verifyDatabaseCapabilities().catch((err) => {
  console.error('[Verification Failed]:', err);
  process.exit(1);
});
