const ExcelJS = require('exceljs');
const fastcsv = require('fast-csv');
const PDFDocument = require('pdfkit-table');

class ExportService {
  /**
   * Export dataset as Excel (.xlsx) buffer
   * @param {Object} options
   * @param {string} options.sheetName
   * @param {Array<{header: string, key: string, width: number}>} options.columns
   * @param {Array<Object>} options.data
   * @returns {Promise<Buffer>}
   */
  static async toExcel({ sheetName = 'Report', columns, data, title = 'Data Export' }) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MFI Management System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName);

    // Title Row
    worksheet.mergeCells('A1', `${String.fromCharCode(64 + columns.length)}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1A56DB' }
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 30;

    // Subtitle Row with Timestamp
    worksheet.mergeCells('A2', `${String.fromCharCode(64 + columns.length)}2`);
    const subCell = worksheet.getCell('A2');
    subCell.value = `Generated on: ${new Date().toLocaleString()}`;
    subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(2).height = 20;

    // Columns mapping (Row 4)
    worksheet.getRow(4).values = columns.map(c => c.header);
    worksheet.getRow(4).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(4).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }
    };
    worksheet.getRow(4).height = 24;

    // Apply column widths
    columns.forEach((col, idx) => {
      worksheet.getColumn(idx + 1).width = col.width || 20;
    });

    // Add Data Rows starting row 5
    data.forEach((row, rowIndex) => {
      const rowValues = columns.map(c => row[c.key] !== undefined && row[c.key] !== null ? row[c.key] : '');
      const excelRow = worksheet.addRow(rowValues);
      excelRow.height = 20;
      excelRow.font = { name: 'Arial', size: 10 };

      // Zebra striping
      if (rowIndex % 2 === 1) {
        excelRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }
        };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Stream dataset as CSV to Express response
   * @param {import('express').Response} res
   * @param {string} filename
   * @param {Array<Object>} data
   */
  static toCSV(res, filename, data) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    fastcsv.write(data, { headers: true }).pipe(res);
  }

  /**
   * Export dataset as PDF stream to Express response
   * @param {import('express').Response} res
   * @param {string} filename
   * @param {string} title
   * @param {Array<string>} headers
   * @param {Array<Array<string>>} rows
   */
  static async toPDF(res, filename, title, headers, rows) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: headers.length > 5 ? 'landscape' : 'portrait' });
    doc.pipe(res);

    // Header
    doc.fontSize(16).text(title, { align: 'center' });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    const table = {
      title: '',
      headers: headers,
      rows: rows
    };

    await doc.table(table, {
      prepareHeader: () => doc.fontSize(9).font('Helvetica-Bold'),
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        doc.fontSize(8).font('Helvetica');
      }
    });

    doc.end();
  }
}

module.exports = ExportService;
