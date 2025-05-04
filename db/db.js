import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';

const dbPath = '../db/database.sqlite';

export const connectDB = async () => {
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
};