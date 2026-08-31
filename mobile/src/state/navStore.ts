import { useEffect, useState } from 'react';

// Web-only lightweight pub-sub for cross-cutting nav state. The web shell
// (src/web/WebAppShell.tsx) doesn't use react-navigation's navigator tree at
// all (it's a hand-rolled sidebar + master-detail layout, not a stack/tab
// navigator), so a push-notification click can't drive it via navigationRef
// the way the mobile app's deep link does -- this is its equivalent.

export type Section = 'signals' | 'performance' | 'settings';

let currentSection: Section = 'signals';
let currentSignalId: number | null = null;
const sectionListeners = new Set<(section: Section) => void>();
const signalListeners = new Set<(id: number | null) => void>();

export function setSection(section: Section) {
  currentSection = section;
  sectionListeners.forEach((listener) => listener(section));
}

export function setSelectedSignalId(id: number | null) {
  currentSignalId = id;
  signalListeners.forEach((listener) => listener(id));
}

export function useSection(): [Section, (section: Section) => void] {
  const [section, setLocal] = useState(currentSection);
  useEffect(() => {
    sectionListeners.add(setLocal);
    return () => {
      sectionListeners.delete(setLocal);
    };
  }, []);
  return [section, setSection];
}

export function useSelectedSignalId(): [number | null, (id: number | null) => void] {
  const [id, setLocal] = useState(currentSignalId);
  useEffect(() => {
    signalListeners.add(setLocal);
    return () => {
      signalListeners.delete(setLocal);
    };
  }, []);
  return [id, setSelectedSignalId];
}
