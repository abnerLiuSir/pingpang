import { Activity, ArrowDown, ArrowUp, Check, Lock, RotateCcw, Search, Trophy } from 'lucide-react';
import React from 'react';
import { useEffect, useMemo, useState } from 'react';

const API_BASE = '/api';

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || '请求失败，请稍后重试。');
  }

  return data;
}

export function App() {
  const isAdminRoute = window.location.pathname === '/admin-score-entry';
  return isAdminRoute ? <AdminPage /> : <PublicHome />;
}

function PublicHome() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('longTerm');

  async function loadLeaderboard() {
    setStatus('loading');
    setError('');
    try {
      const result = await apiRequest('/leaderboard');
      setData(result);
      setStatus('ready');
    } catch (loadError) {
      setError(loadError.message);
      setStatus('error');
    }
  }

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const activeRows = mode === 'longTerm' ? data?.longTerm || [] : data?.monthly || [];
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return activeRows;
    return activeRows.filter((player) => player.name.toLowerCase().includes(normalizedQuery));
  }, [activeRows, query]);

  const topThree = data?.longTerm?.slice(0, 3) || [];

  return (
    <main className="page-shell">
      <header className="public-header">
        <div>
          <p className="section-label">PingPang Rating</p>
          <h1>公司乒乓积分</h1>
          <p className="header-copy">长期积分不清零，本月榜记录最近状态。最后更新：{formatDateTime(data?.summary?.updatedAt)}</p>
        </div>
        <div className="summary-strip" aria-label="积分概览">
          <SummaryItem label="球员" value={data?.summary?.totalPlayers ?? '--'} />
          <SummaryItem label="总比赛" value={data?.summary?.totalMatches ?? '--'} />
          <SummaryItem label="本月" value={data?.summary?.monthMatches ?? '--'} />
        </div>
      </header>

      {status === 'loading' && <LeaderboardSkeleton />}
      {status === 'error' && <ErrorState message={error} onRetry={loadLeaderboard} />}

      {status === 'ready' && (
        <>
          <section className="hero-grid" aria-label="榜首和月度数据">
            <TopThree players={topThree} />
            <aside className="side-stack">
              <MonthlyPanel players={data.monthly} />
              <RecentMatches matches={data.recentMatches} />
            </aside>
          </section>

          <section className="leaderboard-section">
            <div className="section-toolbar">
              <div>
                <h2>{mode === 'longTerm' ? '长期积分榜' : '本月涨分榜'}</h2>
                <p>按姓名搜索，快速查看同事当前排名和近期状态。</p>
              </div>
              <div className="toolbar-actions">
                <label className="search-box">
                  <Search size={16} aria-hidden="true" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索球员" />
                </label>
                <div className="segmented" role="tablist" aria-label="榜单切换">
                  <button className={mode === 'longTerm' ? 'active' : ''} onClick={() => setMode('longTerm')}>长期榜</button>
                  <button className={mode === 'monthly' ? 'active' : ''} onClick={() => setMode('monthly')}>本月榜</button>
                </div>
              </div>
            </div>

            {filteredRows.length ? (
              <LeaderboardTable players={filteredRows} showMonthly={mode === 'monthly'} />
            ) : (
              <EmptyState title="没有匹配的球员" body="换一个姓名关键字，或等后台录入更多比赛后再查看。" />
            )}
          </section>
        </>
      )}
    </main>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TopThree({ players }) {
  if (!players.length) {
    return <EmptyState title="暂无排名" body="添加球员并录入比赛后，首页会显示前三名。" />;
  }

  const [first, second, third] = players;
  return (
    <section className="podium-panel">
      <div className="panel-heading">
        <div>
          <p className="section-label">Leaderboard</p>
          <h2>当前前三</h2>
        </div>
        <Trophy size={22} aria-hidden="true" />
      </div>
      <div className="podium">
        <PodiumPlayer player={second} place="2" level="second" />
        <PodiumPlayer player={first} place="1" level="first" />
        <PodiumPlayer player={third} place="3" level="third" />
      </div>
    </section>
  );
}

function PodiumPlayer({ player, place, level }) {
  if (!player) return <div className={`podium-card ${level} muted`}>--</div>;
  return (
    <div className={`podium-card ${level}`}>
      <span className="rank-mark">{place}</span>
      <strong>{player.name}</strong>
      <span>{player.rating}</span>
      <small>{player.wins}胜 {player.losses}负</small>
    </div>
  );
}

function MonthlyPanel({ players }) {
  return (
    <section className="compact-panel">
      <div className="panel-heading compact">
        <div>
          <p className="section-label">Month</p>
          <h2>本月榜</h2>
        </div>
        <Activity size={18} aria-hidden="true" />
      </div>
      {players.length ? players.slice(0, 5).map((player) => (
        <div className="mini-row" key={player.id}>
          <span>{player.rank}</span>
          <strong>{player.name}</strong>
          <Delta value={player.ratingDelta} />
        </div>
      )) : <p className="muted-copy">本月还没有比赛记录。</p>}
    </section>
  );
}

function RecentMatches({ matches }) {
  return (
    <section className="compact-panel">
      <div className="panel-heading compact">
        <div>
          <p className="section-label">Recent</p>
          <h2>最近比赛</h2>
        </div>
      </div>
      {matches.length ? matches.slice(0, 5).map((match) => (
        <div className="match-row" key={match.id}>
          <span>{match.winnerName}</span>
          <strong>{match.score}</strong>
          <span>{match.loserName}</span>
        </div>
      )) : <p className="muted-copy">暂无比赛流水。</p>}
    </section>
  );
}

function LeaderboardTable({ players, showMonthly }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>排名</th>
            <th>球员</th>
            <th>积分</th>
            <th>胜负</th>
            <th>胜率</th>
            <th>{showMonthly ? '本月变化' : '总变化'}</th>
            <th>近 5 场</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id}>
              <td>{player.rank}</td>
              <td><strong>{player.name}</strong></td>
              <td className="number-cell">{player.rating}</td>
              <td>{player.wins} / {player.losses}</td>
              <td>{player.winRate}%</td>
              <td><Delta value={player.ratingDelta} /></td>
              <td><FormDots form={player.recentForm || []} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Delta({ value }) {
  const className = value > 0 ? 'delta positive' : value < 0 ? 'delta negative' : 'delta neutral';
  const Icon = value >= 0 ? ArrowUp : ArrowDown;
  return (
    <span className={className}>
      <Icon size={14} aria-hidden="true" />
      {value > 0 ? `+${value}` : value}
    </span>
  );
}

function FormDots({ form }) {
  if (!form.length) return <span className="muted-copy">--</span>;
  return (
    <span className="form-dots" aria-label={`近况 ${form.join(' ')}`}>
      {form.map((item, index) => (
        <span key={`${item}-${index}`} className={item === 'W' ? 'win' : 'loss'}>{item}</span>
      ))}
    </span>
  );
}

function LeaderboardSkeleton() {
  return (
    <section className="skeleton-panel" aria-label="正在加载">
      {Array.from({ length: 8 }).map((_, index) => <div className="skeleton-row" key={index} />)}
    </section>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="empty-state error-state">
      <h2>数据加载失败</h2>
      <p>{message}</p>
      <button className="secondary-button" onClick={onRetry}>重试</button>
    </div>
  );
}

function AdminPage() {
  const [token, setToken] = useState(sessionStorage.getItem('adminToken') || '');
  const [passphrase, setPassphrase] = useState('');
  const [loginError, setLoginError] = useState('');
  const [players, setPlayers] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [form, setForm] = useState({
    winnerId: '',
    loserId: '',
    score: '3:1',
    playedAt: today(),
    note: '',
  });
  const [preview, setPreview] = useState(null);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);

  async function login(event) {
    event.preventDefault();
    setLoginError('');
    setBusy(true);
    try {
      const result = await apiRequest('/admin/login', {
        method: 'POST',
        body: { passphrase },
      });
      sessionStorage.setItem('adminToken', result.token);
      setToken(result.token);
      setPassphrase('');
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadAdminData(activeToken = token) {
    if (!activeToken) return;
    setFormError('');
    try {
      const [playerResult, leaderboardResult] = await Promise.all([
        apiRequest('/players', { token: activeToken }),
        apiRequest('/leaderboard'),
      ]);
      setPlayers(playerResult.players);
      setLeaderboard(leaderboardResult);
      setForm((current) => ({
        ...current,
        winnerId: current.winnerId || String(playerResult.players[0]?.id || ''),
        loserId: current.loserId || String(playerResult.players[1]?.id || ''),
      }));
    } catch (error) {
      setFormError(error.message);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, [token]);

  useEffect(() => {
    async function loadPreview() {
      if (!token || !form.winnerId || !form.loserId || form.winnerId === form.loserId) {
        setPreview(null);
        return;
      }

      try {
        const result = await apiRequest('/matches/preview', {
          method: 'POST',
          token,
          body: {
            winnerId: Number(form.winnerId),
            loserId: Number(form.loserId),
          },
        });
        setPreview(result);
      } catch {
        setPreview(null);
      }
    }

    loadPreview();
  }, [token, form.winnerId, form.loserId]);

  function updateForm(field, value) {
    setSuccess(null);
    setFormError('');
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitMatch(event) {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    setSuccess(null);

    try {
      const result = await apiRequest('/matches', {
        method: 'POST',
        token,
        body: {
          winnerId: Number(form.winnerId),
          loserId: Number(form.loserId),
          score: form.score,
          playedAt: form.playedAt,
          note: form.note,
        },
      });

      setSuccess(result.match);
      setForm((current) => ({
        ...current,
        score: '3:1',
        note: '',
      }));
      await loadAdminData(token);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function revertMatch(id) {
    setBusy(true);
    setFormError('');
    try {
      const result = await apiRequest(`/matches/${id}/revert`, {
        method: 'POST',
        token,
      });
      setSuccess({ ...result.match, reverted: true });
      await loadAdminData(token);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="page-shell admin-shell">
        <form className="login-panel" onSubmit={login}>
          <Lock size={22} aria-hidden="true" />
          <h1>后台录入</h1>
          <p>输入记录员口令后进入成绩录入页面。</p>
          <label className="field-block">
            <span>访问口令</span>
            <input className="visually-hidden" type="text" autoComplete="username" value="score-keeper" readOnly />
            <input
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="输入口令"
              autoComplete="current-password"
              autoFocus
            />
          </label>
          {loginError && <p className="form-error">{loginError}</p>}
          <button className="primary-button" disabled={busy || !passphrase}>
            {busy ? '验证中' : '进入后台'}
          </button>
        </form>
      </main>
    );
  }

  const recentMatches = leaderboard?.recentMatches || [];

  return (
    <main className="page-shell">
      <header className="admin-header">
        <div>
          <p className="section-label">Admin</p>
          <h1>比赛录入</h1>
          <p className="header-copy">只记录 1v1 单打。选择双方后会先预估 Elo 积分变化。</p>
        </div>
        <button
          className="secondary-button"
          onClick={() => {
            sessionStorage.removeItem('adminToken');
            setToken('');
          }}
        >
          退出后台
        </button>
      </header>

      <section className="admin-grid">
        <form className="entry-panel" onSubmit={submitMatch}>
          <div className="panel-heading compact">
            <div>
              <p className="section-label">Score Entry</p>
              <h2>录入单打比赛</h2>
            </div>
          </div>

          <div className="form-grid">
            <label className="field-block">
              <span>比赛日期</span>
              <input type="date" value={form.playedAt} onChange={(event) => updateForm('playedAt', event.target.value)} />
            </label>

            <label className="field-block">
              <span>比分</span>
              <select value={form.score} onChange={(event) => updateForm('score', event.target.value)}>
                <option value="3:0">3:0</option>
                <option value="3:1">3:1</option>
                <option value="3:2">3:2</option>
              </select>
            </label>

            <label className="field-block">
              <span>胜者</span>
              <select value={form.winnerId} onChange={(event) => updateForm('winnerId', event.target.value)}>
                {players.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.rating}</option>)}
              </select>
            </label>

            <label className="field-block">
              <span>负者</span>
              <select value={form.loserId} onChange={(event) => updateForm('loserId', event.target.value)}>
                {players.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.rating}</option>)}
              </select>
            </label>
          </div>

          <label className="field-block">
            <span>备注</span>
            <textarea value={form.note} onChange={(event) => updateForm('note', event.target.value)} rows={3} placeholder="可记录场地、轮次或其他说明" />
          </label>

          {preview && (
            <div className="preview-box">
              <div>
                <span>{preview.winner.name}</span>
                <strong><Delta value={preview.winnerDelta} /></strong>
                <small>{preview.winner.rating} → {preview.winnerRatingAfter}</small>
              </div>
              <div>
                <span>{preview.loser.name}</span>
                <strong><Delta value={preview.loserDelta} /></strong>
                <small>{preview.loser.rating} → {preview.loserRatingAfter}</small>
              </div>
            </div>
          )}

          {formError && <p className="form-error">{formError}</p>}
          {success && (
            <div className={success.reverted ? 'success-box revert' : 'success-box'}>
              <Check size={16} aria-hidden="true" />
              {success.reverted ? '已撤销最近一场比赛。' : `${success.winnerName} ${success.score} ${success.loserName}，积分已更新。`}
            </div>
          )}

          <button className="primary-button" disabled={busy || !players.length}>
            {busy ? '提交中' : '提交并更新积分'}
          </button>
        </form>

        <section className="entry-panel">
          <div className="panel-heading compact">
            <div>
              <p className="section-label">Recent</p>
              <h2>最近比赛</h2>
            </div>
          </div>

          {recentMatches.length ? recentMatches.map((match, index) => (
            <div className="admin-match-row" key={match.id}>
              <div>
                <strong>{match.winnerName} {match.score} {match.loserName}</strong>
                <span>{match.playedAt} · {match.winnerDelta > 0 ? `+${match.winnerDelta}` : match.winnerDelta} / {match.loserDelta}</span>
              </div>
              {index === 0 && (
                <button className="icon-button" onClick={() => revertMatch(match.id)} disabled={busy} title="撤销最近一场">
                  <RotateCcw size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          )) : <EmptyState title="暂无比赛" body="提交第一场比赛后，会在这里显示最近记录。" />}
        </section>
      </section>
    </main>
  );
}

function formatDateTime(value) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
