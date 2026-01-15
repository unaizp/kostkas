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
        // First try to fetch from the PHP proxy (Google Sheets)
        let response = await fetch(`get_data.php?t=${new Date().getTime()}`);
        let workbook;

        // Try to parse the proxy response
        if (response.ok) {
            try {
                const arrayBuffer = await response.arrayBuffer();
                workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
            } catch (e) {
                console.warn('Proxy returned success but invalid data (likely HTML login page). Falling back.', e);
                response = null; // Force fallback
            }
        }

        // If the proxy failed or returned invalid data, fall back to local file
        if (!response || !response.ok || !workbook) {
            console.warn('Falling back to local file.');
            response = await fetch(`data/Campeonato Kostkas 2025_2026.xlsx?v=${new Date().getTime()}`);

            if (!response.ok) throw new Error('Failed to load data from both Proxy and Local source');

            const arrayBuffer = await response.arrayBuffer();
            workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
        }

        // Assuming data is in "Partidos" tab or the first tab
        const sheetName = workbook.SheetNames.includes('Partidos') ? 'Partidos' : workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Parse JS object
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        processData(rawData);

        // Update "Last Updated" text
        const updateTextEl = document.getElementById('lastUpdateText');
        if (updateTextEl) {
            let limitDate = new Date();
            // Try to get header date
            const lastModHeader = response ? response.headers.get('Last-Modified') : null;

            if (lastModHeader) {
                limitDate = new Date(lastModHeader);
            } else if (allMatches.length > 0) {
                // Fallback: Use the date of the very last match in the file
                // allMatches is sorted in processData? No, let's find max date.
                // We just processed data. allMatches is populated.
                const maxDate = new Date(Math.max(...allMatches.map(m => m.date.getTime())));
                if (!isNaN(maxDate)) limitDate = maxDate;
            }

            updateTextEl.innerText = `Datos actualizados a ${limitDate.toLocaleDateString('es-ES', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })}`;
        }

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

    // Map players to their original column index to handle empty columns/gaps
    const playerMap = [];
    for (let i = playerStartIndex; i < headers.length; i++) {
        if (headers[i] && typeof headers[i] === 'string' && headers[i].trim() !== '') {
            playerMap.push({ name: headers[i], index: i });
        }
    }

    players = playerMap.map(p => p.name); // Store just names for global usage

    allMatches = rawData.slice(1).map(row => {
        // Skip empty rows
        if (!row[0]) return null;

        const dateVal = row[1];
        let dateObj = null;

        // Handle Excel Date serial numbers or date strings
        if (typeof dateVal === 'number') {
            dateObj = new Date((dateVal - (25567 + 2)) * 86400 * 1000);
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

        // Map results using specific column indices
        playerMap.forEach(p => {
            const cellValue = row[p.index];
            if (cellValue == 1 || cellValue == 2) {
                match.results[p.name] = cellValue;
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
            <td class="px-4 py-2 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                <button onclick="openPlayerModal('${player.name}')" class="flex items-center hover:text-brand-600 dark:hover:text-brand-400 transition-colors text-left">
                    <span class="mr-2 text-lg">${getEmojiForName(player.name)}</span>
                    <span class="underline decoration-slate-300 underline-offset-4 decoration-1">${player.name}</span>
                </button>
            </td>
            <td class="px-4 py-2 text-center">${player.played}</td>
            <td class="px-4 py-2 text-center">${player.won}</td>
            <td class="px-4 py-2 text-center font-bold text-brand-600">${player.points}</td>
            <td class="px-4 py-2 text-center">
                <div class="flex items-center justify-center gap-2">
                    <span class="text-xs font-medium ${player.percentage >= 50 ? 'text-green-600' : 'text-slate-500'}">${player.percentage.toFixed(1)}%</span>
                    <div class="w-16 bg-slate-200 rounded-full h-1.5">
                        <div class="bg-brand-500 h-1.5 rounded-full" style="width: ${player.percentage}%"></div>
                    </div>
                </div>
            </td>
            <td class="px-4 py-2 text-center">
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
        <div class="flex justify-between items-center py-1 border-b border-slate-50 dark:border-slate-700 last:border-0">
            <div class="flex items-center gap-3">
                <span class="text-xs font-bold text-slate-400 w-4">${i + 1}</span>
                <span class="text-sm font-medium text-slate-700 dark:text-slate-300">${p.name}</span>
            </div>
            <span class="text-sm font-bold text-brand-600 dark:text-brand-400">${valueFn(p)}</span>
        </div>
    `).join('');
}

function renderMonthlyMVP(stats) {
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
        <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg text-center">
                <span class="block text-xs text-slate-500 dark:text-slate-400 uppercase">Partidos</span>
                <span class="block text-xl font-bold text-slate-900 dark:text-white">${player.played}</span>
            </div>
            <div class="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg text-center">
                <span class="block text-xs text-slate-500 dark:text-slate-400 uppercase">Victorias</span>
                <span class="block text-xl font-bold text-brand-600 dark:text-brand-400">${player.won}</span>
            </div>
            <div class="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg text-center">
                <span class="block text-xs text-slate-500 dark:text-slate-400 uppercase">Puntos</span>
                <span class="block text-xl font-bold text-slate-900 dark:text-white">${player.points}</span>
            </div>
            <div class="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg text-center">
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

    // Sort by Win Percentage (Desc), then by Wins
    const best = [...matesArr]
        .filter(p => (p.won + p.lost) >= 1) // Ensure they played at least once
        .sort((a, b) => {
            const rateA = a.won / (a.won + a.lost);
            const rateB = b.won / (b.won + b.lost);
            if (rateA !== rateB) return rateB - rateA; // Higher rate first
            return b.won - a.won; // Then most wins
        })
        .slice(0, 3);

    // Sort by Loss Percentage (Desc i.e. highest loss rate), then by Losses
    const worst = [...matesArr]
        .filter(p => (p.won + p.lost) >= 1)
        .sort((a, b) => {
            const rateA = a.lost / (a.won + a.lost);
            const rateB = b.lost / (b.won + b.lost);
            if (rateA !== rateB) return rateB - rateA; // Higher loss rate first
            return b.lost - a.lost;
        })
        .slice(0, 3);

    return { best, worst };
}

function renderAffinityList(list, colorClass) {
    if (list.length === 0) return '<div class="p-3 text-xs text-slate-400 text-center">Sin datos suficientes</div>';

    return list.map(p => {
        const total = p.won + p.lost;
        const percent = total > 0 ? Math.round((p.won / total) * 100) : 0;
        // For worst list, maybe we want to show Loss %? 
        // The user asked "in function of percentage", usually implies Win %. 
        // But for "Worst with", it implies you lose a lot with them.
        // Let's stick to displaying the "Win %" for consistency, but sorted so low win % is in "Worst".
        // Or better: Display the stat that makes them best/worst.
        // Best: "X% Win". Worst: "X% Win" (which will be low).

        return `
        <div class="p-2 flex justify-between items-center text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span>${getEmojiForName(p.name)}</span> ${p.name}
            </span>
            <div class="text-right">
                <span class="font-bold ${colorClass}">${percent}%</span>
                <span class="text-xs text-slate-400 block">${p.won}V - ${p.lost}D</span>
            </div>
        </div>
    `}).join('');
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
            <div class="flex flex-wrap justify-center gap-2 mb-4">
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

// --- Team Generator ---
let selectedGeneratorPlayers = new Set();

function openGeneratorModal() {
    const modal = document.getElementById('generatorModal');
    const list = document.getElementById('generatorPlayerList');

    // Sort all players alphabetically
    const sortedPlayers = [...players].sort();

    selectedGeneratorPlayers.clear();
    // Default: Select all? Or Select none? Let's select none to force manual choice.

    list.innerHTML = sortedPlayers.map(p => `
        <label class="flex items-center space-x-3 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all select-none">
            <input type="checkbox" value="${p}" class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" onchange="toggleGeneratorPlayer('${p}')">
            <span class="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span>${getEmojiForName(p)}</span> ${p}
            </span>
        </label>
    `).join('');

    updateGeneratorCounter();
    resetGenerator();
    modal.classList.remove('hidden');
}

function closeGeneratorModal() {
    document.getElementById('generatorModal').classList.add('hidden');
}

function toggleGeneratorPlayer(name) {
    if (selectedGeneratorPlayers.has(name)) {
        selectedGeneratorPlayers.delete(name);
    } else {
        selectedGeneratorPlayers.add(name);
    }
    updateGeneratorCounter();
}

function selectAllGenerator() {
    document.querySelectorAll('#generatorPlayerList input').forEach(cb => {
        cb.checked = true;
        selectedGeneratorPlayers.add(cb.value);
    });
    updateGeneratorCounter();
}

function clearAllGenerator() {
    document.querySelectorAll('#generatorPlayerList input').forEach(cb => {
        cb.checked = false;
    });
    selectedGeneratorPlayers.clear();
    updateGeneratorCounter();
}

function updateGeneratorCounter() {
    document.getElementById('selectionCounter').innerText = `${selectedGeneratorPlayers.size} seleccionados`;
}

function resetGenerator() {
    document.getElementById('generatorSelection').classList.remove('hidden');
    document.getElementById('generatorResults').classList.add('hidden');
}

function generateBalancedTeams() {
    const selected = Array.from(selectedGeneratorPlayers);
    if (selected.length < 2) {
        alert("Selecciona al menos 2 jugadores.");
        return;
    }

    // 1. Get stats for selected players
    const { stats } = processStatsForDisplay();

    // Create a map for fast lookup
    const statsMap = {};
    stats.forEach(s => statsMap[s.name] = s);

    // 2. Assign Power Score
    // Logic: Win % is king, but experience (total wins) matters slightly.
    const playerScores = selected.map(name => {
        const s = statsMap[name] || { percentage: 0, won: 0, played: 0 };
        return {
            name: name,
            percent: s.percentage,
            won: s.won,
            // Score = % (0-100) + (Wins * 2). Example: 50% + 10 wins*2 = 70. 
            // This allows a 45% player with 50 wins to rival a 60% player with 2 wins (lucky start).
            score: s.percentage + (s.won * 1.5)
        };
    });

    // 3. Sort by Score Descending (Snake Draft prep)
    playerScores.sort((a, b) => b.score - a.score);

    const teamA = [];
    const teamB = [];

    // 4. Snake Draft
    // A, B, B, A, A, B, B, A...
    playerScores.forEach((p, i) => {
        const turn = Math.floor(i / 2); // 0, 0, 1, 1, 2, 2...
        if (turn % 2 === 0) {
            // Even turns (0, 2..): First goes to A, Second to B
            if (i % 2 === 0) teamA.push(p);
            else teamB.push(p);
        } else {
            // Odd turns (1, 3..): First goes to B, Second to A
            if (i % 2 === 0) teamB.push(p);
            else teamA.push(p);
        }
    });

    // 5. Render
    const renderTeamList = (team, containerId, statsId) => {
        const container = document.getElementById(containerId);
        const statsEl = document.getElementById(statsId);

        container.innerHTML = team.map(p => `
            <div class="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded shadow-sm">
                <div class="flex items-center gap-2">
                    <span class="text-lg">${getEmojiForName(p.name)}</span>
                    <span class="font-medium text-slate-700 dark:text-slate-200 text-sm">${p.name}</span>
                </div>
                <div class="text-xs text-slate-400">
                    ${Math.round(p.percent)}% (${p.won}W)
                </div>
            </div>
        `).join('');

        // Calc Avg
        const avgPerc = team.reduce((acc, p) => acc + p.percent, 0) / team.length;
        statsEl.innerText = `${Math.round(avgPerc)}%`;
    };

    renderTeamList(teamA, 'teamAList', 'teamAStats');
    renderTeamList(teamB, 'teamBList', 'teamBStats');

    // Switch Views
    document.getElementById('generatorSelection').classList.add('hidden');
    document.getElementById('generatorResults').classList.remove('hidden');
}

function renderMatchHistory() {
    const container = document.getElementById('matchListContainer');
    if (!container) return;

    container.innerHTML = '';

    const matches = [...allMatches].sort((a, b) => b.date - a.date);

    let lastDateStr = '';

    matches.forEach(match => {
        const matchDateStr = match.date.toLocaleDateString();

        // Group header
        if (matchDateStr !== lastDateStr) {
            lastDateStr = matchDateStr;
            container.innerHTML += `
                <div class="sticky top-0 bg-slate-50 dark:bg-slate-700/80 backdrop-blur-sm z-10 py-2 px-3 rounded-md text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-2 mt-4 border-b border-slate-100 dark:border-slate-600">
                    ${matchDateStr}
                </div>
            `;
        }

        const winners = [];
        const losers = [];
        Object.entries(match.results).forEach(([name, res]) => {
            if (res == 2) winners.push(name);
            else if (res == 1) losers.push(name);
        });

        // Helper for players
        const pList = (arr) => arr.map(n => `<span class="inline-block bg-slate-100 dark:bg-slate-700 px-1 rounded-[3px] text-[10px] text-slate-700 dark:text-slate-300 mr-1 mb-1 leading-tight">${n}</span>`).join('');

        const html = `
            <div class="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-md border border-slate-100 dark:border-slate-700 mb-1.5">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-[10px] font-mono text-slate-400">#${match.id}</span>
                </div>
                <div class="grid grid-cols-2 gap-x-2">
                    <div class="border-r border-slate-100 dark:border-slate-700 pr-1">
                        <span class="text-[10px] font-bold text-green-600 block mb-0.5 uppercase">Ganadores</span>
                        <div class="flex flex-wrap leading-none">${pList(winners)}</div>
                    </div>
                    <div class="pl-1">
                        <span class="text-[10px] font-bold text-red-500 block mb-0.5 uppercase">Perdedores</span>
                        <div class="flex flex-wrap leading-none">${pList(losers)}</div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}
