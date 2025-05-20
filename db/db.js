import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import dotenv from 'dotenv';
import os from 'os';

dotenv.config();

const db_state = process.env.DB_STATE;

let dbPath;

if (db_state === 'local') {
  dbPath = '../db/database.sqlite';
} else {
  const homeDir = os.homedir(); // "/home/somua"
  dbPath = path.resolve(homeDir, 'sqldb/database.sqlite');
}

let dbInstance;

export const connectDB = async () => {
  if (!dbInstance) {
    dbInstance = await open({
      filename: path.resolve(dbPath),
      driver: sqlite3.Database,
    });
  }
  return dbInstance;
};