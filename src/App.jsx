import {
  Activity,
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  Crown,
  Flame,
  Lock,
  Medal,
  Pencil,
  Plus,
  Save,
  Search,
  Settings,
  Swords,
  Trash2,
  Trophy,
  TrendingUp,
  Upload,
  Users,
  X,
} from 'lucide-react';
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
  return (
    <div className="app-frame">
      <AppHeader isAdminRoute={isAdminRoute} />
      {isAdminRoute ? <AdminPage /> : <PublicHome />}
    </div>
  );
}

function AppHeader({ isAdminRoute }) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <a className="brand-lockup" href="/" aria-label="PingPong Club 首页">
          <span className="brand-mark">
            <Activity size={24} aria-hidden="true" />
          </span>
          <span>PingPong Club</span>
        </a>
        <nav className="top-nav" aria-label="主导航">
          <a className={isAdminRoute ? '' : 'active'} href="/">
            <Trophy size={18} aria-hidden="true" />
            首页
          </a>
          <a className={isAdminRoute ? 'active' : ''} href="/admin-score-entry">
            <Settings size={18} aria-hidden="true" />
            后台管理
          </a>
        </nav>
      </div>
    </header>
  );
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

  const topThree = activeRows.slice(0, 3);
  const displayRows = query.trim() ? filteredRows : filteredRows.slice(3);
  const topPlayer = activeRows[0];

  return (
    <main className="page-shell">
      <section className="stat-grid" aria-label="积分概览">
        <StatCard
          tone="blue"
          label="总选手"
          value={data?.summary?.totalPlayers ?? '--'}
          suffix="人"
          icon={<Users size={80} aria-hidden="true" />}
        />
        <StatCard
          tone="indigo"
          label="总比赛"
          value={data?.summary?.totalMatches ?? '--'}
          suffix="场"
          icon={<Activity size={80} aria-hidden="true" />}
        />
        <StatCard
          tone="orange"
          label="本月热战"
          value={data?.summary?.monthMatches ?? '--'}
          suffix="场"
          icon={<Flame size={80} aria-hidden="true" />}
        />
        <StatCard
          tone="gold"
          label="当前榜首"
          value={topPlayer?.name || '-'}
          icon={<Crown size={80} aria-hidden="true" />}
        />
      </section>

      {status === 'loading' && <LeaderboardSkeleton />}
      {status === 'error' && <ErrorState message={error} onRetry={loadLeaderboard} />}

      {status === 'ready' && (
        <section className="content-grid" aria-label="榜单和近期赛况">
          <section className="leaderboard-area">
            <div className="section-toolbar board-toolbar">
              <div className="title-lockup">
                <span className="title-icon trophy-icon">
                  <Trophy size={24} aria-hidden="true" />
                </span>
                <h1>鑽ｈ獕姒滃崟</h1>
              </div>
              <div className="toolbar-actions">
                <label className="search-box">
                  <Search size={16} aria-hidden="true" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="鎼滅储鐞冨憳" />
                </label>
                <div className="segmented" role="tablist" aria-label="姒滃崟鍒囨崲">
                  <button className={mode === 'longTerm' ? 'active' : ''} onClick={() => setMode('longTerm')}>闀挎湡绉垎</button>
                  <button className={mode === 'monthly' ? 'active' : ''} onClick={() => setMode('monthly')}>鏈堝害椋庝簯</button>
                </div>
              </div>
            </div>

            <section className="leaderboard-card">
              <TopThree players={topThree} showMonthly={mode === 'monthly'} />
              {displayRows.length ? (
                <LeaderboardTable players={displayRows} showMonthly={mode === 'monthly'} startRank={query.trim() ? 1 : 4} />
              ) : (
                <EmptyState title={query.trim() ? '没有匹配的球员' : '暂无更多球员'} body={query.trim() ? '换一个姓名关键字，或等后台录入更多比赛后再查看。' : '前三名之外的球员会显示在这里。'} />
              )}
            </section>
          </section>

          <aside className="matches-area">
            <div className="section-toolbar compact-title">
              <div className="title-lockup">
                <span className="title-icon swords-icon">
                  <Swords size={24} aria-hidden="true" />
                </span>
                <h1>杩戞湡璧涘喌</h1>
              </div>
              {data.recentMatches.length > 0 && <TrendingUp className="trend-icon" size={24} aria-hidden="true" />}
            </div>
            <RecentMatches matches={data.recentMatches} />
            <MonthlyPanel players={data.monthly} />
          </aside>
        </section>
      )}
    </main>
  );
}

