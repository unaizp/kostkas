// Main App Logic

// Main App Logic

const PLAYER_EMOJIS = ['⛹️‍♂️', '🤾', '🦍', '🦁', '🐯', '🦈', '🦅', '🐗', '🐺', '🦊', '🐻', '🐼', '🐨', '🦖', '🐉', '🏄', '🏂', '🥋', '🥊', '🏋️‍♂️'];

function getEmojiForName(name) {
    if (!name) return '👤';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % PLAYER_EMOJIS.length;
    return PLAYER_EMOJIS[index];
}

document.addEventListener('DOMContentLoaded', async () => {
    initializeTheme();
    setupThemeToggles();
    await loadData();
});

let allMatches = []; // Store all processed matches
let players = [];    // Store unique player names
let currentMonth = 'all';

async function loadData() {
    try {
        // Add timestamp to prevent caching
        const response = await fetch(`data/Campeonato Kostkas 2025_2026.xlsx?v=${new Date().getTime()}`);
        if (!response.ok) throw new Error('No se pudo cargar el archivo Excel.');

        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        // Assuming data is in "Partidos" tab or the first tab
        const sheetName = workbook.SheetNames.includes('Partidos') ? 'Partidos' : workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Parse JS object
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        processData(rawData);
        renderApp();
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('statsTableBody').innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-8">Error cargando datos: ${error.message}</td></tr>`;
    }
}

function processData(rawData) {
    if (!rawData || rawData.length === 0) return;

    // Row 0 is headers usually: [MatchNum, Date, PlayersCount, Player1, Player2...]
    // Check where players start. Usually column 3 (D) if A=Num, B=Date, C=Count.
    // Let's verify columns based on user description:
    // A: Num, B: Date, C: Count. Players start at D (index 3).

    const headers = rawData[0];
    const playerStartIndex = 3;
    players = headers.slice(playerStartIndex).filter(h => h && typeof h === 'string'); // Extract player names

    allMatches = rawData.slice(1).map(row => {
        // Skip empty rows
        if (!row[0]) return null;

        const dateVal = row[1];
        let dateObj = null;

        // Handle Excel Date serial numbers or date strings
        if (typeof dateVal === 'number') {
            // Excel date serial to JS Date (approx)
            // Or rely on cellDates: true from XLSX.read which should give us Date objects directly if formatted as date
            dateObj = new Date((dateVal - (25567 + 2)) * 86400 * 1000); // Simple fallback if not parsed
        } else if (dateVal instanceof Date) {
            dateObj = dateVal;
        } else {
            dateObj = new Date(dateVal);
        }

        const match = {
            id: row[0],
            date: dateObj,
            count: row[2],
            results: {}
        };

        // Map player results
        players.forEach((player, index) => {
            const cellValue = row[playerStartIndex + index];
            if (cellValue == 1 || cellValue == 2) {
                match.results[player] = cellValue; // 1 = Loss, 2 = Win, 1 (Played), 2 (Win)
            }
        });

        return match;
    }).filter(m => m !== null);

    populateMonthFilter();
}

function calculateStats(matchesToUse) {
    const stats = {};

    // Initialize
    players.forEach(p => {
        stats[p] = {
            name: p,
            played: 0,
            won: 0,
            points: 0,
            streak: [], // Last 5
            allResults: [] // For streak calc from filtered data? Usually streak is chronological
        };
    });

    // Sort matches chronologically just in case
    const sortedMatches = [...matchesToUse].sort((a, b) => a.date - b.date);

    sortedMatches.forEach(match => {
        players.forEach(player => {
            const res = match.results[player];
            if (res) {
                stats[player].played++;

                // Logic: 1 = Played (Loss implied in context of "1 played, 2 win" usually means 1pt for loss, 2pts for win)
                // User said: "1 significa que ha perdido, 2 que ha ganado"
                // Points: "1 jugado, 2 victoria" -> This means 1 point for loss, 2 points for win.

                let pts = 0;
                let isWin = false;

                if (res == 1) {
                    pts = 1;
                    isWin = false;
                } else if (res == 2) {
                    pts = 2;
                    stats[player].won++;
                    isWin = true;
                }

                stats[player].points += pts;

                // Track streak
                stats[player].allResults.push(isWin ? 'W' : 'L');
            }
        });
    });

    // Finalize stats
    Object.values(stats).forEach(s => {
        s.percentage = s.played > 0 ? (s.won / s.played) * 100 : 0;
        s.streak = s.allResults.slice(-5); // Last 5
    });

    return Object.values(stats);
}

