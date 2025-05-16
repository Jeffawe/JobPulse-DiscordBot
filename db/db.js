import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const dbPath = '../db/database.sqlite';
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