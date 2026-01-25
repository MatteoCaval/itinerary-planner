import { Day, Location, Route, TRANSPORT_LABELS } from './types';

export const generateMarkdown = (days: Day[], locations: Location[], routes: Route[], startDate: string, endDate: string) => {
  let md = `# Travel Itinerary\n`;
  md += `**Dates:** ${new Date(startDate).toLocaleDateString()} — ${new Date(endDate).toLocaleDateString()}\n\n`;

  const getDayLocations = (dayId: string) => {
    return locations
      .filter(l => l.startDayId === dayId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const getRouteTo = (toId: string) => {
    return routes.find(r => r.toLocationId === toId);
  };

  days.forEach((day, index) => {
    const dayLocs = getDayLocations(day.id);
    const dateStr = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
    });

    md += `## Day ${index + 1}: ${dateStr}\n`;
    
    if (day.accommodation?.name) {
      md += `🏠 **Staying at:** ${day.accommodation.name}\n`;
      if (day.accommodation.notes) md += `> ${day.accommodation.notes}\n`;
      md += `\n`;
    }

    if (dayLocs.length === 0) {
      md += `*No activities planned*\n\n`;
      return;
    }

    dayLocs.forEach((loc) => {
      const route = getRouteTo(loc.id);
      
      if (route) {
        md += `  *Travel via ${TRANSPORT_LABELS[route.transportType]}${route.duration ? ` (${route.duration})` : ''}*\n`;
      }

      md += `### ${loc.name} (${loc.startSlot})\n`;
      
      if (loc.notes) {
        md += `${loc.notes}\n\n`;
      }

      if (loc.checklist && loc.checklist.length > 0) {
        md += `**Checklist:**\n`;
        loc.checklist.forEach(item => {
          md += `- [${item.completed ? 'x' : ' '}] ${item.text}\n`;
        });
        md += `\n`;
      }

      if (loc.links && loc.links.length > 0) {
        md += `**Links:**\n`;
        loc.links.forEach(link => {
          md += `- [${link.label}](${link.url})\n`;
        });
        md += `\n`;
      }
    });

    md += `--- \n\n`;
  });

  md += `*Generated with Itinerary Planner*`;
  return md;
};

export const downloadMarkdown = (md: string, filename: string) => {
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  
  // Clean up after a small delay
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
};
