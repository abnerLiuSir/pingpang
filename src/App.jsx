import {
  Activity,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  Crown,
  Flame,
  Link2,
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
import { useEffect, useMemo, useRef, useState } from 'react';

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
  const path = window.location.pathname;
  const isAdminRoute = path === '/admin-score-entry';
  const playerRouteMatch = path.match(/^\/players\/(\d+)\/?$/);
  return (
    <div className="app-frame">
      <AppHeader isAdminRoute={isAdminRoute} />
      {isAdminRoute ? <AdminPage /> : playerRouteMatch ? <PlayerHistoryPage playerId={Number(playerRouteMatch[1])} /> : <PublicHome />}
    </div>
  );
}

function AppHeader({ isAdminRoute }) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <a className="brand-lockup" href="/" aria-label="一板成名榜 首页">
          <span className="brand-mark">
            <Activity size={24} aria-hidden="true" />
          </span>
          <span>一板成名榜</span>
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
                <h1>荣誉榜单</h1>
              </div>
              <div className="toolbar-actions">
                <label className="search-box">
                  <Search size={16} aria-hidden="true" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索球员" />
                </label>
                <div className="segmented" role="tablist" aria-label="榜单切换">
                  <button className={mode === 'longTerm' ? 'active' : ''} onClick={() => setMode('longTerm')}>长期积分</button>
                  <button className={mode === 'monthly' ? 'active' : ''} onClick={() => setMode('monthly')}>月度风云</button>
                </div>
              </div>
            </div>

            <section className="leaderboard-card">
              <TopThree players={topThree} mode={mode} showMonthly={mode === 'monthly'} />
              {displayRows.length ? (
                <LeaderboardTable players={displayRows} mode={mode} showMonthly={mode === 'monthly'} startRank={query.trim() ? 1 : 4} />
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
                <h1>近期赛况</h1>
              </div>
              {data.recentMatches.length > 0 && <TrendingUp className="trend-icon" size={24} aria-hidden="true" />}
            </div>
            <RecentMatches matches={data.recentMatches} />
            <MonthlyPanel players={data.monthly} />
            <MonthlyHonorBoard honors={data.monthlyHonors || []} />
          </aside>
        </section>
      )}
    </main>
  );
}

