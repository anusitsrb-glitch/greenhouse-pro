/**
 * Database Backup Script
 * Run manually or via cron job
 * 
 * Usage: npx tsx src/scripts/backup.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.resolve(__dirname, '../../../backups');
const MAX_BACKUPS = 10; // Keep last 10 backups

async function runBackup() {
  console.log('🔄 Starting database backup...');
  
  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
  }
  
  // Check if database file exists
  const dbPath = path.resolve(env.DB_PATH);
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database file not found: ${dbPath}`);
    process.exit(1);
  }
  
  // Generate backup filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `greenhouse-backup-${timestamp}.db`;
  const backupPath = path.join(BACKUP_DIR, backupFilename);
  
  try {
    // Copy database file
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Backup created: ${backupFilename}`);
    
    // Also copy WAL file if exists
    const walPath = `${dbPath}-wal`;
    if (fs.existsSync(walPath)) {
      fs.copyFileSync(walPath, `${backupPath}-wal`);
      console.log(`✅ WAL file backed up`);
    }
    
    // Cleanup old backups
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('greenhouse-backup-') && f.endsWith('.db'))
      .sort()
      .reverse();
    
    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      for (const filename of toDelete) {
        const filePath = path.join(BACKUP_DIR, filename);
        fs.unlinkSync(filePath);
        
        // Also delete associated WAL file
        const walFilePath = `${filePath}-wal`;
        if (fs.existsSync(walFilePath)) {
          fs.unlinkSync(walFilePath);
        }
        
        console.log(`🗑️  Deleted old backup: ${filename}`);
      }
    }
    
    console.log('');
    console.log('════════════════════════════════════════════════════════');
    console.log('✅ BACKUP COMPLETED');
    console.log('════════════════════════════════════════════════════════');
    console.log(`   Location: ${backupPath}`);
    console.log(`   Size: ${(fs.statSync(backupPath).size / 1024).toFixed(2)} KB`);
    console.log(`   Total backups: ${Math.min(backups.length + 1, MAX_BACKUPS)}`);
    console.log('════════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

runBackup();