function StatCard({ tone, label, value, suffix, icon }) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-content">
        <p>{label}</p>
        <div>
          <strong>{value}</strong>
          {suffix && <span>{suffix}</span>}
        </div>
      </div>
      <div className="stat-watermark">{icon}</div>
    </div>
  );
}

function TopThree({ players, showMonthly }) {
  if (!players.length) {
    return <EmptyState title="暂无排名" body="添加球员并录入比赛后，首页会显示前三名。" />;
  }

  const [first, second, third] = players;
  return (
    <section className="podium-panel">
      <div className="podium">
        <PodiumPlayer player={second} place="2" level="second" showMonthly={showMonthly} />
        <PodiumPlayer player={first} place="1" level="first" showMonthly={showMonthly} />
        <PodiumPlayer player={third} place="3" level="third" showMonthly={showMonthly} />
      </div>
    </section>
  );
}

function PodiumPlayer({ player, place, level, showMonthly }) {
  if (!player) return <div className={`podium-player ${level} muted`}>--</div>;
  const displayValue = showMonthly ? player.ratingDelta : player.rating;
  return (
    <div className={`podium-player ${level}`}>
      {place === '1' && <Crown className="podium-crown" size={32} aria-hidden="true" />}
      <div className="avatar-wrap">
        <PlayerAvatar player={player} className="avatar" />
        <span className="rank-mark">{place}</span>
      </div>
      <strong title={player.name}>{player.name}</strong>
      <span className={showMonthly ? 'podium-points monthly' : 'podium-points'}>
        {showMonthly && displayValue > 0 ? `+${displayValue}` : displayValue} pts
      </span>
      <div className="podium-step">
        {place === '1' ? <Trophy size={28} aria-hidden="true" /> : <Medal size={24} aria-hidden="true" />}
      </div>
    </div>
  );
}

function MonthlyPanel({ players }) {
  return (
    <section className="compact-panel">
      <div className="panel-heading compact">
        <div>
          <h2>鏈堝害椋庝簯</h2>
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
    <section className="timeline-panel">
      {matches.length ? matches.slice(0, 5).map((match) => (
        <div className="timeline-match" key={match.id}>
          <div className="timeline-node">
            <Swords size={16} aria-hidden="true" />
          </div>
          <div className="match-card">
            <div className="match-date">
              <Calendar size={12} aria-hidden="true" />
              <span>{formatMatchDate(match.playedAt)}</span>
            </div>
            <div className="versus-row">
              <PlayerBadge name={match.winnerName} winner />
              <strong>{match.score}</strong>
              <PlayerBadge name={match.loserName} />
            </div>
          </div>
        </div>
      )) : <p className="muted-copy">暂无比赛流水。</p>}
    </section>
  );
}

function PlayerBadge({ name, winner }) {
  return (
    <div className={winner ? 'player-badge winner' : 'player-badge'}>
      <span>{name.charAt(0)}</span>
      <strong title={name}>{name}</strong>
    </div>
  );
}

function PlayerAvatar({ player, className }) {
  if (player.avatarUrl) {
    return (
      <img
        className={className}
        src={player.avatarUrl}
        alt={`${player.name} 澶村儚`}
        loading="lazy"
      />
    );
  }

  return <div className={className}>{player.name.charAt(0)}</div>;
}

function LeaderboardTable({ players, showMonthly, startRank = 1 }) {
  return (
    <div className="rank-list">
      {players.map((player, index) => (
        <div className="rank-row" key={player.id}>
          <div className="rank-left">
            <span className="rank-number">{querylessRank(player.rank, startRank + index)}</span>
            <PlayerAvatar player={player} className="small-avatar" />
            <div>
              <strong>{player.name}</strong>
              <small>{player.wins}胜 {player.losses}负 · 胜率 {player.winRate}%</small>
            </div>
          </div>
          <div className="rank-right">
            <span className="points-pill">{showMonthly ? <Delta value={player.ratingDelta} /> : `${player.rating} pts`}</span>
            <FormDots form={player.recentForm || []} />
          </div>
        </div>
      ))}
    </div>
  );
}

function querylessRank(actualRank, fallbackRank) {
  return actualRank || fallbackRank;
}

