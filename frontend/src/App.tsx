import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  LayoutDashboard,
  Moon,
  Settings,
  Sun,
  User,
  WifiOff,
} from 'lucide-react';
import { apiClient, type CustomerUser } from './lib/api-client';
import { MetaGlassesPortalHero } from './components/MetaGlassesPortalHero';
import { OrbitHero } from './components/OrbitHero';
import { LiveStatsStrip } from './components/LiveStatsStrip';
import { ScrollProgressBar } from './components/skiper/ScrollProgressBar';
import { DynamicIslandPill } from './components/skiper/DynamicIslandPill';
import { ExpandableTabsNav, type ExpandableTabItem } from './components/skiper/ExpandableTabsNav';
import { AuthPages } from './pages/AuthPages';
import { OnboardingWizard } from './pages/OnboardingWizard';
import { DashboardPage } from './pages/DashboardPage';
import { SecuritySettingsPage } from './pages/SecuritySettingsPage';
import { SecurityActivityPage } from './pages/SecurityActivityPage';
import { AccountPage } from './pages/AccountPage';
import { ClientDashboardPage } from './pages/ClientDashboardPage';
import { Button } from './components/ui/button';
import { Skeleton } from './components/ui/skeleton';

const LandingSections = React.lazy(() =>
  import('./components/LandingSections').then((m) => ({ default: m.LandingSections }))
);

interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

const APP_TABS: ExpandableTabItem[] = [
  { id: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: '/activity', label: 'Activity', icon: Activity },
  { id: '/settings', label: 'Settings', icon: Settings },
  { id: '/account', label: 'Account', icon: User },
];

function normalizeRoute(pathname: string): string {
  const clean = pathname.replace(/^\/app(?=\/|$)/, '') || '/';
  const valid = [
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/onboarding',
    '/dashboard',
    '/activity',
    '/settings',
    '/account',
    '/client',
  ];
  return valid.includes(clean) ? clean : '/';
}

