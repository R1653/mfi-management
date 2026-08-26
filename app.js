require('dotenv').config();
const express = require('express');
const session = require('express-session');
const morgan = require('morgan');
const path = require('path');
const cors = require('cors');

const authRoutes = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');
const teamRoutes = require('./src/routes/teams');
const teamMemberRoutes = require('./src/routes/teamMembers');
const mfiRoutes = require('./src/routes/mfi');
const branchRoutes = require('./src/routes/branches');
const agreementRoutes = require('./src/routes/agreements');
const userRoutes = require('./src/routes/users');
const roleRoutes = require('./src/routes/roles');
const auditLogRoutes = require('./src/routes/auditLogs');
const reportRoutes = require('./src/routes/reports');
const migrationRoutes = require('./src/routes/migration');
const { requireAuth, requireGuest } = require('./src/middleware/auth');

const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// Compression & Security Middleware
app.use(compression());
app.set('trust proxy', 1);
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'mfi_enterprise_secret_key_2026_secure',
    resave: true,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true if HTTPS in production
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: 'lax'
    }
  })
);

// Serve static assets with caching enabled for high performance
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true
}));

// HTML Page Routes
// Auth pages
app.get('/login', requireGuest, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// App Dashboard & Modules (Protected by auth)
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Team & Team Member pages
app.get(['/teams', '/teams/create', '/teams/:id', '/teams/:id/edit'], requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get(['/team-members', '/team-members/create', '/team-members/:id/edit'], requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// MFI pages
app.get(['/mfi', '/mfi/create', '/mfi/:id', '/mfi/:id/edit'], requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Branch pages
app.get(['/branches', '/branches/create', '/branches/:id/edit'], requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Agreement pages
app.get(['/agreements', '/agreements/create', '/agreements/:id/edit'], requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Administration pages
app.get(['/users', '/roles', '/audit-logs', '/migration'], requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Reports pages
app.get(['/reports/mfi', '/reports/branch', '/reports/agreement-history', '/reports/renewal-due', '/reports/om-bill', '/reports/licence-bill'], requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes Mount
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/team-members', teamMemberRoutes);
app.use('/api/mfis', mfiRoutes);
app.use('/api/mfi', mfiRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/agreements', agreementRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/migration', migrationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// Global 404 Handler for API
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.'
  });
});

// Fallback for HTML5 client navigation
app.get('*', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const fs = require('fs');
const db = require('./src/config/database');

// Auto-migrate & Auto-seed database on startup
async function initDatabase() {
  try {
    const dbDir = path.join(__dirname, 'database');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    console.log('[Database] Running automatic migrations...');
    await db.migrate.latest();
    console.log('[Database] Migrations complete.');

    const hasUsersTable = await db.schema.hasTable('users');
    if (hasUsersTable) {
      const userCount = await db('users').count('id as count').first();
      if (!userCount || userCount.count == 0) {
        console.log('[Database] Seeding initial data...');
        await db.seed.run();
        console.log('[Database] Seeding complete.');
      }
    }
  } catch (err) {
    console.error('[Database Init Error]', err);
  }
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Global Error]', err);
  if (req.xhr || (req.originalUrl && req.originalUrl.startsWith('/api/'))) {
    return res.status(500).json({
      success: false,
      message: err.message || 'An unexpected internal server error occurred.'
    });
  }
  res.status(500).send('An unexpected server error occurred.');
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    console.log(`====================================================`);
    console.log(`  MFI Management & Agreement Management System      `);
    console.log(`  Server running at: http://localhost:${PORT}        `);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'} `);
    console.log(`====================================================`);
    await initDatabase();
  });
}

module.exports = app;
