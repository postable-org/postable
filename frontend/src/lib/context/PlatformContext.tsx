'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface PlatformContextValue {
  platform: string;
  setPlatform: (p: string) => void;
}

const PlatformContext = createContext<PlatformContextValue>({
  platform: 'instagram',
  setPlatform: () => {},
});

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [platform, setPlatform] = useState('instagram');
  return (
    <PlatformContext.Provider value={{ platform, setPlatform }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  return useContext(PlatformContext);
}
