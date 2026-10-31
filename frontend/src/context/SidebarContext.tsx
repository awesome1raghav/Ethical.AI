"use client";

import React, { createContext, useContext, useState } from "react";

const SidebarContext = createContext<{
  isSidebarHidden: boolean;
  setSidebarHidden: (val: boolean) => void;
}>({
  isSidebarHidden: false,
  setSidebarHidden: () => {},
});

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarHidden, setSidebarHidden] = useState(false);
  return (
    <SidebarContext.Provider value={{ isSidebarHidden, setSidebarHidden }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);
