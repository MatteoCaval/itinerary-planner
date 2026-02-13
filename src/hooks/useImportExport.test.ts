import { describe, expect, it, vi, beforeEach } from 'vitest';

// We test the export/import logic by exercising the hook's callbacks directly.
// Since useImportExport is a plain function-returning hook that doesn't use
// React state, we can call it outside a component for unit testing.

import { useImportExport } from './useImportExport';

vi.mock('../services/telemetry', () => ({
  trackError: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('../markdownExporter', () => ({
  generateMarkdown: vi.fn(() => '# Itinerary'),
  downloadMarkdown: vi.fn(),
}));

const baseDays = [
  { id: 'd1', date: '2026-03-01', accommodation: null },
  { id: 'd2', date: '2026-03-02', accommodation: null },
];

const baseLocations = [
  { id: 'l1', name: 'Museum', lat: 45.1, lng: 7.6, dayIds: [], order: 0, startDayId: 'd1', startSlot: 'morning' as const, duration: 1, category: 'sightseeing' as const },
];

const baseRoutes = [
  { id: 'r1', fromLocationId: 'l1', toLocationId: 'l1', transportType: 'walk' as const },
];

const makeHook = (overrides: Record<string, unknown> = {}) => {
  const notifySuccess = vi.fn();
  const notifyError = vi.fn();
  const getExportData = vi.fn(() => ({
    days: baseDays,
    locations: baseLocations,
    routes: baseRoutes,
    startDate: '2026-03-01',
    endDate: '2026-03-02',
  }));
  const loadFromData = vi.fn(() => ({ success: true }));

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const hook = useImportExport({
    days: baseDays as never[],
    locations: baseLocations as never[],
    routes: baseRoutes as never[],
    startDate: '2026-03-01',
    endDate: '2026-03-02',
    getExportData,
    loadFromData,
    notifySuccess,
    notifyError,
    ...overrides,
  });

  return { hook, notifySuccess, notifyError, getExportData, loadFromData };
};

describe('useImportExport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handleExport creates and downloads a JSON blob', () => {
    const createObjectURL = vi.fn(() => 'blob://test');
    const revokeObjectURL = vi.fn();
    const clickSpy = vi.fn();
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as never);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as never);

    Object.defineProperty(globalThis, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    });

    // Stub createElement to capture click
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    const { hook, getExportData } = makeHook();
    hook.handleExport();

    expect(getExportData).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();

    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('handleImport calls loadFromData with parsed JSON on valid file', async () => {
    const loadFromData = vi.fn(() => ({ success: true }));
    const { hook, notifySuccess } = makeHook({ loadFromData });

    const fileContent = JSON.stringify({ days: baseDays, locations: baseLocations, routes: baseRoutes });
    const file = new File([fileContent], 'test.json', { type: 'application/json' });

    const event = {
      target: { files: [file], value: '' },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    hook.handleImport(event);

    // Wait for FileReader
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(loadFromData).toHaveBeenCalledTimes(1);
    expect(notifySuccess).toHaveBeenCalledWith('Itinerary imported successfully.');
  });

  it('handleImport notifies error on invalid JSON', async () => {
    const { hook, notifyError } = makeHook();

    const file = new File(['not json!!!'], 'bad.json', { type: 'application/json' });
    const event = {
      target: { files: [file], value: '' },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    hook.handleImport(event);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(notifyError).toHaveBeenCalledWith(expect.stringContaining('valid JSON'));
  });

  it('handleImport notifies error when loadFromData reports failure', async () => {
    const loadFromData = vi.fn(() => ({ success: false, error: 'Schema mismatch' }));
    const { hook, notifyError } = makeHook({ loadFromData });

    const file = new File([JSON.stringify({ days: [] })], 'test.json');
    const event = {
      target: { files: [file], value: '' },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    hook.handleImport(event);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(notifyError).toHaveBeenCalledWith('Schema mismatch');
  });

  it('handleExportMarkdown calls generateMarkdown and downloadMarkdown', async () => {
    const mdModule = await import('../markdownExporter');
    const { hook } = makeHook();
    hook.handleExportMarkdown();

    expect(mdModule.generateMarkdown).toHaveBeenCalled();
    expect(mdModule.downloadMarkdown).toHaveBeenCalled();
  });
});
