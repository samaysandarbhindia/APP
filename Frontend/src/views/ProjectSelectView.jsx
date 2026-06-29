import { useEffect, useMemo, useRef, useState } from 'react';
import { useLethem } from '../contexts/LethemContext';
import { useAuth } from '../contexts/AuthContext';
import { LogoIcon } from '../components/parts/Logo';
import { cacheGet, cacheSet } from '../lib/cache';
import { IconBell, IconBilling, IconCheck, IconDemo, IconExternal, IconLogs, IconPlus, IconSearch, IconSettings, IconSubkey, IconTrash, IconUser } from '../components/parts/Icons';

export default function ProjectSelectView({ go }) {
  const {
    projects, projectSearch, setProjectSearch,
    filteredProjects, showPlanBanner, setShowPlanBanner,
    projectToDelete, setProjectToDelete,
    deleteConfirm, setDeleteConfirm, deleteProject,
    notif, notify, account, updateAccount,
    ctx: { API, fmtDate, fmtNum, billing, subkeys, masterKeys, analytics, copyText, copiedItem, invites, loadInvites, acceptInvite, revokeInvite, api },
  } = useLethem();
  const { user, logout, getAccessToken, isAuthenticated } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [accountUsage, setAccountUsage] = useState({ subkeys: 0, invitedSubkeys: 0, masterKeys: 0, invitedMasterKeys: 0, tokens: 0, invitedTokens: 0, requests: 0, invitedRequests: 0, loading: false });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [quotaRequests, setQuotaRequests] = useState([]);
  const [selectedInvite, setSelectedInvite] = useState(null);
  const [notificationBusy, setNotificationBusy] = useState('');
  const [notificationsSeenKey, setNotificationsSeenKey] = useState('');
  const notificationWrapRef = useRef(null);
  const onboardingCacheScope = user?.sub || 'anonymous';
  const onboardingDismissedKey = '/console-page/getting-started-dismissed';
  const [hideOnboarding, setHideOnboarding] = useState(() => Boolean(cacheGet(onboardingDismissedKey, onboardingCacheScope)));
  const [setupStep, setSetupStep] = useState('name');
  const [setupSaving, setSetupSaving] = useState(false);
  const authName = user?.name && user.name !== user.email ? user.name : '';
  const [setupName, setSetupName] = useState(authName || 'Lethem User');
  const [setupWorkspaceName, setSetupWorkspaceName] = useState('My Workspace');

  const currentPlan = billing?.plans?.find((plan) => plan.id === billing.currentPlan) || billing?.plans?.find((plan) => plan.id === 'free');
  const limits = currentPlan?.limits || {};
  const projectLimit = limits.projects ?? 3;
  const subkeyLimit = limits.subkeys ?? 20;
  const tokenLimit = limits.tokens ?? 2000000;
  const projectLimitLabel = projectLimit == null ? 'Unlimited' : projectLimit;
  const subkeyLimitLabel = subkeyLimit == null ? 'Unlimited' : subkeyLimit;
  const tokenLimitLabel = tokenLimit == null ? 'Unlimited' : fmtNum(tokenLimit);
  const ownProjects = projects.filter((project) => project.own_project !== false && !project.invited_project);
  const invitedProjects = projects.filter((project) => project.invited_project || project.own_project === false);
  const activeProjectSlug = projects[0]?.slug || projects[0]?.id || '';
  const goProjectPage = (page) => activeProjectSlug ? go(`/console/${activeProjectSlug}/${page}`) : go('/console/new');
  const displayedSubkeys = accountUsage.subkeys;
  const displayedMasterKeys = accountUsage.masterKeys;
  const tokenUsage = accountUsage.tokens;
  const requestCount = accountUsage.requests;
  const invitedUsage = { projects: invitedProjects.length, subkeys: accountUsage.invitedSubkeys, tokens: accountUsage.invitedTokens };
  const formatUsageValue = (used, invited = 0, formatter = (value) => value) => `${formatter(used)}${invited ? ` (+${formatter(invited)})` : ''}`;
  const isAtProjectLimit = projectLimit != null && ownProjects.length >= projectLimit;
  const userLabel = user?.name || user?.email || 'Signed in';
  const avatar = userLabel.charAt(0).toUpperCase();
  const avatarImage = user?.picture || '';
  const pendingInvites = (invites || []).filter((invite) => invite.direction === 'received' && invite.can_accept);
  const pendingQuotaRequests = quotaRequests.filter((request) => request.status === 'pending');
  const notificationCount = pendingInvites.length + pendingQuotaRequests.length;
  const notificationSignature = `${pendingInvites.map((invite) => invite.id).sort().join(',')}|${pendingQuotaRequests.map((request) => request.id).sort().join(',')}`;
  const hasNewNotifications = notificationCount > 0 && notificationsSeenKey !== notificationSignature;
  const needsSetup = account && !account.user?.onboarding_completed_at;

  useEffect(() => {
    if (!account) return;
    setSetupName(account.user?.name || authName || 'Lethem User');
    setSetupWorkspaceName(account.organization?.name || 'My Workspace');
  }, [account?.user?.name, account?.organization?.name, authName]);

  const saveSetupName = async (skip = false) => {
    setSetupSaving(true);
    try {
      const name = skip ? 'Lethem User' : (setupName.trim() || 'Lethem User');
      await updateAccount({ name });
      setSetupStep('workspace');
    } catch (e) {
      notify(e.message || 'Unable to save your name', 'error');
    } finally { setSetupSaving(false); }
  };

  const saveSetupWorkspace = async (skip = false) => {
    setSetupSaving(true);
    try {
      const workspaceName = skip ? 'My Workspace' : (setupWorkspaceName.trim() || 'My Workspace');
      await updateAccount({ workspaceName, onboardingCompleted: true });
      setSetupStep('greet');
      setTimeout(() => go('/console'), 1200);
    } catch (e) {
      notify(e.message || 'Unable to save your workspace', 'error');
    } finally { setSetupSaving(false); }
  };


  const loadNotificationData = async () => {
    await loadInvites?.().catch(() => []);
    if (!projects.length) { setQuotaRequests([]); return []; }
    const results = await Promise.allSettled(projects.map(async (project) => {
      const projectId = project.slug || project.id;
      const rows = await api('/api/quota-requests', { noCache: true, headers: { 'x-project-id': projectId } });
      return (Array.isArray(rows) ? rows : []).map((request) => ({ ...request, project_id: projectId, project_name: project.name }));
    }));
    const rows = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    setQuotaRequests(rows);
    return rows;
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    loadNotificationData().catch(() => {});
  }, [isAuthenticated, projects]);

  useEffect(() => {
    const key = `lethem_notifications_seen:${user?.sub || 'anonymous'}`;
    try { setNotificationsSeenKey(localStorage.getItem(key) || ''); } catch (_) { setNotificationsSeenKey(''); }
  }, [user?.sub]);

  useEffect(() => {
    if (!notificationsOpen) return undefined;
    const onPointerDown = (event) => {
      if (!notificationWrapRef.current?.contains(event.target)) setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [notificationsOpen]);

  const toggleNotifications = async () => {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    if (nextOpen) {
      await loadNotificationData().catch(() => {});
      const key = `lethem_notifications_seen:${user?.sub || 'anonymous'}`;
      try { localStorage.setItem(key, notificationSignature); } catch (_) {}
      setNotificationsSeenKey(notificationSignature);
    }
  };

  const decideQuotaRequest = async (request, status) => {
    const key = `quota:${request.id}`;
    setNotificationBusy(key);
    try {
      await api(`/api/quota-requests/${request.id}`, { method: 'PATCH', body: { status }, headers: { 'x-project-id': request.project_id } });
      notify(status === 'approved' ? 'Quota request approved' : 'Quota request rejected');
      await loadNotificationData();
    } catch (e) { notify(e.message || 'Unable to update quota request', 'error'); }
    finally { setNotificationBusy(''); }
  };

  const decideInvite = async (invite, action) => {
    const key = `invite:${invite.id}`;
    setNotificationBusy(key);
    try {
      if (action === 'accept') await acceptInvite(invite.id);
      if (action === 'reject') await revokeInvite(invite.id);
      setSelectedInvite(null);
      await loadNotificationData();
    } catch (e) { notify(e.message || 'Unable to update invite', 'error'); }
    finally { setNotificationBusy(''); }
  };


  useEffect(() => {
    const fallbackUsage = {
      subkeys: 0,
      invitedSubkeys: subkeys.length,
      masterKeys: 0,
      invitedMasterKeys: masterKeys.length,
      tokens: 0,
      invitedTokens: analytics?.totalTokens || 0,
      requests: 0,
      invitedRequests: analytics?.totalRequests || analytics?.logs?.length || 0,
    };

    if (!projects.length || !isAuthenticated) {
      setAccountUsage((current) => ({ ...current, ...fallbackUsage }));
      return undefined;
    }

    const cacheScope = user?.sub || 'anonymous';
    const summaryKey = (project) => `/console-page/project/${project.slug || project.id}/summary`;
    const cachedSummaries = projects.map((project) => cacheGet(summaryKey(project), cacheScope));
    const cachedTotal = cachedSummaries.reduce((totals, summary, index) => {
      if (!summary) return totals;
      const invited = projects[index]?.invited_project || projects[index]?.own_project === false;
      const prefix = invited ? 'invited' : '';
      totals[`${prefix}Subkeys`] += Number(summary.subkeys || 0);
      totals[`${prefix}MasterKeys`] += Number(summary.masterKeys || 0);
      totals[`${prefix}Tokens`] += Number(summary.tokens || 0);
      totals[`${prefix}Requests`] += Number(summary.requests || 0);
      return totals;
    }, { subkeys: 0, invitedSubkeys: 0, masterKeys: 0, invitedMasterKeys: 0, tokens: 0, invitedTokens: 0, requests: 0, invitedRequests: 0 });

    if (cachedSummaries.every(Boolean)) {
      setAccountUsage({ ...cachedTotal, loading: false });
      return undefined;
    }

    if (cachedSummaries.some(Boolean)) setAccountUsage({ ...cachedTotal, loading: true });
    else setAccountUsage((current) => ({ ...current, loading: true }));

    let cancelled = false;

    const fetchProjectJson = async (project, path) => {
      const token = await getAccessToken();
      const projectId = project.slug || project.id;
      const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}`, 'x-project-id': projectId } });
      if (!res.ok) return null;
      return res.json().catch(() => null);
    };

    Promise.allSettled(projects.map(async (project, index) => {
      const cached = cachedSummaries[index];
      if (cached) return cached;

      const [projectSubkeys, projectMasterKeys, projectAnalytics] = await Promise.all([
        fetchProjectJson(project, '/api/subkeys'),
        fetchProjectJson(project, '/api/master-keys'),
        fetchProjectJson(project, '/api/analytics'),
      ]);
      const logs = projectAnalytics?.logs || [];
      const summary = {
        subkeys: Array.isArray(projectSubkeys) ? projectSubkeys.length : 0,
        masterKeys: Array.isArray(projectMasterKeys) ? projectMasterKeys.length : 0,
        tokens: Number(projectAnalytics?.totalTokens || logs.reduce((sum, log) => sum + Number(log.tokens || log.total_tokens || 0), 0)),
        requests: Number(projectAnalytics?.totalRequests || logs.length || 0),
      };
      cacheSet(summaryKey(project), summary, cacheScope);
      return summary;
    }))
      .then((results) => {
        if (cancelled) return;
        const next = results.reduce((totals, result, index) => {
          if (result.status !== 'fulfilled') return totals;
          const invited = projects[index]?.invited_project || projects[index]?.own_project === false;
          const prefix = invited ? 'invited' : '';
          totals[`${prefix}Subkeys`] += Number(result.value.subkeys || 0);
          totals[`${prefix}MasterKeys`] += Number(result.value.masterKeys || 0);
          totals[`${prefix}Tokens`] += Number(result.value.tokens || 0);
          totals[`${prefix}Requests`] += Number(result.value.requests || 0);
          return totals;
        }, { subkeys: 0, invitedSubkeys: 0, masterKeys: 0, invitedMasterKeys: 0, tokens: 0, invitedTokens: 0, requests: 0, invitedRequests: 0 });
        setAccountUsage({ ...next, loading: false });
      })
      .catch(() => {
        if (!cancelled) setAccountUsage((current) => ({ ...current, ...fallbackUsage, loading: false }));
      });

    return () => { cancelled = true; };
  }, [API, analytics?.logs, analytics?.totalRequests, analytics?.totalTokens, getAccessToken, isAuthenticated, masterKeys.length, projects, subkeys.length, user?.sub]);

  const expectedDeleteText = projectToDelete ? `delete ${projectToDelete.slug}` : '';
  const canDeleteProject = projectToDelete && deleteConfirm.trim() === expectedDeleteText;

  const onboardingSteps = useMemo(() => [
    { label: 'Create account', done: true },
    { label: 'Create first project', done: ownProjects.length > 0 },
    { label: 'Add provider API key', done: displayedMasterKeys > 0, onClick: () => goProjectPage('masterkeys') },
    { label: 'Create first subkey', done: displayedSubkeys > 0, onClick: () => goProjectPage('subkeys') },
    { label: 'Make first API request', done: requestCount > 0, onClick: () => goProjectPage('demo') },
  ], [displayedMasterKeys, displayedSubkeys, ownProjects.length, requestCount, activeProjectSlug]);
  const completedSteps = onboardingSteps.filter((step) => step.done).length;
  const onboardingPercent = (completedSteps / onboardingSteps.length) * 100;

  const planMeters = [
    { label: 'Projects', used: ownProjects.length, invited: invitedUsage.projects, limit: projectLimit },
    { label: 'Subkeys', used: displayedSubkeys, invited: invitedUsage.subkeys, limit: subkeyLimit },
    { label: 'Tokens', used: tokenUsage, invited: invitedUsage.tokens, limit: tokenLimit, format: fmtNum },
  ];

  useEffect(() => {
    const cached = Boolean(cacheGet(onboardingDismissedKey, onboardingCacheScope));
    if (cached) setHideOnboarding(true);
  }, [onboardingCacheScope]);

  useEffect(() => {
    if (completedSteps === onboardingSteps.length) {
      cacheSet(onboardingDismissedKey, true, onboardingCacheScope);
      setHideOnboarding(true);
    }
  }, [completedSteps, onboardingSteps.length, onboardingCacheScope]);

  const dismissOnboarding = () => {
    cacheSet(onboardingDismissedKey, true, onboardingCacheScope);
    setHideOnboarding(true);
  };

  const handleDelete = async () => {
    if (!canDeleteProject || !projectToDelete) return;
    try {
      const ps = await deleteProject();
      if (!ps.length) go('/console/new'); else go('/console');
    } catch (e) {
      notify(e.message || 'Failed to delete project', 'error');
    }
  };

  return (
    <div className='page active console-select-page'>

      {needsSetup && (
        <div className='modal-backdrop open onboarding-wizard-backdrop'>
          <div className='modal onboarding-wizard' role='dialog' aria-modal='true' aria-label='Get Started onboarding'>
            {setupStep === 'name' && <>
              <div className='onboarding-kicker'>Get Started</div>
              <div className='modal-title'>What should we call you?</div>
              <p className='card-sub'>We prefilled this from your sign-in profile when available. You can edit it now.</p>
              <div className='field'><label>Name</label><input value={setupName} onChange={(e) => setSetupName(e.target.value)} placeholder='Lethem User' autoFocus /></div>
              <div className='modal-footer'><button className='btn btn-ghost' disabled={setupSaving} onClick={() => saveSetupName(true)}>Skip</button><button className='btn btn-primary' disabled={setupSaving} onClick={() => saveSetupName(false)}>Continue</button></div>
            </>}
            {setupStep === 'workspace' && <>
              <div className='onboarding-kicker'>Workspace</div>
              <div className='modal-title'>Name your workspace</div>
              <p className='card-sub'>This is the shared home for your projects and API access settings.</p>
              <div className='field'><label>Workspace name</label><input value={setupWorkspaceName} onChange={(e) => setSetupWorkspaceName(e.target.value)} placeholder='My Workspace' autoFocus /></div>
              <div className='modal-footer'><button className='btn btn-ghost' disabled={setupSaving} onClick={() => saveSetupWorkspace(true)}>Skip</button><button className='btn btn-primary' disabled={setupSaving} onClick={() => saveSetupWorkspace(false)}>Finish</button></div>
            </>}
            {setupStep === 'greet' && <div className='onboarding-greet'><div className='onboarding-kicker'>You're all set</div><div className='modal-title'>Welcome, {(setupName || 'Lethem User').trim()}!</div><p className='card-sub'>Taking you to your console.</p></div>}
          </div>
        </div>
      )}

      {selectedInvite && (
        <div className='modal-backdrop open invite-notification-backdrop' onClick={(e) => e.target === e.currentTarget && setSelectedInvite(null)}>
          <div className='modal invite-notification-modal'>
            <div className='modal-title'>Project invite</div>
            <div className='invite-detail-grid'><span><b>Project</b>{selectedInvite.project_name || selectedInvite.organization_name || 'Project'}</span><span><b>Workspace</b>{selectedInvite.organization_name || 'Workspace'}</span><span><b>Sent by</b>{selectedInvite.invited_by_name || selectedInvite.invited_by_email || 'A teammate'}</span><span><b>Role</b>{selectedInvite.role}</span><span><b>Expires</b>{fmtDate(selectedInvite.expires_at)}</span></div>
            <div className='modal-footer'><button className='btn btn-green' disabled={notificationBusy === `invite:${selectedInvite.id}`} onClick={() => decideInvite(selectedInvite, 'accept')}>Accept</button><button className='btn btn-danger' disabled={notificationBusy === `invite:${selectedInvite.id}`} onClick={() => decideInvite(selectedInvite, 'reject')}>Reject</button><button className='btn btn-ghost' onClick={() => setSelectedInvite(null)}>Close</button></div>
          </div>
        </div>
      )}

      <nav className='project-console-nav'>
        <div className='project-console-brand'><span><LogoIcon size={18} /></span><div><strong>KeyGate</strong><small>Projects Console</small></div></div>
        <div className='project-console-nav-actions'>
          <div className='notification-popover-wrap' ref={notificationWrapRef}>
            <button className={`project-console-icon-btn notification-bell ${hasNewNotifications ? 'has-new' : ''}`} type='button' aria-label='Notifications' aria-expanded={notificationsOpen} onClick={toggleNotifications}><IconBell />{hasNewNotifications && <span className='notification-dot' />}</button>
            {notificationsOpen && <div className='notification-popover-panel' role='dialog' aria-label='Notifications panel'>
              <div className='notification-popover-head'><strong>Notifications</strong><span>{notificationCount ? `${notificationCount} new` : 'All caught up'}</span></div>
              {notificationCount === 0 ? <div className='notification-empty'>No important notifications right now.</div> : <div className='notification-list'>
                {pendingInvites.map((invite) => <div className='notification-item' key={`invite-${invite.id}`}>
                  <div><b>Project invite</b><p>{invite.project_name || invite.organization_name || 'Project'} invited you as {invite.role}.</p></div>
                  <button className='btn btn-sm btn-ghost' onClick={() => setSelectedInvite(invite)}>View</button>
                </div>)}
                {pendingQuotaRequests.map((request) => <div className='notification-item' key={`quota-${request.id}`}>
                  <div><b>Quota request</b><p>{request.project_name || 'Project'} · {request.subkey_name || 'Subkey'} asked for {request.request_type}{request.amount ? ` (${request.amount})` : ''}.</p></div>
                  <span className='notification-actions'><button className='btn btn-sm btn-green' disabled={notificationBusy === `quota:${request.id}`} onClick={() => decideQuotaRequest(request, 'approved')}>Accept</button><button className='btn btn-sm btn-danger' disabled={notificationBusy === `quota:${request.id}`} onClick={() => decideQuotaRequest(request, 'rejected')}>Reject</button></span>
                </div>)}
              </div>}
            </div>}
          </div>
          <div className='project-console-user-wrap'>
            <button className='project-console-user' type='button' aria-haspopup='menu' aria-expanded={userMenuOpen} onClick={() => setUserMenuOpen((open) => !open)}><span>{avatarImage ? <img src={avatarImage} alt='' /> : avatar}</span>{userLabel}</button>
            {userMenuOpen && <div className='project-console-user-menu' role='menu'>
              <button type='button' role='menuitem' onClick={() => { setUserMenuOpen(false); go('/console/profile'); }}><IconUser /> Profile</button>
              <button type='button' role='menuitem' onClick={() => { setUserMenuOpen(false); go('/console/workspace'); }}><IconSettings /> Workspace Settings</button>
              <button type='button' role='menuitem' onClick={() => { setUserMenuOpen(false); go('/console/subscription'); }}><IconBilling /> Billing</button>
              <button type='button' role='menuitem' onClick={() => { setUserMenuOpen(false); go('/console/docs'); }}><IconLogs /> Documentation</button>
              <button type='button' role='menuitem' className='danger' onClick={() => { setUserMenuOpen(false); logout(); }}>Logout</button>
            </div>}
          </div>
        </div>
      </nav>

      <div className='console-select-content'>
        <header className='console-landing-header project-console-hero'>
          <div>
            <h1>Projects Console</h1>
            <p>Create, switch, and manage isolated projects</p>
          </div>
          <div className='console-top-bar'>
            <button type='button' className='console-plan-badge project-console-plan-link' onClick={() => go('/console/subscription')} aria-label='Open subscription page'>
              <span className='console-plan-dot' /> {currentPlan?.name || 'Free'} plan <span>{formatUsageValue(ownProjects.length, invitedUsage.projects)} / {projectLimitLabel} projects</span>
            </button>
            <button className='btn btn-ghost console-create-btn project-console-manage-btn' onClick={() => go('/console/subscription')}>Manage subscription</button>
            <button className='btn btn-primary console-create-btn' aria-disabled={isAtProjectLimit} onClick={() => isAtProjectLimit ? notify(`Maximum ${projectLimitLabel} own projects allowed on your current plan`, 'error') : go('/console/new')}>+ New project</button>
          </div>
        </header>

        {!hideOnboarding && (
          <section className='project-console-onboarding card'>
            <div className='project-console-section-head'><div><strong>✣ Getting Started</strong><span>Complete these steps to get your API gateway running</span></div><div className='onboarding-meta'><b>{completedSteps}/{onboardingSteps.length}<small>Completed</small></b><button type='button' className='onboarding-close' onClick={dismissOnboarding} aria-label='Hide getting started'>✕</button></div></div>
            <div className='project-console-progress'><span style={{ width: `${onboardingPercent}%` }} /></div>
            <div className='project-console-steps'>{onboardingSteps.map((step) => { const StepTag = step.onClick ? 'button' : 'div'; return <StepTag type={step.onClick ? 'button' : undefined} className={`${step.done ? 'done' : ''} ${step.onClick ? 'clickable' : 'locked'}`} onClick={step.onClick} key={step.label}><IconCheck />{step.label}</StepTag>; })}</div>
          </section>
        )}

        <section className='project-console-actions-wrap'>
          <h2>Quick Actions</h2>
          <div className='project-console-actions'>
            <button aria-disabled={isAtProjectLimit} onClick={() => isAtProjectLimit ? notify(`Maximum ${projectLimitLabel} own projects allowed on your current plan`, 'error') : go('/console/new')}><IconPlus /><span><strong>Create Project</strong><small>Get started</small></span><IconExternal /></button>
            <button onClick={() => goProjectPage('masterkeys')}><IconCheck /><span><strong>Add Provider</strong><small>{displayedMasterKeys > 0 ? 'Completed' : 'Get started'}</small></span><IconExternal /></button>
            <button onClick={() => goProjectPage('subkeys')}><IconSubkey /><span><strong>Create Subkey</strong><small>{displayedSubkeys > 0 ? 'Completed' : 'Get started'}</small></span><IconExternal /></button>
            <button onClick={() => goProjectPage('demo')}><IconDemo /><span><strong>Open Live Demo</strong><small>{requestCount > 0 ? 'Completed' : 'Get started'}</small></span><IconExternal /></button>
          </div>
        </section>

        <section className='project-console-plan card'>
          <button className='btn btn-ghost btn-sm' onClick={() => go('/console/subscription')}>Upgrade →</button>
          <div className='card-title'>Plan Usage</div><div className='card-sub'>Resource consumption across your {currentPlan?.name || 'Free'} plan</div>
          <div className='project-console-meters'>{planMeters.map((meter) => { const pct = meter.limit ? Math.min(100, (meter.used / meter.limit) * 100) : 0; const formatter = meter.format || fmtNum; return <div key={meter.label}><p><strong>{meter.label}</strong><span>{formatUsageValue(meter.used, meter.invited, formatter)} / {meter.limit == null ? 'Unlimited' : fmtNum(meter.limit)}</span></p><div><span style={{ width: `${pct}%` }} /></div><small>{meter.limit ? `${Math.round(pct)}% own usage` : 'No fixed limit'}{meter.invited ? ` · +${formatter(meter.invited)} invited not counted` : ''}</small></div>; })}</div>
        </section>

        <div className={`card projects-banner console-info-banner ${showPlanBanner ? '' : 'hidden'}`}>
          <div className='console-banner-text'>Your {currentPlan?.name || 'Free'} plan includes {projectLimitLabel} projects and plan-based resources.</div>
          <button className='btn btn-ghost btn-sm console-banner-link' onClick={() => go('/console/subscription')}>Upgrade to Pro</button>
          <button className='banner-close' onClick={() => setShowPlanBanner(false)} aria-label='Close banner'>✕</button>
        </div>

        <div className='project-console-projects-head'><h2>Your Projects <span>{formatUsageValue(ownProjects.length, invitedUsage.projects)} / {projectLimitLabel}</span></h2><div className='project-console-search'><IconSearch /><input className='projects-search console-search-input' value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} placeholder='Search by name, label, or ID' /></div></div>

        <div className='projects-grid console-projects-grid'>
          {filteredProjects.map((p) => {
            const projectRef = p.slug || p.id;
            const copyId = `project-${p.id}`;
            return (
              <article key={p.id} className='card project-card console-project-card' role='button' tabIndex={0} onClick={() => go(`/console/${projectRef}/overview`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') go(`/console/${projectRef}/overview`); }}>
                <div className='console-project-card-header'><h3>{p.name}</h3><span className={`badge ${p.status === 'active' ? 'active' : 'paused'}`}>• {p.status}</span>{(p.invited_project || p.own_project === false) && <span className='badge paused'>Invited</span>}</div>
                <div className='console-project-card-body'>
                  <div className='console-project-id-wrap'>
                    <div className='console-project-id'>{projectRef}</div>
                    <button type='button' className='project-id-copy' onClick={(e) => { e.stopPropagation(); copyText(projectRef, copyId); }}>{copiedItem === copyId ? 'Copied' : 'Copy ID'}</button>
                  </div>
                  <div className='console-project-date'>Created {fmtDate(p.created_at)}</div>
                </div>
                <div className='console-project-card-footer'><span /><button type='button' className='project-delete console-project-delete' aria-disabled={p.invited_project || p.own_project === false} onClick={(e) => { e.stopPropagation(); if (p.invited_project || p.own_project === false) { notify('Invited projects do not count toward your plan and cannot be deleted from your workspace.', 'error'); return; } setProjectToDelete(p); setDeleteConfirm(''); }} aria-label={`Delete ${p.name}`}><IconTrash /></button></div>
              </article>
            );
          })}
        </div>

        <div className={`modal-backdrop ${projectToDelete ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setProjectToDelete(null)}>
          <div className='modal'>
            <div className='modal-title'>Delete project</div>
            <div className='danger-box'>This action is irreversible. All data related to this project will be deleted and issued keys will stop working.</div>
            <div className='field' style={{ marginTop: 12 }}><label>Type "{expectedDeleteText}" to continue</label><input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder='delete project-xxxx' /></div>
            <div className='modal-footer'><button className='btn btn-ghost' onClick={() => setProjectToDelete(null)}>Cancel</button><button className='btn btn-danger' disabled={!canDeleteProject} onClick={handleDelete}>Delete project permanently</button></div>
          </div>
        </div>
        <div className={`notif ${notif.show ? 'show' : ''} ${notif.type}`}>{notif.msg}</div>
      </div>
    </div>
  );
}