export default function App() {
  const prefersReduced = useReducedMotion();
  const [route, setRoute] = useState<string>(() => normalizeRoute(window.location.pathname));
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeBandBg, setActiveBandBg] = useState<string>('var(--color-ink)');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = window.localStorage.getItem('sentinel_theme_v3');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore storage errors
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem('sentinel_theme_v3', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const addToast = useCallback((message: string, tone: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const navigate = useCallback((nextPath: string) => {
    const normalized = normalizeRoute(nextPath);
    if (window.location.pathname !== normalized) {
      window.history.pushState({}, '', normalized);
    }
    setRoute(normalized);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(normalizeRoute(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    apiClient
      .getSession()
      .then((res) => {
        setUser(res.user);
        setIsOffline(false);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setAuthChecked(true);
      });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleAuthenticated = (authedUser: CustomerUser) => {
    setUser(authedUser);
    if (!authedUser.onboardingComplete) {
      navigate('/onboarding');
    } else {
      navigate('/dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch {
      // ignore
    }
    setUser(null);
    addToast('Signed out safely', 'info');
    navigate('/');
  };

  const scrollToSection = (sectionId: string) => {
    if (route !== '/') {
      navigate('/');
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({
          behavior: prefersReduced ? 'auto' : 'smooth',
        });
      }, 120);
      return;
    }
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
    });
  };

  const isPortalRoute = ['/onboarding', '/dashboard', '/activity', '/settings', '/account'].includes(route);
  const isClientRoute = route === '/client';

  useEffect(() => {
    if (authChecked && isPortalRoute && !user) {
      navigate('/login');
    }
  }, [authChecked, isPortalRoute, user, navigate]);

  const shellBackground = route === '/' ? activeBandBg : 'var(--bg-paper)';

  return (
    <div
      style={route === '/' ? { backgroundColor: shellBackground } : undefined}
      className={`relative min-h-screen overflow-x-clip bg-[var(--bg-paper)] text-[var(--ink)] ${
        prefersReduced ? '' : 'transition-colors duration-500 ease-out'
      }`}
    >
      {/* Faint visible drafting grid across background (SVG pattern, zero CSS gradients) */}
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 h-full w-full text-[var(--ink)] opacity-[0.075]"
      >
        <defs>
          <pattern id="paper-research-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#paper-research-grid)" />
      </svg>

      <ScrollProgressBar />

      {/* 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-[var(--ink)] bg-[var(--bg-paper)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:gap-8 sm:px-6 lg:px-8">
          {/* Zone 1: Single-line Wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            className="font-display text-3xl font-black uppercase tracking-tight text-[var(--ink)] whitespace-nowrap shrink-0"
          >
            Sentinel
          </a>

          {/* Zone 2: Navigation */}
          {isPortalRoute && user ? (
            <ExpandableTabsNav
              tabs={APP_TABS}
              activeTab={route}
              onSelect={(tabRoute) => navigate(tabRoute)}
            />
          ) : isClientRoute ? (
            <div className="hidden md:flex items-center gap-4 font-mono text-base font-medium text-[var(--ink-muted)]">
              <span>Enterprise Client Portal</span>
              <span aria-hidden="true">·</span>
              <span>INR Reporting</span>
            </div>
          ) : (
            <nav
              aria-label="Primary navigation"
              className="hidden md:flex items-center gap-6 font-mono text-base font-medium text-[var(--ink-muted)]"
            >
              <a
                href="#overview"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('overview');
                }}
                className="hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Overview
              </a>
              <a
                href="#protects"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('protects');
                }}
                className="hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Protection
              </a>
              <a
                href="#how-it-works"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('how-it-works');
                }}
                className="hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Protocol
              </a>
              <a
                href="#simulator"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('simulator');
                }}
                className="hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Simulator
              </a>
              <a
                href="#faq"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('faq');
                }}
                className="hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Notes
              </a>
            </nav>
          )}

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            {isPortalRoute && user ? (
              <button
                type="button"
                onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
                className="inline-flex h-10 w-10 items-center justify-center border border-[var(--ink)] bg-[var(--bg-paper)] text-[var(--ink)] hover:bg-[var(--ink-subtle)] cursor-pointer"
              >
                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>
            ) : isClientRoute ? (
              <Button size="sm" variant="outline" onClick={() => navigate('/')}>
                Back to Sentinel
              </Button>
            ) : user ? (
              <Button size="sm" onClick={() => navigate('/dashboard')}>
                Open portal
              </Button>
            ) : (
              <Button size="sm" onClick={() => navigate('/register')}>
                Get started
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* API Offline Banner */}
      {isOffline && (
        <div
          role="alert"
          className="relative z-20 border-b border-[var(--accent-red)] bg-[var(--accent-red)] px-4 py-2 text-center font-mono text-base font-medium text-[var(--bg-paper)]"
        >
          <span className="inline-flex items-center gap-2">
            <WifiOff className="h-4 w-4" />
            Sentinel servers temporarily unreachable. Local demo simulation remains active.
          </span>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={route}
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {route === '/' && (
              <>
                <MetaGlassesPortalHero
                  onGetStarted={() => navigate('/register')}
                  onSignIn={() => navigate(user ? '/dashboard' : '/login')}
                  isSignedIn={Boolean(user)}
                  onBecomeActive={setActiveBandBg}
                />

                <div className="bg-[var(--color-ink)] pt-8">
                  <DynamicIslandPill />
                </div>

                <LiveStatsStrip onBecomeActive={setActiveBandBg} />

                <OrbitHero
                  onLearnMoreSection={scrollToSection}
                  onBecomeActive={setActiveBandBg}
                />

                <Suspense
                  fallback={
                    <div className="mx-auto max-w-6xl space-y-6 px-4 py-12">
                      <Skeleton className="h-72 w-full" />
                      <Skeleton className="h-52 w-full" />
                    </div>
                  }
                >
                  <LandingSections
                    onGetStarted={() => navigate('/register')}
                    onSignIn={() => navigate(user ? '/dashboard' : '/login')}
                    onNavigateClient={() => navigate('/client')}
                    onBecomeActive={setActiveBandBg}
                  />
                </Suspense>
              </>
            )}

            {route === '/client' && (
              <ClientDashboardPage
                onNavigateHome={() => navigate('/')}
                onToast={addToast}
              />
            )}

            {route === '/login' && (
              <AuthPages
                mode="login"
                onNavigate={navigate}
                onAuthenticated={handleAuthenticated}
                onToast={addToast}
                onOfflineDetected={setIsOffline}
              />
            )}

            {route === '/register' && (
              <AuthPages
                mode="register"
                onNavigate={navigate}
                onAuthenticated={handleAuthenticated}
                onToast={addToast}
                onOfflineDetected={setIsOffline}
              />
            )}

            {route === '/forgot-password' && (
              <AuthPages
                mode="forgot"
                onNavigate={navigate}
                onAuthenticated={handleAuthenticated}
                onToast={addToast}
                onOfflineDetected={setIsOffline}
              />
            )}

            {route === '/onboarding' && user && (
              <OnboardingWizard
                user={user}
                onUserUpdated={setUser}
                onComplete={() => navigate('/dashboard')}
                onToast={addToast}
              />
            )}

            {route === '/dashboard' && user && (
              <DashboardPage onToast={addToast} onOfflineDetected={setIsOffline} />
            )}

            {route === '/settings' && user && (
              <SecuritySettingsPage onToast={addToast} onOfflineDetected={setIsOffline} />
            )}

            {route === '/activity' && user && (
              <SecurityActivityPage onToast={addToast} onOfflineDetected={setIsOffline} />
            )}

            {route === '/account' && user && (
              <AccountPage
                user={user}
                onUserUpdated={setUser}
                onReEnroll={() => navigate('/onboarding')}
                onLogout={handleLogout}
                onToast={addToast}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Toast Stack */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={prefersReduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReduced ? undefined : { opacity: 0, y: 6 }}
              transition={{ duration: 0.16 }}
              className={`pointer-events-auto border px-4 py-2.5 font-mono text-base font-medium ${
                toast.tone === 'error'
                  ? 'border-[var(--accent-red)] bg-[var(--accent-red)] text-[var(--bg-paper)]'
                  : 'border-[var(--ink)] bg-[var(--bg-paper)] text-[var(--ink)]'
              }`}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
