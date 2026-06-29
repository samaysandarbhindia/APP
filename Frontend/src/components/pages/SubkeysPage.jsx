import { useEffect, useMemo, useState } from 'react';
import '../styles/SubkeysPage.css';
import { IconCopy, IconCheck } from '../parts/Icons';
import TableWrap from '../parts/TableWrap';
import { FALLBACK_PROVIDERS, providerLabel, providerModels as getProviderModels } from '../../lib/providers';

const fmtCost = (v) => Number(v || 0) ? `$${Number(v).toFixed(6)}` : '—';
const pctUsed = (used, limit) => Math.min(100, Math.round(((Number(used) || 0) / Math.max(Number(limit) || 1, 1)) * 100));
const receiptSafe = (value) => String(value ?? '—').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
const getMaskedSubkey = (sk) => sk?.token_preview || `${sk?.token_prefix || 'sk-kg-'}••••••••${sk?.token_suffix || ''}`;
const slugifyFilePart = (value) => String(value || 'Subkey').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'Subkey';

function buildReceiptData({ subkey, logs, selectedProject, providerOptions, fmtNum, fmtDate }) {
  const relatedLogs = (logs || []).filter((log) => {
    const logSubkeyId = log.subkey_id || log.subkeyId || log.subkey;
    if (subkey.id && logSubkeyId && String(logSubkeyId) === String(subkey.id)) return true;
    return log.subkey_name && subkey.name && log.subkey_name === subkey.name;
  }).slice(0, 8);
  const totalTokens = relatedLogs.reduce((sum, log) => sum + (Number(log.tokens_used) || 0), 0);
  const totalCost = relatedLogs.reduce((sum, log) => sum + (Number(log.estimated_cost_usd) || 0), 0);
  const successLogs = relatedLogs.filter((log) => log.status === 'success').length;

  const fileDate = new Date().toISOString().slice(0, 10);
  const safeKeyName = slugifyFilePart(subkey.name);

  return {
    receiptNo: `LT-${String(subkey.id || Date.now()).slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-5)}`,
    fileName: `Lethem-${safeKeyName}-Subkey-Receipt-${fileDate}.pdf`,
    generatedAt: new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
    projectName: selectedProject?.name || 'Current project',
    projectSlug: selectedProject?.slug || selectedProject?.id || '—',
    name: subkey.name || 'Untitled subkey',
    token: getMaskedSubkey(subkey),
    provider: providerLabel(providerOptions, subkey.provider) || subkey.provider || '—',
    providerId: subkey.provider || '—',
    status: subkey.status || '—',
    quotaUsed: fmtNum(subkey.tokens_used || 0),
    quotaLimit: fmtNum(subkey.monthly_token_limit || 0),
    quotaPct: pctUsed(subkey.tokens_used, subkey.monthly_token_limit),
    requestsUsed: fmtNum(subkey.request_count || 0),
    requestsLimit: fmtNum(subkey.max_requests || 5000),
    expiry: fmtDate(subkey.expires_at),
    allowedModels: Array.isArray(subkey.allowed_models) && subkey.allowed_models.length ? subkey.allowed_models.join(', ') : 'All approved models',
    autoRoute: subkey.auto_route_on_exhausted ? 'Enabled' : 'Disabled',
    spendLimit: subkey.spend_limit_usd ? `$${Number(subkey.spend_limit_usd).toFixed(2)}` : 'Not set',
    relatedLogs,
    logCount: relatedLogs.length,
    successRate: relatedLogs.length ? `${Math.round((successLogs / relatedLogs.length) * 100)}%` : 'No logs yet',
    loggedTokens: fmtNum(totalTokens),
    totalSpentUsd: totalCost ? `$${totalCost.toFixed(6)}` : '$0.000000',
    loggedCost: totalCost ? `$${totalCost.toFixed(6)}` : '$0.000000',
  };
}

