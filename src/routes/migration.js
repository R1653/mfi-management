const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const ExcelJS = require('exceljs');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const AuditService = require('../services/auditService');
const ExportService = require('../services/exportService');
const { computeBillableMonth } = require('../utils/billableMonth');

function normalizeHeaderKey(h) {
  const key = (h || '').toString().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (key.includes('mfi_short') || key.includes('mfi')) return 'mfi_short_name';
  if (key.includes('full_name') || key.includes('full')) return 'full_name';
  if (key.includes('short_name') || key.includes('short')) return 'short_name';
  if (key.includes('branch_name')) return 'branch_name';
  if (key.includes('branch_code') || key.includes('code')) return 'branch_code';
  if (key.includes('establish')) return 'establish_date';
  if (key.includes('initial_agreement') || key.includes('agreement_date')) return 'initial_agreement_date';
  if (key.includes('expire')) return 'agreement_expire_date';
  if (key.includes('license')) return 'initial_license_fee';
  if (key.includes('om_fee') || key.includes('o_m_fee')) return 'initial_om_fee';
  if (key.includes('branch_count') || key.includes('count')) return 'initial_branch_count';
  if (key.includes('grace')) return 'om_grace_period_months';
  if (key.includes('opening')) return 'branch_opening_date';
  if (key.includes('software_start') || key.includes('software')) return 'software_start_date';
  if (key.includes('billable')) return 'billable_month';
  if (key.includes('branch_type') || key.includes('type')) return 'branch_type';
  if (key.includes('status')) return 'status';
  return key;
}

function mapValuesToRow(headers, values) {
  const obj = {};
  headers.forEach((h, idx) => {
    if (h) {
      obj[h] = values[idx] !== undefined && values[idx] !== null ? String(values[idx]).trim() : '';
    }
  });
  return obj;
}

async function parseFileBuffer(buffer, filename) {
  const isCsv = (filename || '').toLowerCase().endsWith('.csv');
  const rows = [];

  if (isCsv) {
    const text = buffer.toString('utf8');
    const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];

    const parseLine = (line) => {
      const res = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          res.push(cur.trim().replace(/^"|"$/g, ''));
          cur = '';
        } else {
          cur += char;
        }
      }
      res.push(cur.trim().replace(/^"|"$/g, ''));
      return res;
    };

    let headerIndex = -1;
    let headers = [];

    for (let i = 0; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0) continue;
      const lineStr = values.join(' ').toLowerCase();

      if (headerIndex === -1) {
        if (lineStr.includes('full_name') || lineStr.includes('full name') || lineStr.includes('short_name') || lineStr.includes('short name') || lineStr.includes('branch_name') || lineStr.includes('branch name') || lineStr.includes('branch_code') || lineStr.includes('branch code')) {
          headerIndex = i;
          headers = values.map(h => normalizeHeaderKey(h));
        }
      } else {
        const rowObj = mapValuesToRow(headers, values);
        if (Object.values(rowObj).some(val => val !== '')) {
          rows.push(rowObj);
        }
      }
    }

    if (headerIndex === -1 && lines.length > 1) {
      headers = parseLine(lines[0]).map(h => normalizeHeaderKey(h));
      for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        const rowObj = mapValuesToRow(headers, values);
        if (Object.values(rowObj).some(val => val !== '')) {
          rows.push(rowObj);
        }
      }
    }
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    let headerRowNumber = -1;
    let headers = [];

    worksheet.eachRow((row, rowNumber) => {
      const rawValues = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let val = cell.value;
        if (val !== null && val !== undefined) {
          if (typeof val === 'object') {
            if (val.result !== undefined) val = val.result;
            else if (val.text !== undefined) val = val.text;
            else if (val.richText) val = val.richText.map(rt => rt.text).join('');
          }
          if (val instanceof Date) {
            val = dayjs(val).format('YYYY-MM-DD');
          }
        }
        rawValues[colNumber - 1] = val !== null && val !== undefined ? String(val).trim() : '';
      });

      const lineStr = rawValues.join(' ').toLowerCase();

      if (headerRowNumber === -1) {
        if (lineStr.includes('full_name') || lineStr.includes('full name') || lineStr.includes('short_name') || lineStr.includes('short name') || lineStr.includes('branch_name') || lineStr.includes('branch name') || lineStr.includes('branch_code') || lineStr.includes('branch code')) {
          headerRowNumber = rowNumber;
          headers = rawValues.map(h => normalizeHeaderKey(h));
        }
      } else {
        const rowObj = mapValuesToRow(headers, rawValues);
        if (Object.values(rowObj).some(val => val !== '')) {
          rows.push(rowObj);
        }
      }
    });

    if (headerRowNumber === -1) {
      let firstRow = true;
      worksheet.eachRow((row) => {
        const rawValues = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          let val = cell.value;
          if (val !== null && val !== undefined) {
            if (typeof val === 'object') {
              if (val.result !== undefined) val = val.result;
              else if (val.text !== undefined) val = val.text;
              else if (val.richText) val = val.richText.map(rt => rt.text).join('');
            }
            if (val instanceof Date) {
              val = dayjs(val).format('YYYY-MM-DD');
            }
          }
          rawValues[colNumber - 1] = val !== null && val !== undefined ? String(val).trim() : '';
        });

        if (firstRow) {
          headers = rawValues.map(h => normalizeHeaderKey(h));
          firstRow = false;
        } else {
          const rowObj = mapValuesToRow(headers, rawValues);
          if (Object.values(rowObj).some(val => val !== '')) {
            rows.push(rowObj);
          }
        }
      });
    }
  }

  return rows;
}

