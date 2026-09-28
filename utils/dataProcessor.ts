
import { DataRow, DataType, ProcessedData, DashboardMetrics } from '../types';

const DATE_PATTERN = /^(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(?:\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})$/;
const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;

export function parseToStandardDate(val: string): string | null {
  if (!val) return null;
  const str = String(val).trim();
  if (DATE_PATTERN.test(str)) {
    const parts = str.split(/[\/\-]/);
    let d: string, m: string, y: string;
    if (parts[0].length === 4) { [y, m, d] = parts; } 
    else { [d, m, y] = parts; }
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) {
      return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    }
  }
  const num = Number(str);
  if (!isNaN(num) && num > 40000 && num < 60000 && !str.includes('.')) {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }
  return null;
}

function getTokenType(token: string): DataType {
  if (!token) return DataType.UNKNOWN;
  if (parseToStandardDate(token)) return DataType.DATE;
  // Emirates ID or standardized hyphenated ID numbers
  if (/^\d{3}-?\d{4}-?\d{7}-?\d$/.test(token)) return DataType.NUMBER;
  // Pure digit sequences of any length (including 14-digit Labor Card / Person IDs and numbers with leading zeros)
  if (/^\d+$/.test(token)) return DataType.NUMBER;
  // Numbers with decimals
  if (/^\d+(\.\d+)?$/.test(token)) return DataType.NUMBER;
  // Grouped numbers with spaces or dashes but no alphabets
  const clean = token.replace(/[\s\-]/g, '');
  if (/^\d{4,}$/.test(clean) && !/[a-zA-Z]/.test(token)) return DataType.NUMBER;
  // English words / text
  if (/[a-zA-Z]/.test(token)) return DataType.TEXT_ENGLISH;
  return DataType.UNKNOWN;
}

