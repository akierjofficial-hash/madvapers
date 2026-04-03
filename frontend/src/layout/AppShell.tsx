import {
  AppBar,
  Avatar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Chip,
  Collapse,
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
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import FmdGoodOutlinedIcon from '@mui/icons-material/FmdGoodOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { authStorage } from '../auth/authStorage';
import { useDashboardApprovalQueueQuery, useDashboardSummaryQuery } from '../api/queries';

type NavItem = {
  to: string;
  label: string;
  perm: string;
  icon: ReactNode;
  notificationCount?: number;
  notificationSubtitle?: string;
  allowRoleCodes?: string[];
  requiresAnyPerms?: string[];
};

const drawerWidth = 248;
const SECONDARY_NAV_PATHS = new Set(['/suppliers', '/branches', '/accounts', '/audit-logs', '/ledger']);
const ADMIN_MOBILE_FIXED_PATHS = ['/dashboard', '/approvals', '/analytics'] as const;
const ADMIN_MOBILE_MENU_VALUE = '__menu__';

export function AppShell() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, can, isLoggingOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(() => {
    const stored = authStorage.getLastBranchId();
    return typeof stored === 'number' && Number.isFinite(stored) && stored > 0 ? stored : null;
  });

  const canDashboardView = can('USER_VIEW');
  // Query both scopes to avoid branch-filter mismatch between pages and sidebar badges.
  const approvalQueueGlobalQuery = useDashboardApprovalQueueQuery({}, canDashboardView);
  const approvalQueueBranchQuery = useDashboardApprovalQueueQuery(
    { branch_id: selectedBranchId ?? undefined },
    canDashboardView && !!selectedBranchId
  );
  const dashboardSummaryQuery = useDashboardSummaryQuery({}, canDashboardView);
  const roleCode = String(user?.role?.code ?? '').toUpperCase();
  const isCashierRole = roleCode === 'CASHIER';

  const readCount = (
    data: any,
    key: 'adjustments' | 'transfers' | 'purchase_orders' | 'void_requests'
  ): number => {
    if (!data) return 0;
    const fromCounts = Number(data?.counts?.[key] ?? 0);
    if (Number.isFinite(fromCounts) && fromCounts > 0) return fromCounts;
    const fromRows = Number(data?.approval_queue?.[key]?.length ?? 0);
    return Number.isFinite(fromRows) ? fromRows : 0;
  };

  const countFor = (
    key: 'adjustments' | 'transfers' | 'purchase_orders' | 'void_requests'
  ): number =>
    Math.max(
      readCount(approvalQueueGlobalQuery.data, key),
      readCount(approvalQueueBranchQuery.data, key)
    );

  const readTotal = (data: any): number => {
    if (!data) return 0;
    const explicit = Number(data?.counts?.total ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    return (
      readCount(data, 'adjustments') +
      readCount(data, 'transfers') +
      readCount(data, 'purchase_orders') +
      readCount(data, 'void_requests')
    );
  };

  const pendingCounts = useMemo(
    () => ({
      adjustments: can('ADJUSTMENT_VIEW')
        ? countFor('adjustments')
        : 0,
      transfers: can('TRANSFER_VIEW')
        ? countFor('transfers')
        : 0,
      purchaseOrders: can('PO_VIEW')
        ? countFor('purchase_orders')
        : 0,
      voidRequests: can('SALES_VOID')
        ? Math.max(
            countFor('void_requests'),
            Number(dashboardSummaryQuery.data?.kpis?.pending_void_requests ?? 0)
          )
        : 0,
    }),
    [approvalQueueBranchQuery.data, approvalQueueGlobalQuery.data, can, dashboardSummaryQuery.data]
  );
  const approvalsBadgeCount = Math.max(
    0,
    readTotal(approvalQueueGlobalQuery.data),
    readTotal(approvalQueueBranchQuery.data)
  );
  const pendingVoidRequestBranchSubtitle = useMemo(() => {
    const rows = [
      ...(approvalQueueGlobalQuery.data?.approval_queue?.void_requests ?? []),
      ...(approvalQueueBranchQuery.data?.approval_queue?.void_requests ?? []),
    ];

    const labelSet = new Set<string>();
    for (const row of rows) {
      const status = String((row as any)?.void_request_status ?? '').toUpperCase();
      if (status && status !== 'PENDING') continue;
      const branchName = String((row as any)?.branch_name ?? '').trim();
      const branchId = Number((row as any)?.branch_id ?? 0);
      if (branchName) {
        labelSet.add(branchName);
        continue;
      }
      if (Number.isFinite(branchId) && branchId > 0) {
        labelSet.add(`Branch #${branchId}`);
      }
    }

    const labels = Array.from(labelSet);
    if (labels.length === 0) return undefined;
    if (labels.length <= 2) return `From: ${labels.join(', ')}`;
    return `From: ${labels.slice(0, 2).join(', ')} +${labels.length - 2} more`;
  }, [approvalQueueBranchQuery.data, approvalQueueGlobalQuery.data]);

  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', perm: 'USER_VIEW', icon: <DashboardOutlinedIcon /> },
    {
      to: '/approvals',
      label: 'Approvals',
      perm: 'USER_VIEW',
      icon: <GavelOutlinedIcon />,
      notificationCount: approvalsBadgeCount,
      requiresAnyPerms: ['ADJUSTMENT_APPROVE', 'TRANSFER_APPROVE', 'PO_APPROVE', 'SALES_VOID'],
    },
    {
      to: '/analytics',
      label: 'Analytics',
      perm: 'USER_VIEW',
      icon: <QueryStatsOutlinedIcon />,
      allowRoleCodes: ['ADMIN'],
    },
    { to: '/inventory', label: 'Inventory', perm: 'INVENTORY_VIEW', icon: <Inventory2OutlinedIcon /> },
    { to: '/products', label: 'Products', perm: 'PRODUCT_VIEW', icon: <StorefrontOutlinedIcon /> },
    { to: '/variants', label: 'Variants', perm: 'PRODUCT_VIEW', icon: <WidgetsOutlinedIcon /> },
    {
      to: '/adjustments',
      label: 'Adjustments',
      perm: 'ADJUSTMENT_VIEW',
      icon: <ReceiptLongOutlinedIcon />,
      notificationCount: pendingCounts.adjustments,
    },
    {
      to: '/transfers',
      label: 'Transfers',
      perm: 'TRANSFER_VIEW',
      icon: <SwapHorizOutlinedIcon />,
      notificationCount: pendingCounts.transfers,
    },
    {
      to: '/purchase-orders',
      label: 'Purchase Orders',
      perm: 'PO_VIEW',
      icon: <LocalShippingOutlinedIcon />,
      notificationCount: pendingCounts.purchaseOrders,
    },
    {
      to: '/sales',
      label: 'Sales',
      perm: 'SALES_VIEW',
      icon: <PointOfSaleOutlinedIcon />,
      notificationCount: pendingCounts.voidRequests,
      notificationSubtitle: pendingCounts.voidRequests > 0 ? pendingVoidRequestBranchSubtitle : undefined,
    },
    { to: '/expenses', label: 'Expenses', perm: 'EXPENSE_VIEW', icon: <RequestQuoteOutlinedIcon /> },
    { to: '/suppliers', label: 'Suppliers', perm: 'SUPPLIER_VIEW', icon: <ApartmentOutlinedIcon /> },
    { to: '/branches', label: 'Branches', perm: 'BRANCH_MANAGE', icon: <FmdGoodOutlinedIcon /> },
    { to: '/accounts', label: 'Accounts', perm: 'USER_VIEW', icon: <GroupOutlinedIcon /> },
    { to: '/audit-logs', label: 'Audit Logs', perm: 'AUDIT_VIEW', icon: <FactCheckOutlinedIcon /> },
    { to: '/ledger', label: 'Ledger', perm: 'LEDGER_VIEW', icon: <AccountTreeOutlinedIcon /> },
  ];

  const availableNav = navItems.filter((item) => {
    if (!can(item.perm)) return false;
    if (item.requiresAnyPerms?.length) {
      const hasAnyRequiredPerm = item.requiresAnyPerms.some((perm) => can(perm));
      if (!hasAnyRequiredPerm) return false;
    }
    if (item.allowRoleCodes?.length) {
      const allowed = item.allowRoleCodes.map((code) => code.toUpperCase()).includes(roleCode);
      if (!allowed) return false;
    }
    if (isCashierRole && item.to !== '/sales') return false;
    return true;
  });

  const isRouteActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  const primaryNav = useMemo(
    () => availableNav.filter((item) => !SECONDARY_NAV_PATHS.has(item.to)),
    [availableNav]
  );

  const secondaryNav = useMemo(
    () => availableNav.filter((item) => SECONDARY_NAV_PATHS.has(item.to)),
    [availableNav]
  );

  useEffect(() => {
    if (secondaryNav.some((item) => isRouteActive(item.to))) {
      setSecondaryOpen(true);
    }
  }, [secondaryNav, location.pathname]);

  useEffect(() => {
    const syncFromStorage = () => {
      const stored = authStorage.getLastBranchId();
      const next = typeof stored === 'number' && Number.isFinite(stored) && stored > 0 ? stored : null;
      setSelectedBranchId((prev) => (prev === next ? prev : next));
    };

    const onBranchChanged = () => syncFromStorage();
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'mv_last_branch_id') syncFromStorage();
    };

    window.addEventListener('mv_branch_changed', onBranchChanged as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('mv_branch_changed', onBranchChanged as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    const refreshApprovalSignals = () => {
      void approvalQueueGlobalQuery.refetch();
      if (selectedBranchId) {
        void approvalQueueBranchQuery.refetch();
      }
      void dashboardSummaryQuery.refetch();
    };

    const onPing = () => refreshApprovalSignals();
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'mv_approval_queue_ping_at') {
        refreshApprovalSignals();
      }
    };

    window.addEventListener('mv_approval_queue_ping', onPing as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('mv_approval_queue_ping', onPing as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, [
    approvalQueueBranchQuery,
    approvalQueueGlobalQuery,
    dashboardSummaryQuery,
    selectedBranchId,
  ]);

  const activeLabel = useMemo(() => {
    const hit = availableNav.find((item) => isRouteActive(item.to));
    return hit?.label ?? (isCashierRole ? 'Sales' : 'Dashboard');
  }, [availableNav, isCashierRole, location.pathname]);

  const mobileQuickNav = useMemo(() => {
    if (isCashierRole) return availableNav.slice(0, 4);
    return ADMIN_MOBILE_FIXED_PATHS
      .map((path) => availableNav.find((item) => item.to === path))
      .filter((item): item is NavItem => !!item);
  }, [availableNav, isCashierRole]);

  const mobileMenuNav = useMemo(
    () =>
      availableNav.filter(
        (item) => !ADMIN_MOBILE_FIXED_PATHS.includes(item.to as (typeof ADMIN_MOBILE_FIXED_PATHS)[number])
      ),
    [availableNav]
  );
  const mobileMenuHasNotifications = useMemo(
    () => mobileMenuNav.some((item) => Number(item.notificationCount ?? 0) > 0),
    [mobileMenuNav]
  );

  const mobileNavValue = useMemo(() => {
    if (!isCashierRole) {
      const fixedHit = mobileQuickNav.find((item) => isRouteActive(item.to));
      if (fixedHit) return fixedHit.to;
      if (mobileMenuNav.some((item) => isRouteActive(item.to))) return ADMIN_MOBILE_MENU_VALUE;
      return '';
    }
    const hit = mobileQuickNav.find((item) => isRouteActive(item.to));
    return hit?.to ?? '';
  }, [isCashierRole, mobileMenuNav, mobileQuickNav, location.pathname]);

  const handleMobileNavChange = (_: React.SyntheticEvent, value: string) => {
    if (!value) return;

    if (!isCashierRole) {
      if (value === ADMIN_MOBILE_MENU_VALUE) {
        setMobileMenuOpen(true);
        return;
      }
      setMobileMenuOpen(false);
      navigate(value);
      return;
    }

    navigate(value);
  };

  useEffect(() => {
    if (mobileMenuOpen) setMobileMenuOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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

      <List sx={{ px: 1.1, py: 1.25, flexGrow: 1, overflowY: 'auto' }}>
        {primaryNav.map((item) => (
          (() => {
            const count = Math.max(0, Number(item.notificationCount ?? 0));
            return (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            sx={{
              mb: 0.25,
              borderRadius: 2,
              minHeight: item.notificationSubtitle ? 48 : 40,
              color: 'text.secondary',
              px: 1.1,
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
              {count > 0 ? (
                <Badge color="error" variant="dot" overlap="circular">
                  <Box component="span" sx={{ display: 'inline-flex' }}>
                    {item.icon}
                  </Box>
                </Badge>
              ) : (
                item.icon
              )}
            </ListItemIcon>
            <ListItemText
              primary={
                <Stack
                  direction="row"
                  alignItems={item.notificationSubtitle ? 'flex-start' : 'center'}
                  justifyContent="space-between"
                  spacing={0.8}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Box component="span">{item.label}</Box>
                    {item.notificationSubtitle ? (
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          mt: 0.1,
                          color: 'text.secondary',
                          lineHeight: 1.1,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 140,
                        }}
                      >
                        {item.notificationSubtitle}
                      </Typography>
                    ) : null}
                  </Box>
                  {count > 0 ? (
                    <Box
                      component="span"
                      sx={{
                        minWidth: 20,
                        px: 0.7,
                        height: 20,
                        borderRadius: 10,
                        bgcolor: 'error.main',
                        color: 'error.contrastText',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        lineHeight: 1,
                      }}
                    >
                      {count > 99 ? '99+' : count}
                    </Box>
                  ) : null}
                </Stack>
              }
            />
          </ListItemButton>
            );
          })()
        ))}

        {secondaryNav.length > 0 && (
          <>
            <ListItemButton
              onClick={() => setSecondaryOpen((open) => !open)}
              sx={{
                mt: 0.25,
                mb: 0.15,
                borderRadius: 2,
                minHeight: 40,
                px: 1.1,
                color: 'text.secondary',
              }}
            >
              <ListItemIcon sx={{ color: 'text.secondary', minWidth: 34 }}>
                <AccountTreeOutlinedIcon />
              </ListItemIcon>
              <ListItemText
                primary="More Pages"
                secondary={`${secondaryNav.length} modules`}
                primaryTypographyProps={{ fontWeight: 600 }}
              />
              {secondaryOpen ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
            </ListItemButton>

            <Collapse in={secondaryOpen} timeout="auto" unmountOnExit>
              <List disablePadding sx={{ pt: 0.2 }}>
                {secondaryNav.map((item) => (
                  (() => {
                    const count = Math.max(0, Number(item.notificationCount ?? 0));
                    return (
                  <ListItemButton
                    key={item.to}
                    component={NavLink}
                    to={item.to}
                    sx={{
                      mb: 0.2,
                      ml: 0.8,
                      borderRadius: 2,
                      minHeight: 38,
                      color: 'text.secondary',
                      '& .MuiListItemIcon-root': {
                        color: 'text.secondary',
                        minWidth: 32,
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
                      {count > 0 ? (
                        <Badge color="error" variant="dot" overlap="circular">
                          <Box component="span" sx={{ display: 'inline-flex' }}>
                            {item.icon}
                          </Box>
                        </Badge>
                      ) : (
                        item.icon
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={0.8}>
                          <Box component="span">{item.label}</Box>
                          {count > 0 ? (
                            <Box
                              component="span"
                              sx={{
                                minWidth: 18,
                                px: 0.6,
                                height: 18,
                                borderRadius: 9,
                                bgcolor: 'error.main',
                                color: 'error.contrastText',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 700,
                                lineHeight: 1,
                              }}
                            >
                              {count > 99 ? '99+' : count}
                            </Box>
                          ) : null}
                        </Stack>
                      }
                    />
                  </ListItemButton>
                    );
                  })()
                ))}
              </List>
            </Collapse>
          </>
        )}
      </List>

      <Box sx={{ px: 2, pb: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Scanner-first workflow enabled.
        </Typography>
      </Box>
    </Box>
  );
  const showDesktopDrawer = isDesktop && !isCashierRole;

  return (
    <Box className="mobile-shell-root" sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        className="mobile-shell-topbar"
        position="fixed"
        sx={{
          ml: showDesktopDrawer ? { lg: `${drawerWidth}px` } : undefined,
          width: showDesktopDrawer ? { lg: `calc(100% - ${drawerWidth}px)` } : undefined,
          backgroundColor: alpha('#ffffff', 0.9),
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, md: 68 }, px: { xs: 1, md: 2 } }}>
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
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Button>
            <Tooltip title={isLoggingOut ? 'Logging out...' : 'Logout'}>
              <span>
                <IconButton
                  color="inherit"
                  onClick={() => void logout()}
                  disabled={isLoggingOut}
                  sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
                >
                  <LogoutRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      {showDesktopDrawer && (
        <Drawer
          variant="permanent"
          open
          PaperProps={{ className: 'mobile-shell-drawer' }}
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
        >
          {navDrawer}
        </Drawer>
      )}

      <Box
        component="main"
        className="mobile-shell-main"
        sx={{
          ml: showDesktopDrawer ? { lg: `${drawerWidth}px` } : undefined,
          pt: { xs: 10, md: 11 },
          px: { xs: 1.5, md: 3 },
          pb: { xs: 'calc(88px + env(safe-area-inset-bottom))', md: 3 },
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
            px: isPhone ? 0.6 : 1,
          }}
        >
          <Box
            className="mobile-shell-bottom-nav"
            sx={{
              borderRadius: '14px 14px 0 0',
              border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
              borderBottom: 0,
              bgcolor: alpha('#ffffff', 0.96),
              backdropFilter: 'blur(10px)',
            }}
          >
            <BottomNavigation value={mobileNavValue} onChange={handleMobileNavChange} showLabels>
              {mobileQuickNav.map((item) => (
                <BottomNavigationAction
                  key={item.to}
                  value={item.to}
                  label={item.label}
                  icon={
                    (item.notificationCount ?? 0) > 0 ? (
                      <Badge
                        color="error"
                        variant={item.to === '/sales' ? 'dot' : undefined}
                        badgeContent={item.to === '/sales' ? undefined : item.notificationCount}
                        max={99}
                        overlap="circular"
                      >
                        <Box component="span" sx={{ display: 'inline-flex' }}>
                          {item.icon}
                        </Box>
                      </Badge>
                    ) : (
                      item.icon
                    )
                  }
                />
              ))}
              {!isCashierRole && (
                <BottomNavigationAction
                  key={ADMIN_MOBILE_MENU_VALUE}
                  value={ADMIN_MOBILE_MENU_VALUE}
                  label="Menu"
                  icon={
                    mobileMenuHasNotifications ? (
                      <Badge color="error" variant="dot" overlap="circular">
                        <Box component="span" sx={{ display: 'inline-flex' }}>
                          <MenuRoundedIcon />
                        </Box>
                      </Badge>
                    ) : (
                      <MenuRoundedIcon />
                    )
                  }
                />
              )}
            </BottomNavigation>
          </Box>
        </Box>
      )}

      {!isDesktop && !isCashierRole && (
        <Drawer
          anchor="bottom"
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          PaperProps={{ className: 'mobile-admin-menu-sheet' }}
        >
          <Box sx={{ px: 1.5, pt: 1.2, pb: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Menu
            </Typography>
            <IconButton size="small" onClick={() => setMobileMenuOpen(false)}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
          <Divider />
          <List sx={{ px: 1, pt: 0.7, pb: 1.2, maxHeight: '70vh', overflowY: 'auto' }}>
            {mobileMenuNav.map((item) => {
              const count = Math.max(0, Number(item.notificationCount ?? 0));
              return (
                <ListItemButton
                  key={`mobile-menu-${item.to}`}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(item.to);
                  }}
                  sx={{
                    borderRadius: 2,
                    mb: 0.4,
                    minHeight: 44,
                    '&.active': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.12),
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 34 }}>
                    {count > 0 ? (
                      <Badge color="error" variant="dot" overlap="circular">
                        <Box component="span" sx={{ display: 'inline-flex' }}>
                          {item.icon}
                        </Box>
                      </Badge>
                    ) : (
                      item.icon
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    secondary={item.notificationSubtitle ?? undefined}
                    secondaryTypographyProps={{
                      noWrap: true,
                      sx: { color: 'text.secondary' },
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Drawer>
      )}
    </Box>
  );
}