/**
 * GET /api/migration/template/mfi
 * Download MFI Migration Template (.xlsx or .csv)
 */
router.get('/template/mfi', async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();

    const columns = [
      { header: 'Full Name *', key: 'full_name', width: 30 },
      { header: 'Short Name *', key: 'short_name', width: 15 },
      { header: 'Establish Date (YYYY-MM-DD)', key: 'establish_date', width: 22 },
      { header: 'Initial Agreement Date * (YYYY-MM-DD)', key: 'initial_agreement_date', width: 28 },
      { header: 'Agreement Expire Date (YYYY-MM-DD)', key: 'agreement_expire_date', width: 28 },
      { header: 'Initial License Fee (BDT)', key: 'initial_license_fee', width: 22 },
      { header: 'Initial O&M Fee (BDT)', key: 'initial_om_fee', width: 20 },
      { header: 'Initial Branch Count', key: 'initial_branch_count', width: 20 },
      { header: 'O&M Grace Period (Months)', key: 'om_grace_period_months', width: 24 },
      { header: 'Status (active/inactive)', key: 'status', width: 20 }
    ];

    const sampleData = [
      {
        full_name: 'Social Services Society',
        short_name: 'SSS',
        establish_date: '1998-05-10',
        initial_agreement_date: '2020-01-01',
        agreement_expire_date: '2026-12-31',
        initial_license_fee: 1200,
        initial_om_fee: 600,
        initial_branch_count: 25,
        om_grace_period_months: 3,
        status: 'active'
      },
      {
        full_name: 'Example Microfinance Foundation',
        short_name: 'EMF',
        establish_date: '2005-08-15',
        initial_agreement_date: '2021-07-01',
        agreement_expire_date: '2026-07-01',
        initial_license_fee: 1000,
        initial_om_fee: 500,
        initial_branch_count: 15,
        om_grace_period_months: 0,
        status: 'active'
      }
    ];

    if (format === 'csv') {
      return ExportService.toCSV(res, 'mfi_migration_template', sampleData);
    } else {
      const buffer = await ExportService.toExcel({
        sheetName: 'MFI Migration Template',
        title: 'MFI Data Migration Standard Import Template',
        columns,
        data: sampleData
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="mfi_migration_template.xlsx"');
      return res.send(buffer);
    }
  } catch (error) {
    console.error('Error generating MFI template:', error);
    res.status(500).json({ success: false, message: 'Failed to generate MFI template.' });
  }
});

/**
 * GET /api/migration/template/branch
 * Download Branch Migration Template (.xlsx or .csv)
 */
