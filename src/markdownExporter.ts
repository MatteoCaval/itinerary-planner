import { Day, Location, Route, TRANSPORT_LABELS } from './types';
import { getSectionIndex } from './constants/daySection';

export const generateMarkdown = (days: Day[], locations: Location[], routes: Route[], startDate: string, endDate: string) => {
  let md = `# Travel Itinerary\n`;
  md += `**Dates:** ${new Date(startDate).toLocaleDateString()} — ${new Date(endDate).toLocaleDateString()}\n\n`;

  type ExportItem = { location: Location; parent?: Location };

  const dayItems: Record<string, ExportItem[]> = {};
  const unassignedItems: ExportItem[] = [];

  const pushItem = (dayId: string | null, item: ExportItem) => {
    if (!dayId) {
      unassignedItems.push(item);
      return;
    }
    if (!dayItems[dayId]) dayItems[dayId] = [];
    dayItems[dayId].push(item);
  };

  locations.forEach(loc => {
    const hasSubs = !!(loc.subLocations && loc.subLocations.length > 0);
    if (hasSubs) {
      const parentStartIdx = days.findIndex(d => d.id === loc.startDayId);
      loc.subLocations!.forEach(sub => {
        if (sub.dayOffset === undefined || parentStartIdx === -1) {
          pushItem(null, { location: sub, parent: loc });
          return;
        }
        const day = days[parentStartIdx + sub.dayOffset];
        pushItem(day?.id || null, { location: sub, parent: loc });
      });
    } else {
      pushItem(loc.startDayId || null, { location: loc });
    }
  });

  const sortItems = (items: ExportItem[]) => {
    return [...items].sort((a, b) => {
      const slotA = getSectionIndex(a.location.startSlot);
      const slotB = getSectionIndex(b.location.startSlot);
      if (slotA !== slotB) return slotA - slotB;
      return (a.location.order || 0) - (b.location.order || 0);
    });
  };

  const getRouteTo = (toId: string) => {
    return routes.find(r => r.toLocationId === toId);
  };

  days.forEach((day, index) => {
    const dayLocs = sortItems(dayItems[day.id] || []);
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

    const grouped: Record<string, { parent?: Location; items: ExportItem[] }> = {};
    dayLocs.forEach(item => {
      const key = item.parent ? item.parent.id : 'root';
      if (!grouped[key]) grouped[key] = { parent: item.parent, items: [] };
      grouped[key].items.push(item);
    });

    const groupKeys = Object.keys(grouped);
    groupKeys.forEach((key, idx) => {
      const group = grouped[key];
      if (group.parent) {
        const totalDays = Math.ceil((group.parent.duration || 1) / 3);
        const relDay = (group.items[0]?.location.dayOffset ?? 0) + 1;
        md += `**Destination:** ${group.parent.name} (Day ${relDay}${totalDays > 1 ? ` of ${totalDays}` : ''})\n\n`;
      }

      sortItems(group.items).forEach(({ location }) => {
        const route = getRouteTo(location.id);
        
        if (route) {
          md += `  *Travel via ${TRANSPORT_LABELS[route.transportType]}${route.duration ? ` (${route.duration})` : ''}*\n`;
        }

        md += `### ${location.name} (${location.startSlot})\n`;
        
        if (location.notes) {
          md += `${location.notes}\n\n`;
        }

        if (location.checklist && location.checklist.length > 0) {
          md += `**Checklist:**\n`;
          location.checklist.forEach(item => {
            md += `- [${item.completed ? 'x' : ' '}] ${item.text}\n`;
          });
          md += `\n`;
        }

        if (location.links && location.links.length > 0) {
          md += `**Links:**\n`;
          location.links.forEach(link => {
            md += `- [${link.label}](${link.url})\n`;
          });
          md += `\n`;
        }
      });

      if (idx < groupKeys.length - 1) {
        md += `\n`;
      }
    });

    md += `--- \n\n`;
  });

  if (unassignedItems.length > 0) {
    md += `## Unassigned\n`;
    sortItems(unassignedItems).forEach(({ location, parent }) => {
      if (parent) {
        md += `**Destination:** ${parent.name}\n\n`;
      }
      md += `### ${location.name} (${location.startSlot || 'unscheduled'})\n`;
      if (location.notes) {
        md += `${location.notes}\n\n`;
      }
    });
    md += `--- \n\n`;
  }

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
