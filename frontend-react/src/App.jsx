import { useState, useCallback } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import Layout from './components/Layout';
import CouponList from './components/CouponList';
import RedemptionHistory from './components/RedemptionHistory';

const theme = createTheme({
  palette: {
    primary: { main: '#1a237e' },
    secondary: { main: '#ff6f00' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: { borderRadius: 8 },
});

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 0 && <CouponList refreshKey={refreshKey} />}
        {activeTab === 1 && <RedemptionHistory key={refreshKey} />}
      </Layout>
    </ThemeProvider>
  );
}

export default App;