router.get('/template/branch', async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();

    const columns = [
      { header: 'MFI Short Name *', key: 'mfi_short_name', width: 18 },
      { header: 'Branch Name *', key: 'branch_name', width: 25 },
      { header: 'Branch Code *', key: 'branch_code', width: 15 },
      { header: 'Branch Opening Date (YYYY-MM-DD)', key: 'branch_opening_date', width: 25 },
      { header: 'Software Start Date * (YYYY-MM-DD)', key: 'software_start_date', width: 25 },
      { header: 'Billable Month (YYYY-MM optional)', key: 'billable_month', width: 24 },
      { header: 'Branch Type (Branch Office / Area Office / Zone Office)', key: 'branch_type', width: 32 },
      { header: 'Status (active/inactive)', key: 'status', width: 20 }
    ];

    const sampleData = [
      {
        mfi_short_name: 'SSS',
        branch_name: 'Mirzapur Branch',
        branch_code: '1003',
        branch_opening_date: '2020-03-01',
        software_start_date: '2020-03-15',
        billable_month: '2020-03',
        branch_type: 'Branch Office',
        status: 'active'
      },
      {
        mfi_short_name: 'SSS',
        branch_name: 'Tangail Sadar Area',
        branch_code: '1002',
        branch_opening_date: '2020-02-01',
        software_start_date: '2020-02-15',
        billable_month: '2020-02',
        branch_type: 'Area Office',
        status: 'active'
      }
    ];

    if (format === 'csv') {
      return ExportService.toCSV(res, 'branch_migration_template', sampleData);
    } else {
      const buffer = await ExportService.toExcel({
        sheetName: 'Branch Migration Template',
        title: 'Branch Data Migration Standard Import Template',
        columns,
        data: sampleData
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="branch_migration_template.xlsx"');
      return res.send(buffer);
    }
  } catch (error) {
    console.error('Error generating Branch template:', error);
    res.status(500).json({ success: false, message: 'Failed to generate Branch template.' });
  }
});

/**
 * POST /api/migration/validate/mfi
 * Validate MFI migration dataset before import
 */
router.post('/validate/mfi', requireAuth, requirePermission('migration.import'), async (req, res) => {
  try {
    let { rows = [], fileData = null, fileName = '' } = req.body;

    if (fileData) {
      const buffer = Buffer.from(fileData, 'base64');
      rows = await parseFileBuffer(buffer, fileName);
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No row data found in uploaded file.' });
    }

    // Fetch existing MFI short names for uniqueness check
    const existingMfis = await db('mfi').whereNull('deleted_at').select('short_name');
    const existingShortNames = new Set(existingMfis.map(m => m.short_name.toLowerCase()));
    const payloadShortNames = new Set();

    const validatedRows = [];
    let validCount = 0;
    let invalidCount = 0;

    rows.forEach((row, index) => {
      const errors = [];
      const rowNum = index + 1;

      const fullName = (row.full_name || '').toString().trim();
      const shortName = (row.short_name || '').toString().trim();
      const establishDate = (row.establish_date || '').toString().trim();
      const initialAgrDate = (row.initial_agreement_date || '').toString().trim();
      const expireDate = (row.agreement_expire_date || '').toString().trim();
      const licenseFee = parseFloat(row.initial_license_fee) || 0;
      const omFee = parseFloat(row.initial_om_fee) || 0;
      const branchCount = parseInt(row.initial_branch_count, 10) || 0;
      const gracePeriod = row.om_grace_period_months !== undefined && row.om_grace_period_months !== '' ? parseInt(row.om_grace_period_months, 10) : 0;
      const status = (row.status || 'active').toString().trim().toLowerCase();

      if (!fullName) errors.push('Full Name is required.');
      if (!shortName) {
        errors.push('Short Name is required.');
      } else {
        if (existingShortNames.has(shortName.toLowerCase())) {
          errors.push(`Short Name "${shortName}" already exists in the system database.`);
        }
        if (payloadShortNames.has(shortName.toLowerCase())) {
          errors.push(`Duplicate Short Name "${shortName}" found within uploaded file.`);
        } else {
          payloadShortNames.add(shortName.toLowerCase());
        }
      }

      if (!initialAgrDate) {
        errors.push('Initial Agreement Date is required.');
      } else if (!dayjs(initialAgrDate).isValid()) {
        errors.push('Initial Agreement Date must be a valid date (YYYY-MM-DD).');
      }

      if (establishDate && !dayjs(establishDate).isValid()) {
        errors.push('Establish Date must be a valid date (YYYY-MM-DD).');
      }
      if (expireDate && !dayjs(expireDate).isValid()) {
        errors.push('Agreement Expire Date must be a valid date (YYYY-MM-DD).');
      }

      const isValid = errors.length === 0;
      if (isValid) validCount++; else invalidCount++;

      validatedRows.push({
        rowNumber: rowNum,
        data: {
          full_name: fullName,
          short_name: shortName,
          establish_date: establishDate || initialAgrDate || null,
          initial_agreement_date: initialAgrDate,
          agreement_expire_date: expireDate || null,
          initial_license_fee: licenseFee,
          initial_om_fee: omFee,
          initial_branch_count: branchCount,
          om_grace_period_months: gracePeriod,
          status: status === 'inactive' ? 'inactive' : 'active'
        },
        isValid,
        errors
      });
    });

    res.json({
      success: true,
      total: rows.length,
      validCount,
      invalidCount,
      rows: validatedRows
    });
  } catch (error) {
    console.error('Error validating MFI migration payload:', error);
    res.status(500).json({ success: false, message: 'Failed to validate MFI payload.' });
  }
});

