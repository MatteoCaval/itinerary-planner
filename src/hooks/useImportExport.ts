import { ChangeEvent } from 'react';
import { generateMarkdown, downloadMarkdown } from '../markdownExporter';
import { Day, ItineraryData, Location, Route } from '../types';
import { trackError, trackEvent } from '../services/telemetry';

interface UseImportExportOptions {
  days: Day[];
  locations: Location[];
  routes: Route[];
  startDate: string;
  endDate: string;
  getExportData: () => ItineraryData;
  loadFromData: (data: unknown) => { success: boolean; error?: string };
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
}

export const useImportExport = ({
  days,
  locations,
  routes,
  startDate,
  endDate,
  getExportData,
  loadFromData,
  notifySuccess,
  notifyError,
}: UseImportExportOptions) => {
  const handleExport = () => {
    const data = getExportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `itinerary-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    trackEvent('export_json', { locationsCount: locations.length, routesCount: routes.length });
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = JSON.parse(String(event.target?.result || '{}'));
        const result = loadFromData(parsed);
        if (result.success) {
          notifySuccess('Itinerary imported successfully.');
          trackEvent('import_json_success');
        } else {
          notifyError(result.error || 'Import failed due to invalid itinerary format.');
          trackEvent('import_json_invalid');
        }
      } catch (error) {
        trackError('import_json_parse_failed', error);
        notifyError('Error importing file. Please ensure it is valid JSON.');
      }
    };

    reader.onerror = () => {
      notifyError('Unable to read the selected file.');
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportMarkdown = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const md = generateMarkdown(days, locations, routes, startDate, endDate);
    downloadMarkdown(md, `travel-itinerary-${dateStr}.md`);
    trackEvent('export_markdown', { daysCount: days.length, locationsCount: locations.length });
  };

  return {
    handleExport,
    handleImport,
    handleExportMarkdown,
  };
};