// --- Theme Logic ---

function initializeTheme() {
    // Check local storage or system preference
    if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        updateThemeIcons(true);
    } else {
        document.documentElement.classList.remove('dark');
        updateThemeIcons(false);
    }
}

function setupThemeToggles() {
    const toggleDesktop = document.getElementById('themeToggleDesktop');
    const toggleMobile = document.getElementById('themeToggleMobile');

    [toggleDesktop, toggleMobile].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('color-theme', isDark ? 'dark' : 'light');
                updateThemeIcons(isDark);
            });
        }
    });
}

function updateThemeIcons(isDark) {
    const suns = ['sunIconDesktop', 'sunIconMobile'];
    const moons = ['moonIconDesktop', 'moonIconMobile'];

    // If dark, show Sun (to switch to light), hide Moon
    // Wait, usually: Dark mode active -> Show Sun icon (to switch to light)
    // Light mode active -> Show Moon icon (to switch to dark)

    suns.forEach(id => {
        const el = document.getElementById(id);
        if (el) isDark ? el.classList.remove('hidden') : el.classList.add('hidden');
    });

    moons.forEach(id => {
        const el = document.getElementById(id);
        if (el) isDark ? el.classList.add('hidden') : el.classList.remove('hidden');
    });
}

function renderApp() {
    const { stats, threshold, filteredMatches } = processStatsForDisplay();

    // Sort stats based on current configuration
    stats.sort((a, b) => {
        // Handle sorting for 'name' specifically as it is a string
        if (lastSortCol === 'name') {
            return sortDir === 1 ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        }
        // Handle numeric sorting for other columns
        return sortDir === 1 ? a[lastSortCol] - b[lastSortCol] : b[lastSortCol] - a[lastSortCol];
    });

    renderTable(stats);
    renderTopLists(stats, threshold);
    renderMonthlyMVP(stats);
    renderTeamStats(filteredMatches);
}

function processStatsForDisplay() {
    // Filter matches based on currentMonth
    let filteredMatches = allMatches;
    if (currentMonth !== 'all') {
        filteredMatches = allMatches.filter(m => {
            if (!m.date) return false;
            // format YYYY-MM
            const mKey = `${m.date.getFullYear()}-${String(m.date.getMonth() + 1).padStart(2, '0')}`;
            return mKey === currentMonth;
        });
    }

    const stats = calculateStats(filteredMatches);
    const totalMatchesInFilter = filteredMatches.length;

    // 25% Threshold calculation
    const threshold = totalMatchesInFilter * 0.25;

    return { stats, threshold, filteredMatches };
}