/**
 * POST /api/migration/validate/branch
 * Validate Branch migration dataset before import
 */
router.post('/validate/branch', requireAuth, requirePermission('migration.import'), async (req, res) => {
  try {
    let { rows = [], fileData = null, fileName = '' } = req.body;

    if (fileData) {
      const buffer = Buffer.from(fileData, 'base64');
      rows = await parseFileBuffer(buffer, fileName);
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No row data found in uploaded file.' });
    }

    // Fetch existing MFIs map
    const mfis = await db('mfi').whereNull('deleted_at').select('id', 'short_name', 'om_grace_period_months');
    const mfiMapByShortName = new Map(mfis.map(m => [m.short_name.toLowerCase(), m]));

    // Fetch existing branch codes per MFI
    const existingBranches = await db('branches').whereNull('deleted_at').select('mfi_id', 'branch_code');
    const existingBranchCodes = new Set(existingBranches.map(b => `${b.mfi_id}:${b.branch_code.toLowerCase()}`));
    const payloadBranchCodes = new Set();

    const validatedRows = [];
    let validCount = 0;
    let invalidCount = 0;

    rows.forEach((row, index) => {
      const errors = [];
      const rowNum = index + 1;

      const mfiShortName = (row.mfi_short_name || row.short_name || '').toString().trim();
      const branchName = (row.branch_name || '').toString().trim();
      const branchCode = (row.branch_code || '').toString().trim();
      const openingDate = (row.branch_opening_date || '').toString().trim();
      const startDate = (row.software_start_date || '').toString().trim();
      let billableMonth = (row.billable_month || '').toString().trim();
      const branchType = (row.branch_type || 'Branch Office').toString().trim();
      const status = (row.status || 'active').toString().trim().toLowerCase();

      let targetMfi = null;
      if (!mfiShortName) {
        errors.push('MFI Short Name is required.');
      } else {
        targetMfi = mfiMapByShortName.get(mfiShortName.toLowerCase());
        if (!targetMfi) {
          errors.push(`MFI Short Name "${mfiShortName}" does not exist in system.`);
        }
      }

      if (!branchName) errors.push('Branch Name is required.');
      if (!branchCode) {
        errors.push('Branch Code is required.');
      } else if (targetMfi) {
        const key = `${targetMfi.id}:${branchCode.toLowerCase()}`;
        if (existingBranchCodes.has(key)) {
          errors.push(`Branch Code "${branchCode}" already exists for MFI "${mfiShortName}".`);
        }
        if (payloadBranchCodes.has(key)) {
          errors.push(`Duplicate Branch Code "${branchCode}" for MFI "${mfiShortName}" within file.`);
        } else {
          payloadBranchCodes.add(key);
        }
      }

      if (!startDate) {
        errors.push('Software Start Date is required.');
      } else if (!dayjs(startDate).isValid()) {
        errors.push('Software Start Date must be a valid date (YYYY-MM-DD).');
      } else if (!billableMonth && targetMfi) {
        // Auto-calculate billable month if not provided
        billableMonth = computeBillableMonth(startDate, targetMfi.om_grace_period_months || 0);
      }

      if (openingDate && !dayjs(openingDate).isValid()) {
        errors.push('Branch Opening Date must be a valid date (YYYY-MM-DD).');
      }

      const isValid = errors.length === 0;
      if (isValid) validCount++; else invalidCount++;

      validatedRows.push({
        rowNumber: rowNum,
        data: {
          mfi_id: targetMfi ? targetMfi.id : null,
          mfi_short_name: mfiShortName,
          branch_name: branchName,
          branch_code: branchCode,
          branch_opening_date: openingDate || startDate,
          software_start_date: startDate,
          billable_month: billableMonth,
          branch_type: ['Branch Office', 'Area Office', 'Zone Office'].includes(branchType) ? branchType : 'Branch Office',
          status: status === 'inactive' ? 'inactive' : 'active'
        },
        isValid,
        errors
      });
    });

    res.json({
      success: true,
      total: rows.length,
      validCount,
      invalidCount,
      rows: validatedRows
    });
  } catch (error) {
    console.error('Error validating Branch migration payload:', error);
    res.status(500).json({ success: false, message: 'Failed to validate Branch payload.' });
  }
});