function AdminPage() {
  const [token, setToken] = useState(sessionStorage.getItem('adminToken') || '');
  const [passphrase, setPassphrase] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activePlayers, setActivePlayers] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerAvatar, setNewPlayerAvatar] = useState('');
  const [playerDrafts, setPlayerDrafts] = useState({});
  const [playerAvatarDrafts, setPlayerAvatarDrafts] = useState({});
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [matchDraft, setMatchDraft] = useState(null);
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
      const [activeResult, allResult, matchResult, leaderboardResult] = await Promise.all([
        apiRequest('/players', { token: activeToken }),
        apiRequest('/admin/players', { token: activeToken }),
        apiRequest('/admin/matches', { token: activeToken }),
        apiRequest('/leaderboard'),
      ]);
      setActivePlayers(activeResult.players);
      setAllPlayers(allResult.players);
      setMatches(matchResult.matches);
      setLeaderboard(leaderboardResult);
      setPlayerDrafts(Object.fromEntries(allResult.players.map((player) => [player.id, player.name])));
      setPlayerAvatarDrafts(Object.fromEntries(allResult.players.map((player) => [player.id, player.avatarUrl || ''])));
      setForm((current) => ({
        ...current,
        winnerId: current.winnerId || String(activeResult.players[0]?.id || ''),
        loserId: current.loserId || String(activeResult.players[1]?.id || ''),
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

      setSuccess(`${result.match.winnerName} ${result.match.score} ${result.match.loserName}，积分已更新。`);
      setForm((current) => ({ ...current, score: '3:1', note: '' }));
      await loadAdminData(token);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function addPlayer(event) {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    setSuccess(null);
    try {
      const result = await apiRequest('/players', {
        method: 'POST',
        token,
        body: { name: newPlayerName, avatarUrl: newPlayerAvatar },
      });
      setNewPlayerName('');
      setNewPlayerAvatar('');
      setSuccess(`已添加球员：${result.player.name}`);
      await loadAdminData(token);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePlayer(player) {
    setBusy(true);
    setFormError('');
    setSuccess(null);
    try {
      const result = await apiRequest(`/players/${player.id}`, {
        method: 'PATCH',
        token,
        body: {
          name: playerDrafts[player.id],
          avatarUrl: playerAvatarDrafts[player.id] || '',
          isActive: player.isActive,
        },
      });
      setSuccess(`已更新球员：${result.player.name}`);
      await loadAdminData(token);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePlayer(player) {
    setBusy(true);
    setFormError('');
    setSuccess(null);
    try {
      const result = await apiRequest(`/players/${player.id}`, {
        method: 'PATCH',
        token,
        body: { isActive: !player.isActive },
      });
      setSuccess(`${result.player.name} 已${result.player.isActive ? '恢复' : '停用'}。`);
      await loadAdminData(token);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  function startEditMatch(match) {
    setEditingMatchId(match.id);
    setMatchDraft({
      playedAt: match.playedAt,
      winnerId: String(match.winnerId),
      loserId: String(match.loserId),
      score: match.score,
      note: match.note || '',
    });
  }

  async function saveMatch(matchId) {
    setBusy(true);
    setFormError('');
    setSuccess(null);
    try {
      const result = await apiRequest(`/matches/${matchId}`, {
        method: 'PATCH',
        token,
        body: {
          playedAt: matchDraft.playedAt,
          winnerId: Number(matchDraft.winnerId),
          loserId: Number(matchDraft.loserId),
          score: matchDraft.score,
          note: matchDraft.note,
        },
      });
      setEditingMatchId(null);
      setMatchDraft(null);
      setSuccess(`已更新比赛：${result.match.winnerName} ${result.match.score} ${result.match.loserName}`);
      await loadAdminData(token);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteMatch(matchId) {
    if (!window.confirm('确认删除这场比赛？删除后会自动重算积分。')) return;
    setBusy(true);
    setFormError('');
    setSuccess(null);
    try {
      await apiRequest(`/matches/${matchId}`, { method: 'DELETE', token });
      setSuccess('比赛已删除，积分已重算。');
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
          <h1>后台管理</h1>
          <p>输入记录员口令后进入成绩和球员管理页面。</p>
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

  const historySelectPlayers = allPlayers;

  return (
    <main className="page-shell">
      <header className="admin-header">
        <div>
          <p className="section-label">Admin</p>
          <h1>后台管理</h1>
          <p className="header-copy">维护球员、录入比赛、修正历史记录。编辑或删除比赛后会按时间顺序自动重算积分。</p>
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

      {formError && <p className="form-error global-message">{formError}</p>}
      {success && (
        <div className="success-box global-message">
          <Check size={16} aria-hidden="true" />
          {success}
        </div>
      )}

      <section className="admin-grid">
        <form className="entry-panel" onSubmit={submitMatch}>
          <PanelTitle label="Score Entry" title="褰曞叆鍗曟墦姣旇禌" />
          <MatchFields
            players={activePlayers}
            values={form}
            onChange={updateForm}
          />
          {preview && (
            <div className="preview-box">
              <div>
                <span>{preview.winner.name}</span>
                <strong><Delta value={preview.winnerDelta} /></strong>
                <small>{preview.winner.rating} 鈫?{preview.winnerRatingAfter}</small>
              </div>
              <div>
                <span>{preview.loser.name}</span>
                <strong><Delta value={preview.loserDelta} /></strong>
                <small>{preview.loser.rating} 鈫?{preview.loserRatingAfter}</small>
              </div>
            </div>
          )}
          <button className="primary-button" disabled={busy || activePlayers.length < 2}>
            {busy ? '提交中' : '提交并更新积分'}
          </button>
        </form>

        <section className="entry-panel">
          <PanelTitle label="Players" title="鐞冨憳绠＄悊" icon={<Users size={18} aria-hidden="true" />} />
          <form className="player-create-form" onSubmit={addPlayer}>
            <label className="field-block">
              <span>閫夋墜濮撳悕</span>
              <input value={newPlayerName} onChange={(event) => setNewPlayerName(event.target.value)} placeholder="新球员姓名" />
            </label>
            <AvatarUploader
              label="澶村儚"
              value={newPlayerAvatar}
              name={newPlayerName}
              onChange={setNewPlayerAvatar}
            />
            <button className="secondary-button" disabled={busy || !newPlayerName.trim()}>
              <Plus size={16} aria-hidden="true" />
              娣诲姞
            </button>
          </form>
          <div className="manager-list">
            {allPlayers.map((player) => (
              <div className={player.isActive ? 'manager-row' : 'manager-row inactive'} key={player.id}>
                <AvatarUploader
                  value={playerAvatarDrafts[player.id] || ''}
                  name={playerDrafts[player.id] || player.name}
                  onChange={(value) => setPlayerAvatarDrafts((current) => ({ ...current, [player.id]: value }))}
                />
                <input
                  className="manager-name-input"
                  value={playerDrafts[player.id] || ''}
                  onChange={(event) => setPlayerDrafts((current) => ({ ...current, [player.id]: event.target.value }))}
                  aria-label={`${player.name} 濮撳悕`}
                />
                <span className="player-rating">{player.rating}</span>
                <button className="icon-button" onClick={() => savePlayer(player)} disabled={busy} title="淇濆瓨濮撳悕">
                  <Save size={15} aria-hidden="true" />
                </button>
                <button className="small-button" onClick={() => togglePlayer(player)} disabled={busy}>
                  {player.isActive ? '鍋滅敤' : '鎭㈠'}
                </button>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="entry-panel match-manager">
        <PanelTitle label="Matches" title="姣旇禌璁板綍绠＄悊" />
        {matches.length ? matches.map((match) => (
          <div className={match.isReverted ? 'match-admin-card deleted' : 'match-admin-card'} key={match.id}>
            {editingMatchId === match.id ? (
              <>
                <MatchFields
                  players={historySelectPlayers}
                  values={matchDraft}
                  onChange={(field, value) => setMatchDraft((current) => ({ ...current, [field]: value }))}
                />
                <div className="row-actions">
                  <button className="secondary-button" onClick={() => saveMatch(match.id)} disabled={busy}>
                    <Save size={15} aria-hidden="true" />
                    淇濆瓨
                  </button>
                  <button className="secondary-button" onClick={() => { setEditingMatchId(null); setMatchDraft(null); }} disabled={busy}>
                    <X size={15} aria-hidden="true" />
                    鍙栨秷
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="match-admin-summary">
                  <strong>{match.winnerName} {match.score} {match.loserName}</strong>
                  <span>{match.playedAt} 路 {match.winnerDelta > 0 ? `+${match.winnerDelta}` : match.winnerDelta} / {match.loserDelta}</span>
                  {match.note && <small>{match.note}</small>}
                  {match.isReverted && <em>已删除，不参与积分</em>}
                </div>
                {!match.isReverted && (
                  <div className="row-actions">
                    <button className="icon-button" onClick={() => startEditMatch(match)} disabled={busy} title="缂栬緫姣旇禌">
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                    <button className="icon-button danger" onClick={() => deleteMatch(match.id)} disabled={busy} title="鍒犻櫎姣旇禌">
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )) : <EmptyState title="暂无比赛" body="提交第一场比赛后，会在这里管理比赛记录。" />}
      </section>
    </main>
  );
}

function PanelTitle({ label, title, icon }) {
  return (
    <div className="panel-heading compact">
      <div>
        <p className="section-label">{label}</p>
        <h2>{title}</h2>
      </div>
      {icon}
    </div>
  );
}

function AvatarUploader({ label, value, name, onChange }) {
  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      window.alert('请选择图片文件。');
      return;
    }

    const dataUrl = await readImageFile(file);
    onChange(dataUrl);
  }

  return (
    <div className="avatar-uploader">
      {label && <span className="avatar-uploader-label">{label}</span>}
      <div className="avatar-edit-row">
        <div className="avatar-preview">
          {value ? <img src={value} alt={`${name || '球员'} 头像预览`} /> : <span>{(name || '球').charAt(0)}</span>}
        </div>
        <div className="avatar-actions">
          <label className="avatar-upload-button">
            <Upload size={15} aria-hidden="true" />
            涓婁紶澶村儚
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </label>
          {value && (
            <button type="button" className="avatar-clear-button" onClick={() => onChange('')}>
              绉婚櫎
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function MatchFields({ players, values, onChange }) {
  const { winnerGames, loserGames } = scoreParts(values.score);

  function updateScorePart(part, value) {
    const cleanedValue = value.replace(/\D/g, '').slice(0, 2);
    const nextWinnerGames = part === 'winner' ? cleanedValue : winnerGames;
    const nextLoserGames = part === 'loser' ? cleanedValue : loserGames;
    onChange('score', composeScore(nextWinnerGames, nextLoserGames));
  }

  return (
    <>
      <div className="form-grid">
        <label className="field-block">
          <span>比赛日期</span>
          <input type="date" value={values.playedAt} onChange={(event) => onChange('playedAt', event.target.value)} />
        </label>

        <div className="field-block">
          <span>比分</span>
          <div className="score-input-pair">
            <label>
              <small>胜者</small>
              <input
                type="number"
                min="0"
                max="11"
                step="1"
                inputMode="numeric"
                value={winnerGames}
                onChange={(event) => updateScorePart('winner', event.target.value)}
              />
            </label>
            <strong aria-hidden="true">:</strong>
            <label>
              <small>负者</small>
              <input
                type="number"
                min="0"
                max="11"
                step="1"
                inputMode="numeric"
                value={loserGames}
                onChange={(event) => updateScorePart('loser', event.target.value)}
              />
            </label>
          </div>
        </div>

        <label className="field-block">
          <span>胜者</span>
          <select value={values.winnerId} onChange={(event) => onChange('winnerId', event.target.value)}>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} · {player.rating}{player.isActive === false ? ' · 停用' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="field-block">
          <span>负者</span>
          <select value={values.loserId} onChange={(event) => onChange('loserId', event.target.value)}>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} · {player.rating}{player.isActive === false ? ' · 停用' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field-block">
        <span>备注</span>
        <textarea value={values.note || ''} onChange={(event) => onChange('note', event.target.value)} rows={3} placeholder="可记录场地、轮次或其他说明" />
      </label>
    </>
  );
}

function scoreParts(score) {
  const match = String(score || '').trim().match(/^(\d{0,2}):(\d{0,2})/);
  if (!match) return { winnerGames: '', loserGames: '' };
  return { winnerGames: match[1] || '', loserGames: match[2] || '' };
}

function composeScore(winnerGames, loserGames) {
  return `${winnerGames}:${loserGames}`;
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
    <span className="form-dots" aria-label={`杩戝喌 ${form.join(' ')}`}>
      {form.map((item, index) => (
        <span key={`${item}-${index}`} className={item === 'W' ? 'win' : 'loss'}>{item}</span>
      ))}
    </span>
  );
}

function LeaderboardSkeleton() {
  return (
    <section className="skeleton-panel" aria-label="姝ｅ湪鍔犺浇">
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
      <h2>鏁版嵁鍔犺浇澶辫触</h2>
      <p>{message}</p>
      <button className="secondary-button" onClick={onRetry}>閲嶈瘯</button>
    </div>
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

function formatMatchDate(value) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