function renderTable(stats) {
    const tbody = document.getElementById('statsTableBody');
    tbody.innerHTML = '';

    stats.forEach(player => {
        const tr = document.createElement('tr');
        tr.className = 'bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors';
        tr.innerHTML = `
            <td class="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                <button onclick="openPlayerModal('${player.name}')" class="flex items-center hover:text-brand-600 dark:hover:text-brand-400 transition-colors text-left">
                    <span class="mr-2 text-lg">${getEmojiForName(player.name)}</span>
                    <span class="underline decoration-slate-300 underline-offset-4 decoration-1">${player.name}</span>
                </button>
            </td>
            <td class="px-6 py-4 text-center">${player.played}</td>
            <td class="px-6 py-4 text-center">${player.won}</td>
            <td class="px-6 py-4 text-center font-bold text-brand-600">${player.points}</td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    <span class="text-xs font-medium ${player.percentage >= 50 ? 'text-green-600' : 'text-slate-500'}">${player.percentage.toFixed(1)}%</span>
                    <div class="w-16 bg-slate-200 rounded-full h-1.5">
                        <div class="bg-brand-500 h-1.5 rounded-full" style="width: ${player.percentage}%"></div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-1">
                    ${player.streak.map(r => `<span class="streak-dot ${r === 'W' ? 'streak-w' : 'streak-l'}"></span>`).join('')}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTopLists(stats, threshold) {
    // Filter qualifying players
    const qualified = stats.filter(p => p.played >= threshold);

    // Top Points (Anyone can qualify? Usually top lists imply qualification, but for points it's usually absolute. 
    // Requirement says: "si ha jugado al menos el 25% de los partidos" applies to "top 5 de más puntos, más partidos jugados y mejor porcentaje".
    // Actually typically, Points and Played don't need a % threshold, but user said:
    // "hacer un top 5 de más puntos, más partidos jugados y mejor porcentaje (si ha jugado al menos el 25% de los partidos)."
    // It implies the condition applies to all. I will apply it to all.

    const topPoints = [...qualified].sort((a, b) => b.points - a.points).slice(0, 5);
    const topPlayed = [...qualified].sort((a, b) => b.played - a.played).slice(0, 5);
    const topPercent = [...qualified].sort((a, b) => b.percentage - a.percentage).slice(0, 5);

    renderList('topPointsContainer', topPoints, p => `${p.points} pts`);
    renderList('topPlayedContainer', topPlayed, p => `${p.played} PJ`);
    renderList('topPercentContainer', topPercent, p => `${p.percentage.toFixed(1)}%`);
}

function renderList(containerId, list, valueFn) {
    const el = document.getElementById(containerId);
    if (list.length === 0) {
        el.innerHTML = '<div class="text-sm text-slate-400">Sin datos suficientes</div>';
        return;
    }
    el.innerHTML = list.map((p, i) => `
        <div class="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700 last:border-0">
            <div class="flex items-center gap-3">
                <span class="text-xs font-bold text-slate-400 w-4">${i + 1}</span>
                <span class="text-sm font-medium text-slate-700 dark:text-slate-300">${p.name}</span>
            </div>
            <span class="text-sm font-bold text-brand-600 dark:text-brand-400">${valueFn(p)}</span>
        </div>
    `).join('');
}

function renderMonthlyMVP(stats) {
    // Logic: Best player of the month (Most points).
    // If not filtered by month, maybe show current month? Or hide?
    // Requirement: "top mensual con el mejor jugador (más puntos) de cada mes."
    // This sounds like a separate list, OR if filter is active, show MVP of that month.
    // Let's implement MVP of current selection for now.

    const container = document.getElementById('monthlyMvpSection');

    // Pick winner
    // If multiple, pick one or tie logic? Just pick first for now.
    const sorted = [...stats].sort((a, b) => b.points - a.points);
    const mvp = sorted[0];

    if (mvp && mvp.points > 0) {
        container.classList.remove('hidden');
        document.getElementById('monthlyMvpName').textContent = mvp.name;
        document.getElementById('monthlyMvpStats').textContent = `${mvp.points} Puntos | ${mvp.won} Victorias | ${mvp.percentage.toFixed(0)}% Vic`;
    } else {
        container.classList.add('hidden');
    }
}

function populateMonthFilter() {
    const selector = document.getElementById('monthFilter');
    // Extract unique months from allMatches
    const months = new Set();
    allMatches.forEach(m => {
        if (m.date) {
            const mKey = `${m.date.getFullYear()}-${String(m.date.getMonth() + 1).padStart(2, '0')}`;
            months.add(mKey);
        }
    });

    // Sort months DESC
    const sortedMonths = Array.from(months).sort().reverse();

    // Clear existing options except first
    selector.innerHTML = '<option value="all">Toda la temporada</option>';

    sortedMonths.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        // Format label: "2025-01" -> "Enero 2025" or similar
        const [y, monthNum] = m.split('-');
        const date = new Date(parseInt(y), parseInt(monthNum) - 1, 1);
        const label = date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        opt.textContent = label.charAt(0).toUpperCase() + label.slice(1);
        selector.appendChild(opt);
    });

    selector.addEventListener('change', (e) => {
        currentMonth = e.target.value;
        renderApp();
    });
}

// Global Sort Function
let sortDir = -1; // -1 Desc, 1 Asc
let lastSortCol = 'points';

window.sortTable = function (col) {
    if (lastSortCol === col) {
        sortDir *= -1;
    } else {
        lastSortCol = col;
        sortDir = -1; // Default desc for new col
    }
    renderApp();
}

// --- Match History Modal Logic ---

window.openMatchModal = function () {
    const modal = document.getElementById('matchModal');
    modal.classList.remove('hidden');
    renderMatchHistory();
}

window.closeMatchModal = function () {
    const modal = document.getElementById('matchModal');
    modal.classList.add('hidden');
}

// --- Player Details Modal Logic ---

window.openPlayerModal = function (playerName) {
    const modal = document.getElementById('playerModal');
    const { stats } = processStatsForDisplay();
    const playerStats = stats.find(p => p.name === playerName);

    if (!playerStats) return;

    modal.classList.remove('hidden');
    renderPlayerDetails(playerStats);
}

window.closePlayerModal = function () {
    const modal = document.getElementById('playerModal');
    modal.classList.add('hidden');
}

function renderPlayerDetails(player) {
    // Header
    const titleEl = document.getElementById('playerModalTitle');
    titleEl.innerHTML = `<span class="text-2xl">${getEmojiForName(player.name)}</span> ${player.name}`;

    // Body
    const bodyEl = document.getElementById('playerModalBody');

    // Calculate Affinity
    const affinity = calculateAffinity(player.name);

    bodyEl.innerHTML = `
        <!-- Key Stats -->
        <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg text-center">
                <span class="block text-xs text-slate-500 dark:text-slate-400 uppercase">Partidos</span>
                <span class="block text-xl font-bold text-slate-900 dark:text-white">${player.played}</span>
            </div>
            <div class="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg text-center">
                <span class="block text-xs text-slate-500 dark:text-slate-400 uppercase">Victorias</span>
                <span class="block text-xl font-bold text-brand-600 dark:text-brand-400">${player.won}</span>
            </div>
            <div class="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg text-center">
                <span class="block text-xs text-slate-500 dark:text-slate-400 uppercase">Puntos</span>
                <span class="block text-xl font-bold text-slate-900 dark:text-white">${player.points}</span>
            </div>
            <div class="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg text-center">
                <span class="block text-xs text-slate-500 dark:text-slate-400 uppercase">% Victoria</span>
                <span class="block text-xl font-bold ${player.percentage >= 50 ? 'text-green-600' : 'text-slate-500'}">${player.percentage.toFixed(1)}%</span>
            </div>
        </div>

        <!-- Affinity Lists -->
        <div class="space-y-4">
            <div>
                <h4 class="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <span class="text-green-500">🤝</span> Gana más con
                </h4>
                <div class="bg-slate-50 dark:bg-slate-700/30 rounded-lg divide-y divide-slate-100 dark:divide-slate-700/50">
                    ${renderAffinityList(affinity.best, 'text-green-600')}
                </div>
            </div>
            
            <div>
                <h4 class="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <span class="text-red-500">💔</span> Pierde más con
                </h4>
                <div class="bg-slate-50 dark:bg-slate-700/30 rounded-lg divide-y divide-slate-100 dark:divide-slate-700/50">
                    ${renderAffinityList(affinity.worst, 'text-red-500')}
                </div>
            </div>
        </div>
    `;
}

function calculateAffinity(playerName) {
    const mates = {}; // { teammateName: { won: 0, lost: 0 } }

    // Use allMatches, not filtered? Usually affinity is historical.
    // Let's use allMatches to get better data sample.
    allMatches.forEach(match => {
        // Did our player play?
        const myResult = match.results[playerName];
        if (!myResult) return; // Didn't play

        // Iterate other players in this match
        Object.keys(match.results).forEach(teammate => {
            if (teammate === playerName) return;

            // Did teammate play? Yes, if in results.
            if (!mates[teammate]) mates[teammate] = { won: 0, lost: 0, name: teammate };

            // Check if we won or lost together?
            const teammateResult = match.results[teammate];

            if (myResult == 2 && teammateResult == 2) {
                mates[teammate].won++;
            } else if (myResult == 1 && teammateResult == 1) {
                mates[teammate].lost++;
            }
        });
    });

    const matesArr = Object.values(mates);

    // Sort by wins
    const best = [...matesArr].sort((a, b) => b.won - a.won).slice(0, 3).filter(p => p.won > 0);
    // Sort by losses
    const worst = [...matesArr].sort((a, b) => b.lost - a.lost).slice(0, 3).filter(p => p.lost > 0);

    return { best, worst };
}

function renderAffinityList(list, colorClass) {
    if (list.length === 0) return '<div class="p-3 text-xs text-slate-400 text-center">Sin datos suficientes</div>';

    return list.map(p => `
        <div class="p-2 flex justify-between items-center text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span>${getEmojiForName(p.name)}</span> ${p.name}
            </span>
            <span class="font-bold ${colorClass}">${p.won || p.lost}</span>
        </div>
    `).join('');
}

function renderTeamStats(matches) {
    const teams = {}; // { "player1,player2...": { name: [], won: 0, lost: 0 } }

    matches.forEach(match => {
        const winners = [];
        const losers = [];

        Object.keys(match.results).sort().forEach(player => {
            if (match.results[player] == 2) winners.push(player);
            if (match.results[player] == 1) losers.push(player);
        });

        if (winners.length > 0) {
            const key = winners.sort().join(',');
            if (!teams[key]) teams[key] = { players: winners, won: 0, lost: 0 };
            teams[key].won++;
        }

        if (losers.length > 0) {
            const key = losers.sort().join(',');
            if (!teams[key]) teams[key] = { players: losers, won: 0, lost: 0 };
            teams[key].lost++;
        }
    });

    const teamArr = Object.values(teams);

    // Best Team: Most Wins, then Best Win Rate
    const best = teamArr.sort((a, b) => {
        if (b.won !== a.won) return b.won - a.won;
        return (b.won / (b.won + b.lost)) - (a.won / (a.won + a.lost));
    })[0];

    // Worst Team: Most Losses
    const worst = teamArr.sort((a, b) => b.lost - a.lost)[0];

    // Rendering Helpers
    const renderCard = (containerId, team, isBest) => {
        const el = document.getElementById(containerId);
        if (!team) {
            el.innerHTML = '<div class="text-slate-400 text-sm">No hay datos suficientes</div>';
            return;
        }

        const playerList = team.players.map(p => `
            <div class="flex flex-col items-center">
                <span class="text-2xl mb-1">${getEmojiForName(p)}</span>
                <span class="text-xs font-medium text-slate-700 dark:text-slate-300 text-center">${p}</span>
            </div>
        `).join('');

        el.innerHTML = `
            <div class="flex flex-wrap justify-center gap-4 mb-4">
                ${playerList}
            </div>
            <div class="text-center">
                <span class="inline-flex items-center rounded-md px-2 py-1 text-sm font-medium ${isBest ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400'}">
                    ${isBest ? team.won + ' Victorias' : team.lost + ' Derrotas'}
                </span>
            </div>
        `;
    };

    renderCard('bestTeamContainer', best, true);
    renderCard('worstTeamContainer', worst, false);
}

function renderMatchHistory() {
    const container = document.getElementById('macthListContainer');
    container.innerHTML = '';

    // Sort allMatches by date DESC
    const sortedMatches = [...allMatches].sort((a, b) => b.date - a.date);

    if (sortedMatches.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-500 py-4">No hay partidos registrados.</p>';
        return;
    }

    sortedMatches.forEach(match => {
        const dateStr = match.date ? match.date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Fecha desconocida';

        // Count winners and losers
        const winners = [];
        const losers = [];
        players.forEach(p => {
            if (match.results[p] == 2) winners.push(p);
            if (match.results[p] == 1) losers.push(p);
        });

        const el = document.createElement('div');
        el.className = 'bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-100 dark:border-slate-600';
        el.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h4 class="font-semibold text-slate-900 dark:text-white capitalize">${dateStr}</h4>
                    <span class="text-xs text-slate-500 dark:text-slate-400">Partido #${match.id} • ${match.count} Jugadores</span>
                </div>
            </div>
            <div class="mt-2 space-y-2">
                <div>
                    <span class="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wide">Ganadores:</span>
                    <p class="text-sm text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                        ${winners.length > 0 ? winners.join(', ') : ' - '}
                    </p>
                </div>
                <div>
                    <span class="text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-wide">Perdedores:</span>
                     <p class="text-sm text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                        ${losers.length > 0 ? losers.join(', ') : ' - '}
                    </p>
                </div>
            </div>
        `;
        container.appendChild(el);
    });
}
