import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ClientDashboardPage } from '../pages/ClientDashboardPage';
import { clientApi } from '../lib/client-api';

describe('ClientDashboardPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders client console overview in INR and lets user inspect a transaction detail panel', async () => {
    vi.spyOn(clientApi, 'getSession').mockResolvedValue({
      user: {
        id: 'usr_1',
        organization_id: 'org_aarohan_bank',
        organizationName: 'Aarohan Bank Ltd',
        email: 'admin@aarohanbank.in',
        fullName: 'Aarohan Admin',
        role: 'client_admin',
      },
    });

    vi.spyOn(clientApi, 'getSummary').mockResolvedValue({
      organizationName: 'Aarohan Bank Ltd',
      days: 30,
      totalTransactions: 142,
      totalValuePaise: 1250000000, // ₹1.25 Cr
      blockedCount: 19,
      suspiciousCount: 14,
      dailySeries: [
        { date: '2026-11-23', total: 12, blocked: 2 },
        { date: '2026-11-24', total: 16, blocked: 3 },
      ],
      latestBlocked: [
        {
          id: 'tx_blocked_1',
          organization_id: 'org_aarohan_bank',
          appId: 'app_mobile',
          appName: 'Mobile App',
          timestamp: '2026-11-24T10:15:00.000Z',
          customerRef: 'CUST-8841',
          action: 'RTGS Wire',
          amountPaise: 45000000, // ₹4,50,000
          status: 'Blocked',
          reason: 'Synthetic voice artifacts detected during high-value transfer.',
          riskLevel: 'High',
          whatHappenedNext: 'Request stopped immediately and fraud desk alerted.',
        },
      ],
      latestSuspicious: [],
    });

    vi.spyOn(clientApi, 'getTransactionById').mockResolvedValue({
      item: {
        id: 'tx_blocked_1',
        organization_id: 'org_aarohan_bank',
        appId: 'app_mobile',
        appName: 'Mobile App',
        timestamp: '2026-11-24T10:15:00.000Z',
        customerRef: 'CUST-8841',
        action: 'RTGS Wire',
        amountPaise: 45000000,
        status: 'Blocked',
        reason: 'Synthetic voice artifacts detected during high-value transfer.',
        riskLevel: 'High',
        whatHappenedNext: 'Request stopped immediately and fraud desk alerted.',
      },
    });

    render(<ClientDashboardPage onNavigateHome={vi.fn()} onToast={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Aarohan Bank Ltd')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('₹1.25 Cr')).toBeInTheDocument();
    });
    expect(screen.getByText(/RTGS Wire · CUST-8841/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/RTGS Wire · CUST-8841/i));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Transaction detail/i })).toBeInTheDocument();
    });

    expect(screen.getByText('What happened next')).toBeInTheDocument();
    expect(
      screen.getByText(/Request stopped immediately and fraud desk alerted/i)
    ).toBeInTheDocument();
  });

  it('disables voice and app mutations when signed in as client_viewer', async () => {
    vi.spyOn(clientApi, 'getSession').mockResolvedValue({
      user: {
        id: 'usr_2',
        organization_id: 'org_aarohan_bank',
        organizationName: 'Aarohan Bank Ltd',
        email: 'viewer@aarohanbank.in',
        fullName: 'Aarohan Viewer',
        role: 'client_viewer',
      },
    });

    vi.spyOn(clientApi, 'getSummary').mockResolvedValue({
      organizationName: 'Aarohan Bank Ltd',
      days: 30,
      totalTransactions: 10,
      totalValuePaise: 100000,
      blockedCount: 1,
      suspiciousCount: 1,
      dailySeries: [{ date: '2026-11-24', total: 10, blocked: 1 }],
      latestBlocked: [],
      latestSuspicious: [],
    });

    vi.spyOn(clientApi, 'getApps').mockResolvedValue({
      items: [
        {
          id: 'app_mobile',
          organization_id: 'org_aarohan_bank',
          name: 'Mobile App',
          type: 'mobile_app',
          status: 'Active',
          transactionsCount: 80,
          blockedCount: 9,
          lastActiveAt: '2026-11-24T09:00:00.000Z',
        },
      ],
    });

    render(<ClientDashboardPage onNavigateHome={vi.fn()} onToast={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Client Viewer · Read only/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Apps' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Rotate key/i })).toBeDisabled();
    });
  });
});
