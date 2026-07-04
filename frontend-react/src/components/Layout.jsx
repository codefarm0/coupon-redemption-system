import {
  AppBar, Toolbar, Typography, Tabs, Tab, Container,
  Box,
} from '@mui/material';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';

function Layout({ activeTab, onTabChange, children }) {
  return (
    <>
      <AppBar position="sticky" elevation={1}>
        <Toolbar>
          <ConfirmationNumberIcon sx={{ mr: 1.5 }} />
          <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1 }}>
            Coupon Redemption System
          </Typography>
        </Toolbar>
        <Tabs
          value={activeTab}
          onChange={(_, v) => onTabChange(v)}
          textColor="inherit"
          indicatorColor="secondary"
          sx={{ px: 2 }}
        >
          <Tab label="Coupons" />
          <Tab label="Redemption History" />
        </Tabs>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {children}
      </Container>
    </>
  );
}

export default Layout;
