import { MAX_DOC_BYTES, docPath, validatePdf } from './caseDocument';

const fakeFile = (name: string, type: string, bytes: number[], size = bytes.length) =>
  ({ name, type, size, slice: () => ({ arrayBuffer: async () => new Uint8Array(bytes).buffer }) }) as unknown as File;

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];

describe('validatePdf', () => {
  it('accepts a real PDF', async () => {
    expect(await validatePdf(fakeFile('case.pdf', 'application/pdf', PDF))).toBeNull();
  });
  it('accepts a PDF whose browser mime type is empty', async () => {
    expect(await validatePdf(fakeFile('Case File.PDF', '', PDF))).toBeNull();
  });
  it('rejects other types, empty files and oversized files', async () => {
    expect(await validatePdf(fakeFile('a.docx', 'application/msword', PDF))).toMatch(/PDF/);
    expect(await validatePdf(fakeFile('a.pdf', 'application/pdf', [], 0))).toMatch(/empty/);
    expect(await validatePdf(fakeFile('a.pdf', 'application/pdf', PDF, MAX_DOC_BYTES + 1))).toMatch(/too large/);
  });
  it('rejects a renamed non-PDF by its header', async () => {
    expect(await validatePdf(fakeFile('a.pdf', 'application/pdf', [0x50, 0x4b, 0x03, 0x04]))).toMatch(/valid PDF/);
  });
});

it('puts uploads in the user folder the storage policy requires', () => {
  expect(docPath('user-1', 'abc')).toBe('user-1/abc.pdf');
});
