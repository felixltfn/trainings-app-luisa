import { useState } from 'react';

import { CalendarScreen } from './screens/CalendarScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { TodayScreen } from './screens/TodayScreen';

type Tab = 'today' | 'calendar' | 'stats' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Heute', icon: 'M4 11 12 4l8 7M6 10v10h12V10' },
  { id: 'calendar', label: 'Kalender', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { id: 'stats', label: 'Fortschritt', icon: 'M5 20V11M12 20V4M19 20v-6' },
  { id: 'settings', label: 'Einstellungen', icon: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 5v4M8 15v4' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('today');

  return (
    <>
      {tab === 'today' && <TodayScreen />}
      {tab === 'calendar' && <CalendarScreen />}
      {tab === 'stats' && <StatsScreen />}
      {tab === 'settings' && <SettingsScreen />}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={t.icon} />
            </svg>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