/**
 * POST /api/migration/import/mfi
 * Batch import verified MFI rows
 */
router.post('/import/mfi', requireAuth, requirePermission('migration.import'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const { rows = [] } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: 'No valid rows provided for import.' });
    }

    let importedCount = 0;

    for (const row of rows) {
      const data = row.data || row;
      const userId = req.session.user.id;

      // 1. Insert into MFI table
      const [mfiId] = await trx('mfi').insert({
        full_name: data.full_name,
        short_name: data.short_name,
        establish_date: data.establish_date || data.initial_agreement_date,
        initial_agreement_date: data.initial_agreement_date,
        agreement_expire_date: data.agreement_expire_date || null,
        initial_license_fee: data.initial_license_fee || 0,
        initial_om_fee: data.initial_om_fee || 0,
        initial_branch_count: data.initial_branch_count || 0,
        om_grace_period_months: data.om_grace_period_months !== undefined ? data.om_grace_period_months : 0,
        status: data.status || 'active',
        created_by: userId,
        updated_by: userId,
        created_at: new Date(),
        updated_at: new Date()
      });

      // 2. Insert initial agreement record automatically
      await trx('mfi_agreements').insert({
        mfi_id: mfiId,
        agreement_date: data.initial_agreement_date,
        agreement_expire_date: data.agreement_expire_date || null,
        license_fee_per_branch: data.initial_license_fee || 0,
        om_fee_per_branch: data.initial_om_fee || 0,
        remarks: 'Automatically created during batch MFI data migration.',
        created_by: userId,
        created_at: new Date()
      });

      importedCount++;
    }

    await trx.commit();

    await AuditService.log({
      module: 'migration',
      action: 'import_mfi',
      description: `Bulk imported ${importedCount} MFI records`,
      req
    });

    res.json({
      success: true,
      message: `Successfully imported ${importedCount} MFI records with initial agreements.`,
      count: importedCount
    });
  } catch (error) {
    await trx.rollback();
    console.error('Error importing MFI migration rows:', error);
    res.status(500).json({ success: false, message: 'Failed to import MFI records: ' + error.message });
  }
});

/**
 * POST /api/migration/import/branch
 * Batch import verified Branch rows
 */
router.post('/import/branch', requireAuth, requirePermission('migration.import'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const { rows = [] } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: 'No valid rows provided for import.' });
    }

    let importedCount = 0;
    const userId = req.session.user.id;

    for (const row of rows) {
      const data = row.data || row;

      await trx('branches').insert({
        mfi_id: data.mfi_id,
        branch_name: data.branch_name,
        branch_code: data.branch_code,
        branch_opening_date: data.branch_opening_date || data.software_start_date,
        software_start_date: data.software_start_date,
        billable_month: data.billable_month,
        branch_type: data.branch_type || 'Branch Office',
        status: data.status || 'active',
        created_by: userId,
        updated_by: userId,
        created_at: new Date(),
        updated_at: new Date()
      });

      importedCount++;
    }

    await trx.commit();

    await AuditService.log({
      module: 'migration',
      action: 'import_branch',
      description: `Bulk imported ${importedCount} Branch records`,
      req
    });

    res.json({
      success: true,
      message: `Successfully imported ${importedCount} Branch records.`,
      count: importedCount
    });
  } catch (error) {
    await trx.rollback();
    console.error('Error importing Branch migration rows:', error);
    res.status(500).json({ success: false, message: 'Failed to import Branch records: ' + error.message });
  }
});

router.parseFileBuffer = parseFileBuffer;
module.exports = router;
