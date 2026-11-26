import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('csv', () => {
  it('quotes every cell and doubles embedded quotes', () => {
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell('a,b')).toBe('"a,b"');
  });

  it('keeps # and newlines inside the cell (no truncation)', () => {
    expect(toCsv([['ملاحظة #1', 'line1\nline2']])).toBe('"ملاحظة #1","line1\nline2"');
  });

  it('neutralises spreadsheet formulas in text', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell('+1+1')).toBe('"\'+1+1"');
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(csvCell('-cmd')).toBe('"\'-cmd"');
  });

  it('leaves numbers alone, including negative amounts', () => {
    expect(csvCell(-100)).toBe('"-100"');
    expect(csvCell('-75.50')).toBe('"-75.50"');
    expect(csvCell(250)).toBe('"250"');
  });

  it('writes empty cells for null and undefined, rows separated by CRLF', () => {
    expect(
      toCsv([
        ['a', null],
        [undefined, 'b'],
      ]),
    ).toBe('"a",""\r\n"","b"');
  });
});