function renderReceiptHtml(receipt) {
  const rows = receipt.relatedLogs.length
    ? receipt.relatedLogs.map((log) => `
      <tr>
        <td>${receiptSafe(log.request_id ? String(log.request_id).slice(0, 10) : '—')}</td>
        <td>${receiptSafe(log.provider || receipt.providerId)}</td>
        <td>${receiptSafe(log.model || '—')}</td>
        <td>${receiptSafe(log.tokens_used || 0)}</td>
        <td>${receiptSafe(fmtCost(log.estimated_cost_usd))}</td>
        <td>${receiptSafe(log.status || '—')}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="empty">No request logs available for this subkey yet.</td></tr>';

  return `<!doctype html><html><head><meta charset="utf-8" />
    <title>${receiptSafe(receipt.fileName)}</title>
    <style>
      *{box-sizing:border-box}body{margin:0;background:#f4f6fb;color:#111827;font-family:Inter,Arial,sans-serif}.receipt{max-width:920px;margin:24px auto;background:#fff;border:1px solid #e5e7eb;border-radius:24px;overflow:hidden;box-shadow:0 24px 80px rgba(15,23,42,.12)}.top{padding:34px 40px;background:linear-gradient(135deg,#111827,#2f2b74);color:#fff;display:flex;justify-content:space-between;gap:24px}.brand{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#b8c7ff;font-weight:800}.top h1{margin:8px 0 8px;font-size:34px;letter-spacing:-.04em}.muted{color:#6b7280}.top .muted{color:#dbe4ff}.pill{display:inline-flex;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.14);font-weight:700;font-size:12px;text-transform:uppercase}.meta{text-align:right;min-width:220px}.content{padding:34px 40px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:22px 0}.box{border:1px solid #e5e7eb;border-radius:16px;padding:16px;background:#fbfdff}.label{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;font-weight:800}.value{margin-top:7px;font-size:18px;font-weight:800;word-break:break-word}.token{font-family:'SFMono-Regular',Consolas,monospace;font-size:14px;color:#4f46e5}.section{margin-top:28px}.section h2{font-size:16px;margin:0 0 12px;color:#111827}.details{width:100%;border-collapse:collapse}.details td{padding:11px 0;border-bottom:1px solid #eef2f7}.details td:first-child{color:#6b7280;font-weight:700;width:34%}table.logs{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden}table.logs th{background:#f8fafc;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#64748b}table.logs th,table.logs td{padding:12px;border-bottom:1px solid #edf2f7;font-size:13px}.empty{text-align:center;color:#6b7280;padding:24px!important}.footer{padding:20px 40px;background:#f8fafc;color:#64748b;font-size:12px;display:flex;justify-content:space-between;gap:16px}@media print{body{background:#fff}.receipt{margin:0;max-width:none;border:0;box-shadow:none;border-radius:0}.no-print{display:none!important}}
    </style></head><body><main class="receipt">
      <section class="top"><div><div class="brand">Lethem Subkey Receipt</div><h1>${receiptSafe(receipt.name)}</h1><p class="muted">Professional receipt for scoped API access, quotas, provider routing, expiry, and recent request activity.</p><span class="pill">${receiptSafe(receipt.status)}</span></div><div class="meta"><div class="label">Receipt No.</div><strong>${receiptSafe(receipt.receiptNo)}</strong><br/><br/><div class="label">Generated</div><strong>${receiptSafe(receipt.generatedAt)}</strong></div></section>
      <section class="content"><div class="grid"><div class="box"><div class="label">Subkey</div><div class="value token">${receiptSafe(receipt.token)}</div></div><div class="box"><div class="label">Provider</div><div class="value">${receiptSafe(receipt.provider)}</div></div><div class="box"><div class="label">Quota used</div><div class="value">${receiptSafe(receipt.quotaPct)}%</div></div><div class="box"><div class="label">Token quota</div><div class="value">${receiptSafe(receipt.quotaUsed)} / ${receiptSafe(receipt.quotaLimit)}</div></div><div class="box"><div class="label">Requests</div><div class="value">${receiptSafe(receipt.requestsUsed)} / ${receiptSafe(receipt.requestsLimit)}</div></div><div class="box"><div class="label">Total spent USD</div><div class="value">${receiptSafe(receipt.totalSpentUsd)}</div></div><div class="box"><div class="label">Expiry</div><div class="value">${receiptSafe(receipt.expiry)}</div></div></div>
      <div class="section"><h2>Clear Details</h2><table class="details"><tbody><tr><td>Project</td><td>${receiptSafe(receipt.projectName)} (${receiptSafe(receipt.projectSlug)})</td></tr><tr><td>Allowed models</td><td>${receiptSafe(receipt.allowedModels)}</td></tr><tr><td>Spend ceiling</td><td>${receiptSafe(receipt.spendLimit)}</td></tr><tr><td>Auto-route on exhausted</td><td>${receiptSafe(receipt.autoRoute)}</td></tr><tr><td>Logs included</td><td>${receiptSafe(receipt.logCount)} recent item(s)</td></tr><tr><td>Logged token total</td><td>${receiptSafe(receipt.loggedTokens)}</td></tr><tr><td>Total spent USD</td><td>${receiptSafe(receipt.totalSpentUsd)}</td></tr><tr><td>Logged estimated cost</td><td>${receiptSafe(receipt.loggedCost)}</td></tr><tr><td>Success rate</td><td>${receiptSafe(receipt.successRate)}</td></tr></tbody></table></div>
      <div class="section"><h2>Recent Request Logs</h2><table class="logs"><thead><tr><th>Request</th><th>Provider</th><th>Model</th><th>Tokens</th><th>Cost</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></section>
      <section class="footer"><span>Generated by Lethem admin console.</span><span>Token values are masked for security.</span></section>
    </main></body></html>`;
}

function exportReceiptPdf(receipt) {
  const popup = window.open('', '_blank', 'width=1000,height=900');
  if (!popup) return false;
  popup.document.open();
  popup.document.write(renderReceiptHtml(receipt));
  popup.document.close();
  popup.document.title = receipt.fileName;
  popup.history.replaceState(null, '', receipt.fileName);
  popup.setTimeout(() => {
    popup.focus();
    popup.print();
  }, 250);
  return true;
}

export default function SubkeysPage({ ctx }) {
  const { subkeys, api, loadSubkeys, loadMasterKeys, masterKeys, notify, fmtNum, fmtDate, quotaColor, modal, setModal, setRevealedToken, revealedToken, providers = FALLBACK_PROVIDERS, logs = [], selectedProject } = ctx;
  const providerOptions = providers.length ? providers : FALLBACK_PROVIDERS;
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('openai');
  const [limit, setLimit] = useState(50000);
  const [maxRequests, setMaxRequests] = useState(5000);
  const [spend, setSpend] = useState('');
  const [expiry, setExpiry] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [selectedModels, setSelectedModels] = useState(['all']);
  const [masterKeyId, setMasterKeyId] = useState('');
  const [autoRoute, setAutoRoute] = useState(false);
  const [editingSubkey, setEditingSubkey] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [editLimit, setEditLimit] = useState('');
  const [editMaxRequests, setEditMaxRequests] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savedChip, setSavedChip] = useState(false);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [statusFilterTouched, setStatusFilterTouched] = useState(false);
  const [revealCopied, setRevealCopied] = useState(false);
  const canManageSubkeys = Boolean(ctx.access?.canManageSubkeys);
  const denySubkeys = () => notify(ctx.access?.denied?.('manage subkeys') || 'Your role does not allow this action.', 'error');

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filteredSubkeys = useMemo(() => {
    let list = statusFilter === 'all' ? subkeys : subkeys.filter((s) => s.status === statusFilter);
    if (!sortKey) return list;
    return [...list].sort((a, b) => {
      let av, bv;
      if (sortKey === 'name') { av = a.name?.toLowerCase() || ''; bv = b.name?.toLowerCase() || ''; }
      else if (sortKey === 'provider') { av = a.provider || ''; bv = b.provider || ''; }
      else if (sortKey === 'quota') { av = a.tokens_used / Math.max(a.monthly_token_limit, 1); bv = b.tokens_used / Math.max(b.monthly_token_limit, 1); }
      else if (sortKey === 'requests') { av = a.request_count || 0; bv = b.request_count || 0; }
      else if (sortKey === 'expires') { av = a.expires_at || 0; bv = b.expires_at || 0; }
      else if (sortKey === 'status') { av = a.status || ''; bv = b.status || ''; }
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [subkeys, sortKey, sortDir, statusFilter]);

  useEffect(() => {
    loadMasterKeys();
  }, []);

  const providerModels = getProviderModels(providerOptions, provider);
  const filteredModels = providerModels.filter((m) => m.toLowerCase().includes(modelSearch.toLowerCase()));

  const createSubkey = async () => {
    if (!canManageSubkeys) return denySubkeys();
    if (!name.trim()) return notify('Enter a name', 'error');
    const providerKeys = masterKeys.filter((mk) => mk.provider === provider);
    if (!providerKeys.length) return notify('Add a Master Key first', 'error');
    const allowed_models = selectedModels.includes('all') ? ['all'] : selectedModels.filter((m) => providerModels.includes(m));
    const sk = await api('/api/subkeys', {
      method: 'POST',
      body: {
        name: name.trim(), provider, master_key_id: masterKeyId || null, auto_route_on_exhausted: autoRoute,
        monthly_token_limit: Number(limit) || 50000,
        max_requests: Number(maxRequests) || 5000,
        allowed_models,
        spend_limit_usd: spend ? Number(spend) : null,
        expires_in_days: expiry ? Number(expiry) : null,
      }
    });
    if (sk.error) return notify(sk.error, 'error');
    setName(''); setProvider('openai'); setLimit(50000); setMaxRequests(5000); setSpend(''); setExpiry(''); setSelectedModels(['all']); setMasterKeyId(''); setAutoRoute(false);
    setRevealedToken(sk.token); setModal('tokenreveal'); loadSubkeys();
  };

  const openEdit = (sk) => {
    if (!canManageSubkeys) return denySubkeys();
    setEditingSubkey(sk);
    setEditLimit(sk.monthly_token_limit || 50000);
    setEditMaxRequests(sk.max_requests || 5000);
    setEditExpiry('');
    setModal('editsubkey');
  };

  const openReceipt = async (sk) => {
    if (!Number(sk.tokens_used || 0)) {
      notify('No quota usage found for this subkey', 'error');
      return;
    }
    setReceiptLoading(true);
    try {
      const analytics = await api('/api/analytics', { noCache: true }).catch(() => ({ logs }));
      const receipt = buildReceiptData({ subkey: sk, logs: analytics.logs || logs, selectedProject, providerOptions, fmtNum, fmtDate });
      setReceiptData(receipt);
      setModal('subkeyreceipt');
    } finally {
      setReceiptLoading(false);
    }
  };

  const downloadReceipt = () => {
    if (!receiptData) return;
    const opened = exportReceiptPdf(receiptData);
    notify(opened ? 'Receipt opened — choose Save as PDF in the print dialog' : 'Allow pop-ups to export the receipt PDF', opened ? 'success' : 'error');
  };

  const saveEdit = async () => {
    if (!canManageSubkeys) return denySubkeys();
    if (!editingSubkey) return;
    const prev = [...subkeys];
    setSavingEdit(true);
    try {
      ctx.setSubkeys((list) => list.map((x) => x.id === editingSubkey.id ? { ...x, monthly_token_limit: Number(editLimit), max_requests: Number(editMaxRequests) } : x));
      const res = await api(`/api/subkeys/${editingSubkey.id}`, {
        method: 'PATCH',
        body: {
          monthly_token_limit: Number(editLimit),
          max_requests: Number(editMaxRequests),
          expires_in_days: editExpiry === '' ? undefined : (editExpiry === 'never' ? null : Number(editExpiry)),
        }
      });
      if (res?.subkey) ctx.setSubkeys((list) => list.map((x) => x.id === res.subkey.id ? { ...x, ...res.subkey } : x));
      setSavedChip(true);
      setTimeout(() => setSavedChip(false), 1400);
      notify('Subkey limits updated');
      await loadSubkeys();
    } catch (e) {
      ctx.setSubkeys(prev);
      notify(e.message || 'Failed to update subkey', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const updateStatus = async (nextStatus) => {
    if (!canManageSubkeys) return denySubkeys();
    if (!editingSubkey || statusLoading) return;
    if (nextStatus === 'revoked' && !window.confirm(`Revoke "${editingSubkey.name}"? Existing clients using this subkey will stop working immediately.`)) return;
    const prev = [...subkeys];
    setStatusLoading(true);
    try {
      ctx.setSubkeys((list) => list.map((x) => x.id === editingSubkey.id ? { ...x, status: nextStatus } : x));
      await api('/api/subkeys/' + editingSubkey.id, { method: 'PATCH', body: { status: nextStatus } });
      await loadSubkeys();
    } catch (e) {
      ctx.setSubkeys(prev);
      notify(e.message || 'Failed to update status', 'error');
    } finally {
      setStatusLoading(false);
    }
  };

  const deleteSubkey = async () => {
    if (!canManageSubkeys) return denySubkeys();
    if (!editingSubkey) return;
    if (!window.confirm(`Delete subkey "${editingSubkey.name}"?\n\nThis action is irreversible and issued token will stop working immediately.`)) return;
    await api(`/api/subkeys/${editingSubkey.id}`, { method: 'DELETE' });
    notify('Subkey deleted');
    setModal('');
    setEditingSubkey(null);
    await loadSubkeys();
  };

  const STATUSES = ['all', 'active', 'paused', 'revoked'];

  return <div className='page active'><div style={{ padding: '32px 36px' }}><div className='page-header mobile-header-stack' style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><div><div className='page-title'>Subkeys</div><div className='page-sub'>Scoped API tokens you distribute to employees, clients, or teams</div></div><button className='btn btn-primary' aria-disabled={!canManageSubkeys} onClick={() => canManageSubkeys ? setModal('createsubkey') : denySubkeys()}>+ Create subkey</button></div>
    <div className='filter-chips'>{STATUSES.map((s) => <button key={s} className={`filter-chip ${statusFilter === s ? 'active' : ''}`} onClick={() => { setStatusFilter(s); setStatusFilterTouched(true); }}>{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</button>)}</div>
    <div className='card' style={{ padding: 0 }}><TableWrap><table><thead><tr><th className={`sortable ${sortKey === 'name' ? sortDir : ''}`} onClick={() => toggleSort('name')}>Name</th><th>Token</th><th className={`sortable ${sortKey === 'provider' ? sortDir : ''}`} onClick={() => toggleSort('provider')}>Provider</th><th className={`sortable ${sortKey === 'quota' ? sortDir : ''}`} onClick={() => toggleSort('quota')}>Quota</th><th className={`sortable ${sortKey === 'requests' ? sortDir : ''}`} onClick={() => toggleSort('requests')}>Max req</th><th className={`sortable ${sortKey === 'expires' ? sortDir : ''}`} onClick={() => toggleSort('expires')}>Expires</th><th className={`sortable ${sortKey === 'status' ? sortDir : ''}`} onClick={() => toggleSort('status')}>Status</th><th>Actions</th></tr></thead><tbody>{!filteredSubkeys.length ? <tr><td colSpan='8' style={{ textAlign: 'center', color: 'var(--dim)', padding: '32px' }}>{statusFilterTouched || statusFilter !== 'all' ? 'No subkeys were found for this filter. Try choosing a different one.' : <>No subkeys yet — create one above. <button className='btn btn-sm btn-ghost' onClick={() => window.history.pushState({}, '', window.location.pathname.replace('/subkeys', '/masterkeys')) || window.dispatchEvent(new PopStateEvent('popstate'))}>Add Master Key</button></>}</td></tr> : filteredSubkeys.map((sk) => { const pct = pctUsed(sk.tokens_used, sk.monthly_token_limit); const col = quotaColor(sk.tokens_used, sk.monthly_token_limit); const masked = getMaskedSubkey(sk); return <tr key={sk.id}><td style={{ fontWeight: 500 }}>{sk.name}</td><td><div className='token-box' style={{ maxWidth: '200px' }}><span className='token-val'>{masked}</span></div></td><td><span style={{ fontSize: '12px', background: 'var(--bg3)', padding: '3px 8px', borderRadius: '4px', fontFamily: 'DM Mono, monospace' }}>{sk.provider}</span></td><td style={{ minWidth: '120px' }}><div className='quota-bar'><div className={`quota-fill ${col}`} style={{ width: `${pct}%` }} /></div><div className='quota-text'>{fmtNum(sk.tokens_used)} / {fmtNum(sk.monthly_token_limit)}</div></td><td className='mono'>{fmtNum(sk.request_count || 0)} / {fmtNum(sk.max_requests || 5000)}</td><td style={{ fontSize: '12px', color: 'var(--muted)' }}>{fmtDate(sk.expires_at)}</td><td><span className={`badge ${sk.status}`}>{sk.status}</span></td><td><div className='subkey-actions'><button className='btn btn-sm btn-ghost action-primary' aria-disabled={!canManageSubkeys} onClick={() => openEdit(sk)}>Manage</button><button className='btn btn-sm btn-ghost' disabled={receiptLoading} onClick={() => openReceipt(sk)}>{receiptLoading ? 'Preparing...' : 'Generate Receipt'}</button></div></td></tr>; })}</tbody></table></TableWrap></div>

    <div className={`modal-backdrop ${modal === 'createsubkey' ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setModal('')}><div className='modal'><div className='modal-title'>Create subkey</div><div className='form-row'><div className='field'><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder='e.g. Client A — Frontend' /></div><div className='field'><label>Provider</label><select value={provider} onChange={(e) => { setProvider(e.target.value); setSelectedModels(['all']); setMasterKeyId(''); }}>{providerOptions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div></div><div className='form-row'><div className='field'><label>Monthly token limit</label><input type='number' value={limit} onChange={(e) => setLimit(e.target.value)} min='100' /></div><div className='field'><label>Max allowed requests</label><input type='number' value={maxRequests} onChange={(e) => setMaxRequests(e.target.value)} min='1' /></div></div><div className='form-row'><div className='field'><label>Spend ceiling (USD)</label><input type='number' value={spend} onChange={(e) => setSpend(e.target.value)} placeholder='Optional' min='0' step='0.01' /></div></div><div className='form-row'><div className='field'><label>Select master key for this subkey</label><select value={masterKeyId} onChange={(e) => setMasterKeyId(e.target.value)}><option value=''>Auto latest by provider</option>{masterKeys.filter((mk) => mk.provider === provider).map((mk) => <option key={mk.id} value={mk.id}>{mk.name || providerLabel(providerOptions, mk.provider)} ({mk.key_masked})</option>)}</select></div><div className='field'><label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><input type='checkbox' checked={autoRoute} onChange={(e) => setAutoRoute(e.target.checked)} /> Auto-route if selected key is out of credits</label></div></div><div className='form-row single'><div className='field'><label>Expires in (days)</label><input type='number' value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder='Leave blank = never' /></div></div>
      <div className='form-row single'><div className='field'><label>Search model</label><input value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} placeholder='Search models...' /></div></div><div className='form-row single'><div className='field'><label>Allowed models</label><div style={{ maxHeight: '180px', overflow: 'auto', border: '1px solid var(--border)', padding: '8px', borderRadius: '6px' }}><label style={{ display: 'block', marginBottom: '6px' }}><input type='checkbox' checked={selectedModels.includes('all')} onChange={(e) => setSelectedModels(e.target.checked ? ['all'] : [])} /> all</label>{filteredModels.map((m) => <label key={m} style={{ display: 'block', marginBottom: '4px' }}><input type='checkbox' checked={selectedModels.includes('all') ? false : selectedModels.includes(m)} disabled={selectedModels.includes('all')} onChange={(e) => setSelectedModels((prev) => e.target.checked ? [...prev.filter(x => x !== 'all'), m] : prev.filter(x => x !== m))} /> {m}</label>)}</div></div></div>
      <div className='modal-footer'><button className='btn btn-ghost' onClick={() => setModal('')}>Cancel</button><button className='btn btn-primary' aria-disabled={!canManageSubkeys} onClick={createSubkey}>Generate subkey</button></div></div></div>

    <div className={`modal-backdrop ${modal === 'editsubkey' ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setModal('')}><div className='modal subkey-drawer'><div className='modal-title'>Manage Subkey {savedChip && <span className='badge active' style={{ marginLeft: 8 }}>Saved</span>}</div><div className='action-grid' style={{ marginBottom: '12px' }}><button className='btn btn-sm btn-ghost' aria-disabled={!canManageSubkeys || statusLoading} onClick={() => updateStatus('paused')}>Pause</button><button className='btn btn-sm btn-green' aria-disabled={!canManageSubkeys || statusLoading} onClick={() => updateStatus('active')}>Activate</button><button className='btn btn-sm btn-danger' aria-disabled={!canManageSubkeys || statusLoading} onClick={() => updateStatus('revoked')}>{statusLoading ? 'Updating...' : 'Revoke'}</button></div><div className='form-row'><div className='field'><label>Monthly token limit</label><input type='number' min='1' value={editLimit} onChange={(e) => setEditLimit(e.target.value)} /></div><div className='field'><label>Max requests</label><input type='number' min='1' value={editMaxRequests} onChange={(e) => setEditMaxRequests(e.target.value)} /></div></div><div className='form-row single'><div className='field'><label>Expiry extension (days)</label><input type='number' min='1' value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} placeholder='Leave blank to keep existing expiry' /></div></div><div className='modal-footer'><button className='btn btn-danger' aria-disabled={!canManageSubkeys} onClick={deleteSubkey}>Delete subkey</button><button className='btn btn-ghost' onClick={() => setModal('')}>Close</button><button className='btn btn-primary' aria-disabled={!canManageSubkeys || savingEdit} onClick={saveEdit}>{savingEdit ? 'Saving...' : 'Save'}</button></div></div></div>

    <div className={`modal-backdrop receipt-backdrop ${modal === 'subkeyreceipt' ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setModal('')}><div className='modal receipt-modal'><div className='modal-title'>Subkey Receipt Preview</div>{receiptData && <><div className='receipt-preview-card'><div className='receipt-preview-top'><div><div className='receipt-brand'>Lethem Receipt</div><h2>{receiptData.name}</h2><p>Masked subkey, provider, quota, expiry, and recent logs.</p></div><span className={`badge ${receiptData.status}`}>{receiptData.status}</span></div><div className='receipt-preview-grid'><div><span>Receipt No.</span><strong>{receiptData.receiptNo}</strong></div><div><span>Subkey</span><strong className='mono'>{receiptData.token}</strong></div><div><span>Provider</span><strong>{receiptData.provider}</strong></div><div><span>Quota</span><strong>{receiptData.quotaUsed} / {receiptData.quotaLimit}</strong></div><div><span>Requests</span><strong>{receiptData.requestsUsed} / {receiptData.requestsLimit}</strong></div><div><span>Total Spent USD</span><strong>{receiptData.totalSpentUsd}</strong></div><div><span>Expiry</span><strong>{receiptData.expiry}</strong></div></div><div className='receipt-preview-note'>The exported PDF includes clear labels, project details, allowed models, spend controls, total USD spent, quota summary, and recent request logs. Filename: {receiptData.fileName}</div></div><div className='modal-footer'><button className='btn btn-ghost' onClick={() => setModal('')}>Close</button><button className='btn btn-primary' onClick={downloadReceipt}>Export PDF</button></div></>}</div></div>

    <div className={`modal-backdrop ${modal === 'tokenreveal' ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setModal('')}><div className='modal'><div className='modal-title'>Subkey created</div><div style={{ fontSize: '13px', color: 'var(--muted)' }}>Copy this token now. It won't be shown again in full.</div><div className='reveal-box'><div className='reveal-label'>Your subkey token</div><div className='reveal-token'>{revealedToken}</div></div><div className='reveal-warning'><span>⚠</span><span>This is shown once. Save it somewhere safe — your client will use this as their API key.</span></div><div className='modal-footer'><button className='btn btn-ghost copy-btn' onClick={() => { navigator.clipboard.writeText(revealedToken); setRevealCopied(true); setTimeout(() => setRevealCopied(false), 1600); }}>{revealCopied ? <><IconCheck width={16} height={16} /> Copied</> : <><IconCopy width={16} height={16} /> Copy token</>}{revealCopied && <span className='copy-flash'>Copied!</span>}</button><button className='btn btn-primary' onClick={() => setModal('')}>Done</button></div></div></div>
  </div></div>;
}
