import {
  AppBar,
  Avatar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import WidgetsOutlinedIcon from '@mui/icons-material/WidgetsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import FmdGoodOutlinedIcon from '@mui/icons-material/FmdGoodOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { authStorage } from '../auth/authStorage';
import { useDashboardSummaryQuery } from '../api/queries';

type NavItem = {
  to: string;
  label: string;
  perm: string;
  icon: ReactNode;
  notificationCount?: number;
};

const drawerWidth = 248;

export function AppShell() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const location = useLocation();
  const { user, logout, can, isLoggingOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [seenPending, setSeenPending] = useState<{
    adjustments: number;
    transfers: number;
    purchaseOrders: number;
  }>({ adjustments: 0, transfers: 0, purchaseOrders: 0 });

  const canDashboardView = can('USER_VIEW');
  const dashboardSummaryQuery = useDashboardSummaryQuery({}, canDashboardView);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      setSeenPending({ adjustments: 0, transfers: 0, purchaseOrders: 0 });
      return;
    }
    const refreshSeen = () => {
      setSeenPending(authStorage.getSeenPending(userId));
    };

    refreshSeen();

    const onSeenUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: number }>;
      const eventUserId = Number(custom.detail?.userId ?? 0);
      if (eventUserId && eventUserId !== userId) return;
      refreshSeen();
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key || !event.key.startsWith('mv_seen_pending_v1:')) return;
      refreshSeen();
    };

    window.addEventListener('mv_seen_pending_updated', onSeenUpdated as EventListener);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('mv_seen_pending_updated', onSeenUpdated as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, [user?.id]);

  const newPendingCounts = useMemo(
    () => ({
      adjustments: can('ADJUSTMENT_VIEW')
        ? (dashboardSummaryQuery.data?.approval_queue.adjustments ?? []).filter(
            (row) => Number(row.id ?? 0) > seenPending.adjustments
          ).length
        : 0,
      transfers: can('TRANSFER_VIEW')
        ? (dashboardSummaryQuery.data?.approval_queue.transfers ?? []).filter(
            (row) => Number(row.id ?? 0) > seenPending.transfers
          ).length
        : 0,
      purchaseOrders: can('PO_VIEW')
        ? (dashboardSummaryQuery.data?.approval_queue.purchase_orders ?? []).filter(
            (row) => Number(row.id ?? 0) > seenPending.purchaseOrders
          ).length
        : 0,
    }),
    [can, dashboardSummaryQuery.data, seenPending.adjustments, seenPending.purchaseOrders, seenPending.transfers]
  );

  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', perm: 'USER_VIEW', icon: <DashboardOutlinedIcon /> },
    { to: '/inventory', label: 'Inventory', perm: 'INVENTORY_VIEW', icon: <Inventory2OutlinedIcon /> },
    { to: '/products', label: 'Products', perm: 'PRODUCT_VIEW', icon: <StorefrontOutlinedIcon /> },
    { to: '/variants', label: 'Variants', perm: 'PRODUCT_VIEW', icon: <WidgetsOutlinedIcon /> },
    {
      to: '/adjustments',
      label: 'Adjustments',
      perm: 'ADJUSTMENT_VIEW',
      icon: <ReceiptLongOutlinedIcon />,
      notificationCount: newPendingCounts.adjustments,
    },
    {
      to: '/transfers',
      label: 'Transfers',
      perm: 'TRANSFER_VIEW',
      icon: <SwapHorizOutlinedIcon />,
      notificationCount: newPendingCounts.transfers,
    },
    {
      to: '/purchase-orders',
      label: 'Purchase Orders',
      perm: 'PO_VIEW',
      icon: <LocalShippingOutlinedIcon />,
      notificationCount: newPendingCounts.purchaseOrders,
    },
    { to: '/suppliers', label: 'Suppliers', perm: 'SUPPLIER_VIEW', icon: <ApartmentOutlinedIcon /> },
    { to: '/branches', label: 'Branches', perm: 'BRANCH_MANAGE', icon: <FmdGoodOutlinedIcon /> },
    { to: '/accounts', label: 'Accounts', perm: 'USER_VIEW', icon: <GroupOutlinedIcon /> },
    { to: '/ledger', label: 'Ledger', perm: 'LEDGER_VIEW', icon: <AccountTreeOutlinedIcon /> },
  ];

  const availableNav = navItems.filter((item) => can(item.perm));

  const activeLabel = useMemo(() => {
    const hit = availableNav.find((item) =>
      location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
    );
    return hit?.label ?? 'Dashboard';
  }, [availableNav, location.pathname]);

  const mobileQuickNav = useMemo(() => availableNav.slice(0, 4), [availableNav]);

  const mobileNavValue = useMemo(() => {
    const hit = mobileQuickNav.find((item) =>
      location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
    );
    return hit?.to ?? '';
  }, [mobileQuickNav, location.pathname]);

  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const navDrawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2.5, py: 2 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.1em' }}>
          MAD VAPERS
        </Typography>
        <Typography variant="h6" sx={{ lineHeight: 1.15 }}>
          Inventory System
        </Typography>
      </Box>

      <Divider />

      <List sx={{ px: 1.2, py: 1.5, flexGrow: 1 }}>
        {availableNav.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            onClick={() => !isDesktop && setMobileOpen(false)}
            sx={{
              mb: 0.4,
              borderRadius: 2,
              color: 'text.secondary',
              '& .MuiListItemIcon-root': {
                color: 'text.secondary',
                minWidth: 34,
              },
              '&.active': {
                backgroundColor: alpha(theme.palette.primary.main, 0.12),
                color: 'primary.main',
                '& .MuiListItemIcon-root': {
                  color: 'primary.main',
                },
              },
            }}
          >
            <ListItemIcon>
              {(item.notificationCount ?? 0) > 0 ? (
                <Badge color="error" badgeContent={item.notificationCount} max={99} overlap="circular">
                  <Box component="span" sx={{ display: 'inline-flex' }}>
                    {item.icon}
                  </Box>
                </Badge>
              ) : (
                item.icon
              )}
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>

      <Box sx={{ px: 2, pb: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Scanner-first workflow enabled.
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        sx={{
          ml: { lg: `${drawerWidth}px` },
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          backgroundColor: alpha('#ffffff', 0.9),
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, md: 68 }, px: { xs: 1, md: 2 } }}>
          {!isDesktop && (
            <IconButton onClick={() => setMobileOpen(true)} sx={{ mr: 1.2 }} edge="start">
              <MenuRoundedIcon />
            </IconButton>
          )}

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {activeLabel}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}
            >
              Fast retail operations with keyboard and scanner-first flow
            </Typography>
          </Box>

          <Stack direction="row" spacing={{ xs: 0.75, md: 1 }} alignItems="center">
            {user?.role?.code && (
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={user.role.code}
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
              />
            )}
            <Tooltip title={user?.name ?? ''}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 13 }}>{initials}</Avatar>
            </Tooltip>
            <Button
              color="inherit"
              variant="outlined"
              onClick={() => void logout()}
              size="small"
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isDesktop ? 'permanent' : 'temporary'}
        open={isDesktop ? true : mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: { xs: '84vw', lg: drawerWidth },
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: { xs: '84vw', lg: drawerWidth },
            maxWidth: { xs: 320, lg: drawerWidth },
            boxSizing: 'border-box',
          },
        }}
      >
        {navDrawer}
      </Drawer>

      <Box
        component="main"
        sx={{
          ml: { lg: `${drawerWidth}px` },
          pt: { xs: 10, md: 11 },
          px: { xs: 1.5, md: 3 },
          pb: { xs: 11, md: 3 },
        }}
      >
        <Box sx={{ maxWidth: 1680, mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>

      {!isDesktop && mobileQuickNav.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: (t) => t.zIndex.appBar,
            pb: 'env(safe-area-inset-bottom)',
            px: 1,
          }}
        >
          <Box
            sx={{
              borderRadius: '14px 14px 0 0',
              border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
              borderBottom: 0,
              bgcolor: alpha('#ffffff', 0.96),
              backdropFilter: 'blur(10px)',
            }}
          >
            <BottomNavigation value={mobileNavValue} showLabels>
              {mobileQuickNav.map((item) => (
                <BottomNavigationAction
                  key={item.to}
                  value={item.to}
                  label={item.label}
                  icon={
                    (item.notificationCount ?? 0) > 0 ? (
                      <Badge color="error" badgeContent={item.notificationCount} max={99} overlap="circular">
                        <Box component="span" sx={{ display: 'inline-flex' }}>
                          {item.icon}
                        </Box>
                      </Badge>
                    ) : (
                      item.icon
                    )
                  }
                  component={NavLink}
                  to={item.to}
                />
              ))}
            </BottomNavigation>
          </Box>
        </Box>
      )}
    </Box>
  );
}
