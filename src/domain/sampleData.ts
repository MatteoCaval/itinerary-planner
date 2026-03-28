import type { HybridTrip } from './types';
import { createVisit } from './visitLogic';

export function createSampleTrip(): HybridTrip {
  return {
    id: 'sample-hybrid-trip',
    name: 'Japan Late Spring Circuit',
    startDate: '2026-05-28',
    totalDays: 15,
    stays: [
      {
        id: 'stay-tokyo', name: 'Tokyo Exploration', color: '#2167d7',
        startSlot: 0, endSlot: 10, centerLat: 35.6895, centerLng: 139.6917,
        lodging: 'Park Hyatt Tokyo', travelModeToNext: 'train',
        travelDurationToNext: '150 mins',
        travelNotesToNext: 'Hokuriku Shinkansen Kagayaki from Tokyo to Kanazawa.',
        visits: [
          createVisit('tokyo-1', 'Shinjuku & Omoide Yokocho', 'landmark', 'Shinjuku', 35.6923, 139.7024, 0, 'evening', 0),
          createVisit('tokyo-2', 'Sushi dinner at Sukiyabashi Jiro', 'food', 'Ginza', 35.6716, 139.7657, 0, 'evening', 1, '90m'),
          createVisit('tokyo-3', 'Meiji Jingu & Harajuku', 'landmark', 'Harajuku', 35.6764, 139.6993, 1, 'morning', 0, '2h'),
          createVisit('tokyo-4', 'Shibuya Crossing & Hachiko', 'landmark', 'Shibuya', 35.6585, 139.7013, 1, 'afternoon', 0, '2h'),
          createVisit('tokyo-5', 'Tokyo Tower', 'landmark', 'Minato', 35.6584, 139.7455, 2, 'morning', 0, '1h'),
          createVisit('tokyo-6', 'Senso-ji & Sumida River', 'landmark', 'Asakusa', 35.7148, 139.7967, 2, 'afternoon', 0, '2h'),
          createVisit('tokyo-7', 'Akihabara Electric Town', 'shopping', 'Akihabara', 35.6984, 139.7711, 2, 'evening', 0, '2h'),
          createVisit('tokyo-8', 'Tsukiji Outer Market', 'food', 'Tsukiji', 35.6655, 139.7707, 3, 'morning', 0, '90m'),
          createVisit('tokyo-9', 'Ginza department stores', 'shopping', 'Ginza', 35.671, 139.765, null, null, 0, 'Flexible'),
          createVisit('tokyo-10', 'Imperial Palace gardens', 'walk', 'Chiyoda', 35.6852, 139.7528, null, null, 1, '1h'),
          createVisit('tokyo-11', 'teamLab Planets', 'museum', 'Toyosu', 35.6449, 139.7904, null, null, 2, '2h'),
        ],
      },
      {
        id: 'stay-kanazawa', name: 'Kanazawa & Hokuriku', color: '#615cf6',
        startSlot: 10, endSlot: 18, centerLat: 36.5613, centerLng: 136.6562,
        lodging: 'Hyatt Centric Kanazawa', travelModeToNext: 'bus',
        travelDurationToNext: '75 mins',
        travelNotesToNext: 'Advance-booked Nohi Bus toward Shirakawa-go.',
        visits: [
          createVisit('kanazawa-1', 'Higashi Chaya District', 'landmark', 'Higashi Chaya', 36.5724, 136.6665, 0, 'evening', 0, '2h'),
          createVisit('kanazawa-2', 'Kenrokuen Garden & Castle', 'walk', 'Kenrokuen', 36.5621, 136.6627, 1, 'morning', 0, '2-3h'),
          createVisit('kanazawa-3', '21st Century Museum of Contemporary Art', 'museum', 'Hirosaka', 36.5609, 136.6582, 1, 'evening', 0, '2h'),
          createVisit('kanazawa-4', 'Omicho Market dinner', 'food', 'Omicho', 36.5718, 136.6567, 1, 'afternoon', 0, '90m'),
          createVisit('kanazawa-5', 'Kaga Onsen (Yamanaka)', 'walk', 'Yamanaka Onsen', 36.2464, 136.3758, 2, 'morning', 0, 'Half day'),
          createVisit('kanazawa-6', 'Nagamachi Samurai District', 'landmark', 'Nagamachi', 36.5596, 136.6514, null, null, 0, '90m'),
        ],
      },
      {
        id: 'stay-kyoto', name: 'Kyoto & Nara Cultural Core', color: '#d78035',
        startSlot: 21, endSlot: 36, centerLat: 35.0116, centerLng: 135.7681,
        lodging: 'The Ritz-Carlton Kyoto', travelModeToNext: 'train',
        travelDurationToNext: '30 mins',
        travelNotesToNext: 'JR Special Rapid Service from Kyoto to Osaka.',
        visits: [
          createVisit('kyoto-1', 'Gion & Pontocho Alley', 'landmark', 'Gion', 35.0037, 135.775, 0, 'evening', 0, '2h'),
          createVisit('kyoto-2', 'Arashiyama Bamboo Grove & Tenryu-ji', 'walk', 'Arashiyama', 35.0158, 135.672, 1, 'morning', 0, '2h'),
          createVisit('kyoto-3', 'Kinkaku-ji & Ryoan-ji', 'landmark', 'Kita', 35.0394, 135.7292, 1, 'afternoon', 0, '2h'),
          createVisit('kyoto-4', 'Kiyomizu-dera & Sannenzaka', 'landmark', 'Higashiyama', 34.9949, 135.785, 1, 'evening', 0, '2h'),
          createVisit('kyoto-5', 'Nara Day Trip (Todai-ji & Deer Park)', 'landmark', 'Nara', 34.6851, 135.8048, 2, 'morning', 0, 'Half day'),
          createVisit('kyoto-6', 'Fushimi Inari Shrine', 'landmark', 'Fushimi', 34.9671, 135.7727, 3, 'morning', 0, '90m'),
          createVisit('kyoto-7', 'Nishiki Market & Teramachi', 'food', 'Downtown', 35.005, 135.7649, 3, 'afternoon', 0, '2h'),
          createVisit('kyoto-8', "Philosopher's Path", 'walk', 'Sakyo', 35.0269, 135.7959, null, null, 0, 'Flexible'),
        ],
      },
      {
        id: 'stay-osaka', name: 'Osaka City', color: '#20b5a8',
        startSlot: 36, endSlot: 45, centerLat: 34.6937, centerLng: 135.5023,
        lodging: 'W Osaka', travelModeToNext: 'train',
        travelDurationToNext: '155 mins',
        travelNotesToNext: 'Tokaido Shinkansen Nozomi to Tokyo Station.',
        visits: [
          createVisit('osaka-1', 'Osaka Castle Park', 'landmark', 'Chuo', 34.6873, 135.5262, 0, 'morning', 0, '2h'),
          createVisit('osaka-2', 'Dotonbori Neon & Food Tour', 'food', 'Namba', 34.6687, 135.5013, 0, 'evening', 0, '2h'),
          createVisit('osaka-3', 'Kuromon Market', 'food', 'Nippombashi', 34.6654, 135.5064, 1, 'morning', 0, '90m'),
          createVisit('osaka-4', 'Shinsekai & Abeno Harukas', 'landmark', 'Tennoji', 34.6525, 135.5063, 1, 'afternoon', 0, '2h'),
          createVisit('osaka-5', 'teamLab Botanical Garden', 'museum', 'Nagai', 34.6129, 135.5227, null, null, 0, '2h'),
        ],
      },
    ],
  };
}