function getTokens(val: any): string[] {
  if (val === null || val === undefined) return [];
  let str = String(val).replace(ARABIC_REGEX, ' ').trim();
  if (!str) return [];

  // Separate long attached numbers (e.g. "MENSAH40717079503014" -> "MENSAH 40717079503014")
  // Keep short alphanumeric words like passport number "G3024584" intact by requiring 2+ letters and 8+ digits
  str = str.replace(/([a-zA-Z]{2,})(\d{8,})/g, '$1 $2');
  str = str.replace(/(\d{8,})([a-zA-Z]{2,})/g, '$1 $2');

  // Split on row breaks, double spaces, commas, semicolons, or pipes
  const rawSegments = str.split(/[\n\r]+|\s{2,}|[;,|]/).map(s => s.trim()).filter(Boolean);
  const result: string[] = [];

  for (const segment of rawSegments) {
    // If the entire segment is already a clean date, pure number, or Emirates ID, keep directly
    if (parseToStandardDate(segment) || /^\d+$/.test(segment) || /^\d{3}-?\d{4}-?\d{7}-?\d$/.test(segment)) {
      result.push(segment);
      continue;
    }

    // Extract dates first so date numbers (like year 2024) are not mistaken for ID numbers
    let remaining = segment;
    const dateRegex = /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g;
    const datesFound: string[] = [];
    remaining = remaining.replace(dateRegex, (match) => {
      if (parseToStandardDate(match)) {
        datesFound.push(match);
        return ' ';
      }
      return match;
    });

    const numbersFound: string[] = [];

    // Extract Emirates IDs: e.g. 784-1988-1234567-1
    remaining = remaining.replace(/\b\d{3}-\d{4}-\d{7}-\d\b/g, (match) => {
      numbersFound.push(match);
      return ' ';
    });

    // Extract numbers wrapped in parentheses, brackets, or preceded by #, ID, No., etc.
    remaining = remaining.replace(/(?:^|[\s\(\[\{,\-:#/])(?:\#|No\.?|ID:?)?\s*(\d{4,})(?:[\)\]\},]|\b)/gi, (_, digits) => {
      numbersFound.push(digits);
      return ' ';
    });

    // Extract standalone numbers of 4+ digits (e.g. 14-digit labor card IDs like 40717079503014)
    remaining = remaining.replace(/\b\d{4,}\b/g, (match) => {
      numbersFound.push(match);
      return ' ';
    });

    // Clean remaining text from surrounding separators or leftover brackets
    const textPart = remaining
      .replace(/[[\](){}:#/*|\\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (textPart) {
      result.push(textPart);
    }
    for (const num of numbersFound) {
      result.push(num);
    }
    for (const d of datesFound) {
      result.push(d);
    }
  }

  return result;
}

function mergeRecords(rawRows: DataRow[]): DataRow[] {
  if (rawRows.length === 0) return [];
  const merged: DataRow[] = [];
  const headers = Object.keys(rawRows[0]);
  let current: DataRow | null = null;
  rawRows.forEach((row) => {
    const idVal = String(row[headers[0]] || '').trim();
    if (idVal !== "") {
      current = { ...row };
      merged.push(current);
    } else if (current) {
      headers.forEach(h => {
        const val = String(row[h] || '').trim();
        if (val) {
          const existing = String(current![h] || '').trim();
          current![h] = existing ? `${existing}\n${val}` : val;
        }
      });
    } else {
      current = { ...row };
      merged.push(current);
    }
  });
  return merged;
}

export function harmonizeData(rawRows: DataRow[]): ProcessedData {
  if (rawRows.length === 0) return { headers: [], rows: [], originalHeaders: [] };
  const mergedRows = mergeRecords(rawRows);
  const originalHeaders = Object.keys(mergedRows[0]);
  const columnTypeMap: Record<string, Set<DataType>> = {};
  originalHeaders.forEach((header, index) => {
    const types = new Set<DataType>();
    if (index === 0) { types.add(DataType.TEXT_ENGLISH); } 
    else {
      mergedRows.forEach(row => {
        const tokens = getTokens(row[header]);
        tokens.forEach(t => types.add(getTokenType(t)));
      });
    }
    columnTypeMap[header] = types;
  });
  const finalHeaders: string[] = [];
  const expansionMap: Record<string, string[]> = {};
  originalHeaders.forEach((header, index) => {
    const types = columnTypeMap[header];
    if (index === 0 || types.size <= 1) {
      finalHeaders.push(header);
      expansionMap[header] = [header];
    } else {
      const subs: string[] = [];
      if (types.has(DataType.TEXT_ENGLISH)) subs.push(`${header} (Text)`);
      if (types.has(DataType.NUMBER)) subs.push(`${header} (Number)`);
      if (types.has(DataType.DATE)) subs.push(`${header} (Date)`);
      finalHeaders.push(...subs);
      expansionMap[header] = subs;
    }
  });
  const finalRows = mergedRows.map(row => {
    const newRow: DataRow = {};
    originalHeaders.forEach((header, index) => {
      const tokens = getTokens(row[header]);
      const targets = expansionMap[header];
      if (index === 0 || targets.length === 1) { newRow[targets[0]] = tokens.join(' '); } 
      else {
        targets.forEach(t => newRow[t] = "");
        tokens.forEach(token => {
          const type = getTokenType(token);
          let val = token;
          let subSuffix = "";
          if (type === DataType.DATE) {
            val = parseToStandardDate(token) || token;
            subSuffix = " (Date)";
          } else if (type === DataType.NUMBER) { subSuffix = " (Number)"; } 
          else if (type === DataType.TEXT_ENGLISH) { subSuffix = " (Text)"; }
          const targetHeader = `${header}${subSuffix}`;
          if (targets.includes(targetHeader)) {
            const existing = String(newRow[targetHeader] || '');
            newRow[targetHeader] = existing ? `${existing}; ${val}` : val;
          }
        });

        // Layer 2 Safeguard: Ensure no numbers remain trapped inside (Text) column
        const textKey = `${header} (Text)`;
        const numKey = `${header} (Number)`;
        if (targets.includes(textKey) && targets.includes(numKey)) {
          let textVal = String(newRow[textKey] || '');
          const trappedNumbers = textVal.match(/\b\d{4,}\b/g) || [];
          if (trappedNumbers.length > 0) {
            trappedNumbers.forEach(n => {
              const currentNum = String(newRow[numKey] || '');
              if (!currentNum.includes(n)) {
                newRow[numKey] = currentNum ? `${currentNum}; ${n}` : n;
              }
              textVal = textVal.replace(new RegExp(`\\b${n}\\b`, 'g'), '');
            });
            newRow[textKey] = textVal.replace(/[[\](){}:#/*|\\-]+/g, ' ').replace(/\s+/g, ' ').trim();
          }
        }
      }
    });
    return newRow;
  });
  return { headers: finalHeaders, rows: finalRows, originalHeaders };
}

export function extractDashboardMetrics(data: DataRow[]): DashboardMetrics {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const metrics: DashboardMetrics = {
    total: data.length,
    escapeCount: 0,
    expiredCardCount: 0,
    activeCount: 0,
    upcomingRenewals: 0,
    nationalityData: {},
    nationalityEscapeData: {},
    nationalityExpiredData: {},
    statusData: {},
    jobDescriptionData: {}, 
    monthlyRenewals: {},
    monthlyEscapes: {}, // Track escapes by expiry month
    escapeRecords: [],
    expiredRecords: [],
    upcomingRecords: []
  };

  data.forEach(row => {
    const natKey = Object.keys(row).find(k => k.toLowerCase().includes('nationality'));
    const nat = natKey ? (String(row[natKey]).trim() || 'Unspecified') : 'Unspecified';
    metrics.nationalityData[nat] = (metrics.nationalityData[nat] || 0) + 1;

    let hasEscapeText = false;
    Object.values(row).forEach(val => {
      if (String(val).toLowerCase().includes('he has an escape report')) {
        hasEscapeText = true;
      }
    });

    if (hasEscapeText) {
      metrics.escapeCount++;
      metrics.escapeRecords.push(row);
      metrics.nationalityEscapeData[nat] = (metrics.nationalityEscapeData[nat] || 0) + 1;
    }

    const dateKey = Object.keys(row).find(k => k.includes('(Date)'));
    if (dateKey) {
      const dateStr = String(row[dateKey]).split(';')[0].trim();
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const dObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        if (!isNaN(dObj.getTime())) {
          const monthLabel = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}`;
          metrics.monthlyRenewals[monthLabel] = (metrics.monthlyRenewals[monthLabel] || 0) + 1;
          
          if (hasEscapeText) {
            metrics.monthlyEscapes[monthLabel] = (metrics.monthlyEscapes[monthLabel] || 0) + 1;
          }

          if (dObj < today) {
            metrics.expiredCardCount++;
            metrics.expiredRecords.push(row);
            metrics.nationalityExpiredData[nat] = (metrics.nationalityExpiredData[nat] || 0) + 1;
          } else {
            metrics.activeCount++;
            if (dObj.getMonth() === currentMonth && dObj.getFullYear() === currentYear) {
              metrics.upcomingRenewals++;
              metrics.upcomingRecords.push(row);
            }
          }
        }
      }
    }
    
    const statusKey = Object.keys(row).find(k => k.toLowerCase().includes('status') || k.toLowerCase().includes('card type'));
    if (statusKey) {
      const status = String(row[statusKey]).trim() || 'Unknown';
      metrics.statusData[status] = (metrics.statusData[status] || 0) + 1;
    }
  });

  return metrics;
}

export function generatePivotData(rows: DataRow[], rowField: string, colField: string, valField: string, aggType: string) {
  const pivot: Record<string, Record<string, number>> = {};
  const allCols = new Set<string>();
  rows.forEach(row => {
    const rVal = String(row[rowField] || '(Blank)');
    const cVal = String(row[colField] || '(Blank)');
    const vRaw = String(row[valField] || '0').replace(/[^0-9.-]+/g, '');
    const vVal = parseFloat(vRaw) || 0;
    allCols.add(cVal);
    if (!pivot[rVal]) pivot[rVal] = {};
    if (aggType === 'sum') { pivot[rVal][cVal] = (pivot[rVal][cVal] || 0) + vVal; } 
    else { pivot[rVal][cVal] = (pivot[rVal][cVal] || 0) + 1; }
  });
  return { rows: Object.keys(pivot).map(key => ({ row: key, ...pivot[key] })), columns: Array.from(allCols).sort() };
}