function PlayerHistoryPage({ playerId }) {
  const [scope, setScope] = useState(initialHistoryScope);
  const [opponentId, setOpponentId] = useState('');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  async function loadHistory() {
    setStatus('loading');
    setError('');
    try {
      const params = new URLSearchParams({ scope });
      if (opponentId) params.set('opponentId', opponentId);
      const result = await apiRequest(`/players/${playerId}/matches?${params.toString()}`);
      setData(result);
      setStatus('ready');
    } catch (loadError) {
      setError(loadError.message);
      setStatus('error');
    }
  }

  useEffect(() => {
    loadHistory();
  }, [playerId, scope, opponentId]);

  function switchScope(nextScope) {
    setScope(nextScope);
    setOpponentId('');
    window.history.replaceState(null, '', `/players/${playerId}?scope=${nextScope}`);
  }

  const hasOpponentFilter = Boolean(opponentId);
  const summary = data?.summary;

  return (
    <main className="page-shell history-shell">
      <a className="back-link" href="/">
        <ArrowLeft size={16} aria-hidden="true" />
        返回榜单
      </a>

      {status === 'loading' && <LeaderboardSkeleton />}

      {status === 'error' && (
        <div className="history-error">
          <ErrorState message={error} onRetry={loadHistory} />
          <a className="secondary-button" href="/">回到榜单</a>
        </div>
      )}

      {status === 'ready' && data && (
        <>
          <section className="history-hero">
            <div className="history-player">
              <PlayerAvatar player={data.player} className="history-avatar" />
              <div>
                <p className="section-label">{scope === 'month' ? '月战绩' : '总战绩'}</p>
                <h1>{data.player.name}</h1>
                <p className="header-copy">当前积分 {data.player.rating} pts</p>
              </div>
            </div>
            <div className="history-actions">
              <div className="segmented" role="tablist" aria-label="战绩范围">
                <button className={scope === 'all' ? 'active' : ''} onClick={() => switchScope('all')}>总战绩</button>
                <button className={scope === 'month' ? 'active' : ''} onClick={() => switchScope('month')}>月战绩</button>
              </div>
              <label className="history-filter">
                <span>对手</span>
                <select value={opponentId} onChange={(event) => setOpponentId(event.target.value)}>
                  <option value="">全部对手</option>
                  {data.opponents.map((opponent) => (
                    <option key={opponent.id} value={opponent.id}>{opponent.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="history-stats" aria-label="战绩概览">
            <HistoryStat label="比赛" value={summary.matches} />
            <HistoryStat label="胜负" value={`${summary.wins}胜 ${summary.losses}负`} />
            <HistoryStat label="胜率" value={`${summary.winRate}%`} />
            <HistoryStat label="积分变化" value={<Delta value={summary.ratingDelta} />} />
          </section>

          <section className="history-list-panel">
            <div className="panel-heading compact">
              <div>
                <p className="section-label">Matches</p>
                <h2>{scope === 'month' ? '本月比赛' : '全部比赛'}</h2>
              </div>
              <Swords size={18} aria-hidden="true" />
            </div>

            {data.matches.length ? (
              <div className="history-list">
                {data.matches.map((match) => (
                  <HistoryMatchRow match={match} key={match.id} />
                ))}
              </div>
            ) : (
              <EmptyState
                title={hasOpponentFilter ? '没有对阵记录' : '暂无比赛记录'}
                body={hasOpponentFilter ? '换一个对手，或查看全部对手。' : '后台录入比赛后，这里会显示战绩流水。'}
              />
            )}
          </section>
        </>
      )}
    </main>
  );
}

function initialHistoryScope() {
  return new URLSearchParams(window.location.search).get('scope') === 'month' ? 'month' : 'all';
}

function HistoryStat({ label, value }) {
  return (
    <div className="history-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HistoryMatchRow({ match }) {
  const won = match.result === 'W';
  return (
    <article className={won ? 'history-match won' : 'history-match lost'}>
      <div className="history-match-main">
        <div className="history-result">
          <span>{won ? '胜' : '负'}</span>
        </div>
        <PlayerAvatar
          player={{ name: match.opponentName, avatarUrl: match.opponentAvatarUrl }}
          className="small-avatar"
        />
        <div className="history-opponent">
          <strong>{match.opponentName}</strong>
          <small>{formatHistoryDate(match.playedAt)}</small>
        </div>
      </div>
      <div className="history-match-score">
        <strong>{match.score}</strong>
        <small>{match.playerRatingBefore} → {match.playerRatingAfter}</small>
      </div>
      <div className="history-match-delta">
        <Delta value={match.ratingDelta} />
      </div>
      {match.note && <p className="history-note">{match.note}</p>}
    </article>
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

function TopThree({ players, mode, showMonthly }) {
  if (!players.length) {
    return <EmptyState title="暂无排名" body="添加球员并录入比赛后，首页会显示前三名。" />;
  }

  const [first, second, third] = players;
  return (
    <section className="podium-panel">
      <div className="podium">
        <PodiumPlayer player={second} place="2" level="second" mode={mode} showMonthly={showMonthly} />
        <PodiumPlayer player={first} place="1" level="first" mode={mode} showMonthly={showMonthly} />
        <PodiumPlayer player={third} place="3" level="third" mode={mode} showMonthly={showMonthly} />
      </div>
    </section>
  );
}

function PodiumPlayer({ player, place, level, mode, showMonthly }) {
  if (!player) return <div className={`podium-player ${level} muted`}>--</div>;
  const displayValue = showMonthly ? player.ratingDelta : player.rating;
  return (
    <a className={`podium-player ${level}`} href={playerHistoryHref(player.id, mode)} aria-label={`查看${player.name}战绩`}>
      {place === '1' && <Crown className="podium-crown" size={32} aria-hidden="true" />}
      <div className="avatar-wrap">
        <PlayerAvatar player={player} className="avatar" />
        <span className="rank-mark">{place}</span>
      </div>
      <strong title={player.name}>{player.name}</strong>
      <span className={showMonthly ? 'podium-points monthly' : 'podium-points'}>
        {showMonthly && displayValue > 0 ? `+${displayValue}` : displayValue} pts
      </span>
      <FormDots form={player.recentForm || []} className="podium-form" />
      <div className="podium-step">
        {place === '1' ? <Trophy size={28} aria-hidden="true" /> : <Medal size={24} aria-hidden="true" />}
      </div>
    </a>
  );
}

function MonthlyPanel({ players }) {
  return (
    <section className="compact-panel">
      <div className="panel-heading compact">
        <div>
          <h2>月度风云</h2>
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

function MonthlyHonorBoard({ honors }) {
  return (
    <section className="compact-panel honor-panel">
      <div className="panel-heading compact">
        <div>
          <h2>月度荣誉榜</h2>
        </div>
        <Medal size={18} aria-hidden="true" />
      </div>
      {honors.length ? (
        <div className="honor-list">
          {honors.slice(0, 6).map((honor) => (
            <article className="honor-card" key={honor.id}>
              <div className="honor-photo">
                {honor.photoUrl ? (
                  <img src={honor.photoUrl} alt={`${formatHonorMonth(honor.month)} ${honor.playerName} 冠军照片`} loading="lazy" />
                ) : (
                  <Medal size={28} aria-hidden="true" />
                )}
              </div>
              <div className="honor-info">
                <span className="honor-month">{formatHonorMonth(honor.month)}</span>
                <div className="honor-player">
                  <PlayerAvatar player={{ name: honor.playerName, avatarUrl: honor.playerAvatarUrl }} className="small-avatar" />
                  <strong title={honor.playerName}>{honor.playerName}</strong>
                </div>
                <div className="honor-meta">
                  <Delta value={honor.ratingDelta} />
                  <span>{honor.wins}胜{honor.losses}负</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted-copy">还没有已结算的月度荣誉。</p>
      )}
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
              <PlayerBadge player={{ name: match.winnerName, avatarUrl: match.winnerAvatarUrl }} winner />
              <strong>{match.score}</strong>
              <PlayerBadge player={{ name: match.loserName, avatarUrl: match.loserAvatarUrl }} />
            </div>
          </div>
        </div>
      )) : <p className="muted-copy">暂无比赛流水。</p>}
    </section>
  );
}

function PlayerBadge({ player, winner }) {
  return (
    <div className={winner ? 'player-badge winner' : 'player-badge'}>
      <PlayerAvatar player={player} className="badge-avatar" />
      <strong title={player.name}>{player.name}</strong>
    </div>
  );
}

function PlayerAvatar({ player, className }) {
  if (player.avatarUrl) {
    return (
      <img
        className={className}
        src={player.avatarUrl}
        alt={`${player.name} 头像`}
        loading="lazy"
      />
    );
  }

  return <div className={className}>{player.name.charAt(0)}</div>;
}

function LeaderboardTable({ players, mode, showMonthly, startRank = 1 }) {
  return (
    <div className="rank-list">
      {players.map((player, index) => (
        <a className="rank-row rank-row-link" href={playerHistoryHref(player.id, mode)} key={player.id} aria-label={`查看${player.name}战绩`}>
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
        </a>
      ))}
    </div>
  );
}

function playerHistoryHref(playerId, mode) {
  const scope = mode === 'monthly' ? 'month' : 'all';
  return `/players/${playerId}?scope=${scope}`;
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
          <PanelTitle label="Score Entry" title="录入单打比赛" />
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
                <small>{preview.winner.rating} → {preview.winnerRatingAfter}</small>
              </div>
              <div>
                <span>{preview.loser.name}</span>
                <strong><Delta value={preview.loserDelta} /></strong>
                <small>{preview.loser.rating} → {preview.loserRatingAfter}</small>
              </div>
            </div>
          )}
          <button className="primary-button" disabled={busy || activePlayers.length < 2}>
            {busy ? '提交中' : '提交并更新积分'}
          </button>
        </form>

        <section className="entry-panel players-panel">
          <PanelTitle label="Players" title="球员管理" icon={<Users size={18} aria-hidden="true" />} />
          <form className="player-create-form" onSubmit={addPlayer}>
            <label className="field-block">
              <span>选手姓名</span>
              <input value={newPlayerName} onChange={(event) => setNewPlayerName(event.target.value)} placeholder="新球员姓名" />
            </label>
            <AvatarUploader
              label="头像"
              value={newPlayerAvatar}
              name={newPlayerName}
              onChange={setNewPlayerAvatar}
            />
            <button className="secondary-button" disabled={busy || !newPlayerName.trim()}>
              <Plus size={16} aria-hidden="true" />
              添加
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
                  aria-label={`${player.name} 姓名`}
                />
                <span className="player-rating">{player.rating}</span>
                <button className="icon-button" onClick={() => savePlayer(player)} disabled={busy} title="保存姓名">
                  <Save size={15} aria-hidden="true" />
                </button>
                <button className="small-button" onClick={() => togglePlayer(player)} disabled={busy}>
                  {player.isActive ? '停用' : '恢复'}
                </button>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="entry-panel match-manager">
        <PanelTitle label="Matches" title="比赛记录管理" />
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
                    保存
                  </button>
                  <button className="secondary-button" onClick={() => { setEditingMatchId(null); setMatchDraft(null); }} disabled={busy}>
                    <X size={15} aria-hidden="true" />
                    取消
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="match-admin-summary">
                  <strong>{match.winnerName} {match.score} {match.loserName}</strong>
                  <span>{match.playedAt} · {match.winnerDelta > 0 ? `+${match.winnerDelta}` : match.winnerDelta} / {match.loserDelta}</span>
                  {match.note && <small>{match.note}</small>}
                  {match.isReverted && <em>已删除，不参与积分</em>}
                </div>
                {!match.isReverted && (
                  <div className="row-actions">
                    <button className="icon-button" onClick={() => startEditMatch(match)} disabled={busy} title="编辑比赛">
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                    <button className="icon-button danger" onClick={() => deleteMatch(match.id)} disabled={busy} title="删除比赛">
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
  const [urlValue, setUrlValue] = useState('');
  const [cropSource, setCropSource] = useState('');

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      window.alert('请选择图片文件。');
      return;
    }

    const dataUrl = await readImageFile(file);
    setCropSource(dataUrl);
  }

  function handleUrlSubmit() {
    const nextUrl = urlValue.trim();
    if (!nextUrl) return;
    setCropSource(nextUrl);
  }

  function handleUrlKeyDown(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    handleUrlSubmit();
  }

  function handleCropConfirm(dataUrl) {
    onChange(dataUrl);
    setCropSource('');
    setUrlValue('');
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
            上传头像
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </label>
          {value && (
            <button type="button" className="avatar-clear-button" onClick={() => onChange('')}>
              移除
            </button>
          )}
        </div>
      </div>
      <div className="avatar-url-form">
        <input
          type="text"
          value={urlValue}
          onChange={(event) => setUrlValue(event.target.value)}
          onKeyDown={handleUrlKeyDown}
          placeholder="粘贴图片 URL"
          aria-label="图片 URL"
        />
        <button type="button" className="avatar-url-button" onClick={handleUrlSubmit} disabled={!urlValue.trim()}>
          <Link2 size={14} aria-hidden="true" />
          使用
        </button>
      </div>
      {cropSource && (
        <AvatarCropModal
          source={cropSource}
          onCancel={() => setCropSource('')}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}

function AvatarCropModal({ source, onCancel, onConfirm }) {
  const canvasRef = useRef(null);
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1.2);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    let active = true;
    const nextImage = new Image();
    nextImage.crossOrigin = 'anonymous';
    nextImage.onload = () => {
      if (!active) return;
      setImage(nextImage);
      setError('');
      setScale(1.2);
      setOffsetX(0);
      setOffsetY(0);
    };
    nextImage.onerror = () => {
      if (!active) return;
      setImage(null);
      setError('图片加载失败，请检查 URL 或换一张图片。');
    };
    nextImage.src = source;

    return () => {
      active = false;
    };
  }, [source]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    drawCroppedAvatar(canvas, image, { scale, offsetX, offsetY });
  }, [image, offsetX, offsetY, scale]);

  function handleConfirm() {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    try {
      onConfirm(canvas.toDataURL('image/jpeg', 0.82));
    } catch (confirmationError) {
      setError('当前图片不允许跨域裁剪，请下载后本地上传，或换一个允许访问的图片 URL。');
    }
  }

  return (
    <div className="avatar-crop-backdrop" role="dialog" aria-modal="true" aria-label="调整头像">
      <div className="avatar-crop-modal">
        <div className="avatar-crop-header">
          <div>
            <p className="section-label">头像裁剪</p>
            <h3>调整圆形头像</h3>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} title="关闭">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="avatar-crop-stage">
          <canvas ref={canvasRef} width="160" height="160" aria-label="头像裁剪预览" />
          <span className="avatar-crop-ring" aria-hidden="true" />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="avatar-crop-controls">
          <label>
            <span>缩放</span>
            <input type="range" min="1" max="3" step="0.05" value={scale} onChange={(event) => setScale(Number(event.target.value))} disabled={!image} />
          </label>
          <label>
            <span>左右</span>
            <input type="range" min="-100" max="100" step="1" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} disabled={!image} />
          </label>
          <label>
            <span>上下</span>
            <input type="range" min="-100" max="100" step="1" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} disabled={!image} />
          </label>
        </div>

        <div className="avatar-crop-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="primary-button" onClick={handleConfirm} disabled={!image}>
            保存头像
          </button>
        </div>
      </div>
    </div>
  );
}

function drawCroppedAvatar(canvas, image, { scale, offsetX, offsetY }) {
  const context = canvas.getContext('2d');
  const size = canvas.width;
  if (!context) return;

  context.clearRect(0, 0, size, size);
  context.save();
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  context.clip();

  const coverRatio = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const drawWidth = image.naturalWidth * coverRatio * scale;
  const drawHeight = image.naturalHeight * coverRatio * scale;
  const x = (size - drawWidth) / 2 + offsetX;
  const y = (size - drawHeight) / 2 + offsetY;

  context.drawImage(image, x, y, drawWidth, drawHeight);
  context.restore();
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

function FormDots({ form, className = '' }) {
  if (!form.length) return <span className={className ? `muted-copy ${className}` : 'muted-copy'}>--</span>;
  return (
    <span className={className ? `form-dots ${className}` : 'form-dots'} aria-label={`近况 ${form.join(' ')}`}>
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
      <h2>数据加载失败</h2>
      <p>{message}</p>
      <button className="secondary-button" onClick={onRetry}>重试</button>
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

function formatHistoryDate(value) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function formatHonorMonth(value) {
  if (!value) return '--';
  const [year, month] = String(value).split('-');
  return `${year}年${Number(month)}月`;
}
