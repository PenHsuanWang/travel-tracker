/**
 * ThemeContext - Context-aware theming based on route
 * 
 * Reference: UNIFY_THEME_AND_PAGE_DETAIL_DESIGN_DOCUMENT.md Section 5.5
 * 
 * This provider automatically detects the current route and sets the appropriate
 * theme context (trip/plan). Components using CSS variables with --color-brand
 * will automatically adapt to the correct theme colors.
 * 
 * Usage:
 *   // In App.js, wrap routes with ThemeProvider
 *   <ThemeProvider>
 *     <Routes>...</Routes>
 *   </ThemeProvider>
 * 
 *   // In components, access theme if needed
 *   const { theme } = useTheme();
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

const ThemeContext = createContext({ theme: 'trip' });

/**
 * ThemeProvider - Wraps children with theme context based on current route
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to wrap
 * @returns {React.ReactElement}
 */
export const ThemeProvider = ({ children }) => {
  const location = useLocation();
  
  const theme = useMemo(() => {
    // Detect plan routes and set plan theme
    if (location.pathname.startsWith('/plans')) return 'plan';
    // Default to trip theme for all other routes
    return 'trip';
  }, [location.pathname]);
  
  const value = useMemo(() => ({ theme }), [theme]);
  
  return (
    <ThemeContext.Provider value={value}>
      <div data-theme={theme} style={{ minHeight: '100%' }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

/**
 * useTheme - Hook to access current theme context
 * 
 * @returns {{ theme: 'trip' | 'plan' }}
 * 
 * @example
 * const { theme } = useTheme();
 * console.log(theme); // 'trip' or 'plan'
 */
export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
