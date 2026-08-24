require('dotenv').config();
const path = require('path');

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: process.env.DB_FILE || path.join(__dirname, 'database', 'mfi_management.sqlite3')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'database', 'migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'database', 'seeds')
    },
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON;', (err) => {
          if (err) return cb(err, conn);
          conn.run('PRAGMA journal_mode = WAL;', (err) => {
            if (err) return cb(err, conn);
            conn.run('PRAGMA synchronous = NORMAL;', (err) => cb(err, conn));
          });
        });
      }
    }
  },
  test: {
    client: 'sqlite3',
    connection: {
      filename: process.env.DB_FILE || path.join(__dirname, 'database', 'mfi_management.sqlite3')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'database', 'migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'database', 'seeds')
    },
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON;', (err) => {
          if (err) return cb(err, conn);
          conn.run('PRAGMA journal_mode = WAL;', (err) => {
            if (err) return cb(err, conn);
            conn.run('PRAGMA synchronous = NORMAL;', (err) => cb(err, conn));
          });
        });
      }
    }
  },
  production: {
    client: process.env.DB_CLIENT || 'sqlite3',
    connection: process.env.DATABASE_URL || {
      filename: process.env.DB_FILE || path.join(__dirname, 'database', 'mfi_management.sqlite3')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'database', 'migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'database', 'seeds')
    }
  }
};
