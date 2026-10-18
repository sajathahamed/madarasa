export type ExcelCell = string | number | null | undefined;

export type ExcelSheet = {
  name: string;
  rows: ExcelCell[][];
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cell(value: ExcelCell) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  const text = value == null ? "" : String(value);
  return `<Cell><Data ss:Type="String">${escapeXml(text)}</Data></Cell>`;
}

/** SpreadsheetML workbook. Excel opens this as a normal spreadsheet. */
export function buildExcelWorkbook(sheets: ExcelSheet[]) {
  const body = sheets
    .map((sheet) => {
      const name = escapeXml(sheet.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
      const rows = sheet.rows
        .map((row) => `<Row>${row.map(cell).join("")}</Row>`)
        .join("");
      return `<Worksheet ss:Name="${name}"><Table>${rows}</Table></Worksheet>`;
    })
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${body}
</Workbook>`;
}

export function downloadExcelWorkbook(filename: string, sheets: ExcelSheet[]) {
  const xml = buildExcelWorkbook(sheets);
  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
