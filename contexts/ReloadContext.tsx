import React from 'react'

export const ReloadContext = React.createContext<() => Promise<void>>(
  async () => {},
);
