const db = require('../config/database');

/**
 * Audit Trail Logging Service
 * Immutable logging of system actions and data mutations.
 */
class AuditService {
  /**
   * Log an audit event
   * @param {Object} params
   * @param {number|null} params.userId - User performing action
   * @param {string} params.module - Target module (mfi, branch, agreement, user, role, auth, report)
   * @param {string} params.action - Action name (login, logout, create, update, delete, activate, deactivate, renew, reset_password, export)
   * @param {number|null} [params.recordId] - Affected record ID
   * @param {Object|null} [params.oldValue] - State prior to mutation
   * @param {Object|null} [params.newValue] - State after mutation
   * @param {string} [params.description] - Human readable description
   * @param {import('express').Request} [params.req] - Express request object for IP & UserAgent extraction
   */
  static async log({
    userId = null,
    module,
    action,
    recordId = null,
    oldValue = null,
    newValue = null,
    description = null,
    req = null
  }) {
    try {
      let ipAddress = '127.0.0.1';
      let userAgent = 'System/Internal';

      if (req) {
        ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';
        userAgent = req.headers['user-agent'] || 'Unknown';
        if (!userId && req.session?.user?.id) {
          userId = req.session.user.id;
        }
      }

      await db('audit_logs').insert({
        user_id: userId,
        module,
        action,
        record_id: recordId,
        old_value: oldValue ? JSON.stringify(oldValue) : null,
        new_value: newValue ? JSON.stringify(newValue) : null,
        ip_address: ipAddress.toString().substring(0, 45),
        user_agent: userAgent ? userAgent.toString().substring(0, 500) : null,
        description,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('[AuditService] Failed to record audit log:', err.message);
      // Non-blocking for application flow
    }
  }
}

module.exports = AuditService;
