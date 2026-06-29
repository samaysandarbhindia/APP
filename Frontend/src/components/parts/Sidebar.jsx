import { useState } from 'react';
import { useLethem } from '../../contexts/LethemContext';
import { IconOverview, IconMasterKey, IconSubkey, IconLogs, IconDemo, IconHealth, IconNotifications, IconArrowLeft, IconAnalytics, IconTeam, IconBilling, IconSettings, IconUser } from './Icons';

const sections = [
  { label: 'Overview', items: [['overview', 'Overview', IconOverview]] },
  { label: 'Access', items: [['masterkeys', 'Master keys', IconMasterKey], ['subkeys', 'Subkeys', IconSubkey], ['demo', 'Live demo', IconDemo]] },
  { label: 'Monitoring', items: [['analytics', 'Analytics', IconAnalytics], ['usage', 'Usage', IconBilling], ['logs', 'Request logs', IconLogs], ['notifications', 'Notifications', IconNotifications], ['health', 'Health', IconHealth]] },
  { label: 'Team', items: [['members', 'Members', IconTeam], ['roles', 'Roles', IconUser], ['invites', 'Invites', IconNotifications]] },
  { label: 'Settings', items: [['general', 'General', IconSettings], ['endpoint', 'API Endpoint', IconDemo], ['security', 'Security', IconMasterKey], ['audit', 'Audit Logs', IconLogs], ['danger', 'Danger Zone', IconHealth]] },
];

const mobileItems = [
  ['overview', 'Overview', IconOverview],
  ['masterkeys', 'Access', IconMasterKey],
  ['analytics', 'Monitor', IconAnalytics],
  ['members', 'Team', IconTeam],
  ['usage', 'Usage', IconBilling],
];

export default function Sidebar({ page, navigate, onBackToConsole, drawerOpen, setDrawerOpen }) {
  const [collapsed, setCollapsed] = useState(() => ({}));
  const { ctx } = useLethem();
  const endpoint = `${ctx.API}/`;
  const copyEndpoint = () => ctx.copyText(endpoint, 'proxy-endpoint');
  const toggleSection = (label) => setCollapsed((v) => ({ ...v, [label]: !v[label] }));
  const go = (next) => {
    navigate(next);
    setDrawerOpen(false);
  };

  const renderItem = ([key, label, Icon], mobile = false) => {
    const blocked = !ctx.access?.canAccessPage?.(key);
    const openItem = () => {
      if (blocked) { ctx.notify(ctx.access?.denied?.(`open ${label}`) || 'Your role does not allow this action.', 'error'); return; }
      mobile ? go(key) : navigate(key);
    };
    return (
      <button key={key} aria-disabled={blocked} title={blocked ? ctx.access?.denied?.(`open ${label}`) : undefined} className={`${mobile ? 'mobile-drawer-item' : 'nav-item'} ${key === 'danger' ? 'danger-nav-item' : ''} ${page === key ? 'active' : ''} ${blocked ? 'is-disabled' : ''}`} onClick={openItem}>
        <Icon /> {label}{key === 'demo' && <span className='nav-dot' />}
      </button>
    );
  };

  return <>
    <aside className='sidebar'>
      <nav className='nav'>
        {onBackToConsole && <button className='nav-item' onClick={onBackToConsole}><IconArrowLeft /> Back to console</button>}
        {sections.map((section) => (
          <div className='nav-section' key={section.label}>
            <button className='nav-label nav-label-button' onClick={() => toggleSection(section.label)} aria-expanded={!collapsed[section.label]}>{section.label}<span>{collapsed[section.label] ? '+' : '−'}</span></button>
            {!collapsed[section.label] && section.items.map((item) => renderItem(item))}
          </div>
        ))}
      </nav>
      <div className='sidebar-footer'><button type='button' className='api-url-box api-url-button' onClick={copyEndpoint} title='Copy proxy endpoint'><div className='api-url-label'>Proxy endpoint</div><div className='api-url'>{ctx.copiedItem === 'proxy-endpoint' ? 'Copied!' : endpoint}</div></button></div>
    </aside>

    <div className={`mobile-drawer-backdrop ${drawerOpen ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setDrawerOpen(false)}>
      <aside className='mobile-drawer'>
        <div className='mobile-drawer-title'>Lethem</div>
        <div className='mobile-drawer-list'>
          {sections.map((section) => (
            <div className='mobile-drawer-section' key={section.label}>
              <button className='nav-label nav-label-button' onClick={() => toggleSection(section.label)} aria-expanded={!collapsed[section.label]}>{section.label}<span>{collapsed[section.label] ? '+' : '−'}</span></button>
              {!collapsed[section.label] && section.items.map((item) => renderItem(item, true))}
            </div>
          ))}
        </div>
        <button type='button' className='mobile-drawer-footer api-url-button' onClick={copyEndpoint}>{ctx.copiedItem === 'proxy-endpoint' ? 'Copied!' : endpoint}</button>
      </aside>
    </div>

    <nav className='mobile-tabbar' aria-label='Mobile navigation'>
      {mobileItems.map(([key, label, Icon]) => <button key={key} className={`mobile-tab ${page === key ? 'active' : ''}`} onClick={() => go(key)}><Icon width={18} height={18} /><span>{label}</span></button>)}
    </nav>
  </>;
}
