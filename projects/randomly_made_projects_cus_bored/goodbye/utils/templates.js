const Templates = {
    // Dino Stats Card Template
    dinoCard: (data) => `
        <div class="dino-rank">#${data.rank}</div>
        <div class="dino-name${data.rankClass}">${data.dinoName}</div>
        <div class="stats-section-header">Average Stats</div>
        <ul class="dino-stats-list">
            <li class="dino-stat-item">
                <span class="dino-stat-label">Avg Time Played:</span>
                <span class="dino-stat-value highlight-time">${data.avgTimePlayed}</span>
            </li>
            <li class="dino-stat-item">
                <span class="dino-stat-label">Avg Distance:</span>
                <span class="dino-stat-value">${data.avgDistance}</span>
            </li>
            <li class="dino-stat-item">
                <span class="dino-stat-label">Avg Kills:</span>
                <span class="dino-stat-value">${data.avgKills}</span>
            </li>
            <li class="dino-stat-item">
                <span class="dino-stat-label">Avg Deaths:</span>
                <span class="dino-stat-value">${data.avgDeaths}</span>
            </li>
            <li class="dino-stat-item">
                <span class="dino-stat-label">Avg Times Spawned:</span>
                <span class="dino-stat-value">${data.avgTimesSpawned}</span>
            </li>
        </ul>
        <div class="stats-section-header">Total Stats</div>
        <ul class="dino-stats-list">
            <li class="dino-stat-item">
                <span class="dino-stat-label">Total Time Played:</span>
                <span class="dino-stat-value highlight-time">${data.totalTimePlayed}</span>
            </li>
            <li class="dino-stat-item">
                <span class="dino-stat-label">Total Distance:</span>
                <span class="dino-stat-value">${data.totalDistance}</span>
            </li>
            <li class="dino-stat-item">
                <span class="dino-stat-label">Total Kills:</span>
                <span class="dino-stat-value">${data.totalKills}</span>
            </li>
            <li class="dino-stat-item">
                <span class="dino-stat-label">Total Deaths:</span>
                <span class="dino-stat-value">${data.totalDeaths}</span>
            </li>
            <li class="dino-stat-item">
                <span class="dino-stat-label">Total Times Spawned:</span>
                <span class="dino-stat-value">${data.totalTimesSpawned}</span>
            </li>
        </ul>
    `,

    // Player Card - K/D Focus (Top Players)
    playerCardKd: (data) => `
        <div class="player-rank ${data.rankClass}">#${data.rank}</div>
        <div class="player-avatar">
            <img src="${data.pfp}" alt="${data.username}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22 font-size=%2230%22%3E${data.firstLetter}%3C/text%3E%3C/svg%3E'">
        </div>
        <div class="player-info">
            <h3 class="player-username">${data.username}</h3>
            <div class="player-stats">
                <div class="player-stat">
                    <span class="stat-label">Kills</span>
                    <span class="stat-value kills">${data.kills}</span>
                </div>
                <div class="player-stat">
                    <span class="stat-label">Deaths</span>
                    <span class="stat-value deaths">${data.deaths}</span>
                </div>
                <div class="player-stat highlight">
                    <span class="stat-label">K/D</span>
                    <span class="stat-value kd">${data.kd}</span>
                </div>
            </div>
        </div>
    `,

    // Player Card - Kills Focus
    playerCardKills: (data) => `
        <div class="player-rank ${data.rankClass}">#${data.rank}</div>
        <div class="player-avatar">
            <img src="${data.pfp}" alt="${data.username}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22 font-size=%2230%22%3E${data.firstLetter}%3C/text%3E%3C/svg%3E'">
        </div>
        <div class="player-info">
            <h3 class="player-username">${data.username}</h3>
            <div class="player-stats">
                <div class="player-stat highlight">
                    <span class="stat-label">Kills</span>
                    <span class="stat-value kills">${data.kills}</span>
                </div>
                <div class="player-stat">
                    <span class="stat-label">Deaths</span>
                    <span class="stat-value deaths">${data.deaths}</span>
                </div>
                <div class="player-stat">
                    <span class="stat-label">K/D</span>
                    <span class="stat-value kd">${data.kd}</span>
                </div>
            </div>
        </div>
    `,

    // Player Card - Deaths Focus
    playerCardDeaths: (data) => `
        <div class="player-rank ${data.rankClass}">#${data.rank}</div>
        <div class="player-avatar">
            <img src="${data.pfp}" alt="${data.username}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22 font-size=%2230%22%3E${data.firstLetter}%3C/text%3E%3C/svg%3E'">
        </div>
        <div class="player-info">
            <h3 class="player-username">${data.username}</h3>
            <div class="player-stats">
                <div class="player-stat">
                    <span class="stat-label">Kills</span>
                    <span class="stat-value kills">${data.kills}</span>
                </div>
                <div class="player-stat highlight">
                    <span class="stat-label">Deaths</span>
                    <span class="stat-value deaths">${data.deaths}</span>
                </div>
                <div class="player-stat">
                    <span class="stat-label">K/D</span>
                    <span class="stat-value kd">${data.kd}</span>
                </div>
            </div>
        </div>
    `,

    // Player Card - Playtime Focus
    playerCardPlaytime: (data) => `
        <div class="player-rank ${data.rankClass}">#${data.rank}</div>
        <div class="player-avatar">
            <img src="${data.pfp}" alt="${data.username}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22 font-size=%2230%22%3E${data.firstLetter}%3C/text%3E%3C/svg%3E'">
        </div>
        <div class="player-info">
            <h3 class="player-username">${data.username}</h3>
            <div class="player-stats">
                <div class="player-stat highlight playtime-stat">
                    <span class="stat-label">Playtime</span>
                    <span class="stat-value playtime">${data.playtime}</span>
                    <span class="stat-subtext">${data.hours} hours</span>
                </div>
            </div>
        </div>
    `,

    // Player Card - XP Focus
    playerCardXP: (data) => `
        <div class="player-rank ${data.rankClass}">#${data.rank}</div>
        <div class="player-avatar">
            <img src="${data.pfp}" alt="${data.username}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22 font-size=%2230%22%3E${data.firstLetter}%3C/text%3E%3C/svg%3E'">
        </div>
        <div class="player-info">
            <h3 class="player-username">${data.username}</h3>
            <div class="player-stats">
                <div class="player-stat">
                    <span class="stat-label">Kills</span>
                    <span class="stat-value kills">${data.kills}</span>
                </div>
                <div class="player-stat">
                    <span class="stat-label">Deaths</span>
                    <span class="stat-value deaths">${data.deaths}</span>
                </div>
                <div class="player-stat highlight">
                    <span class="stat-label">XP</span>
                    <span class="stat-value xp">${data.xp}</span>
                </div>
            </div>
        </div>
    `,

    // Player Card - Balance Focus
    playerCardBalance: (data) => `
        <div class="player-rank ${data.rankClass}">#${data.rank}</div>
        <div class="player-avatar">
            <img src="${data.pfp}" alt="${data.username}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22 font-size=%2230%22%3E${data.firstLetter}%3C/text%3E%3C/svg%3E'">
        </div>
        <div class="player-info">
            <h3 class="player-username">${data.username}</h3>
            <div class="player-stats">
                <div class="player-stat highlight balance-stat">
                    <span class="stat-label">Balance</span>
                    <span class="stat-value balance">${data.balance}</span>
                    <span class="stat-subtext">💰 Coins</span>
                </div>
            </div>
        </div>
    `,

    // Player Card - Distance Focus
    playerCardDistance: (data) => `
        <div class="player-rank ${data.rankClass}">#${data.rank}</div>
        <div class="player-avatar">
            <img src="${data.pfp}" alt="${data.username}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22 font-size=%2230%22%3E${data.firstLetter}%3C/text%3E%3C/svg%3E'">
        </div>
        <div class="player-info">
            <h3 class="player-username">${data.username}</h3>
            <div class="player-stats">
                <div class="player-stat highlight distance-stat">
                    <span class="stat-label">Distance</span>
                    <span class="stat-value distance">${data.distance}</span>
                    <span class="stat-subtext">${data.distanceKm} km</span>
                </div>
            </div>
        </div>
    `,

    // Clan Card - K/D Focus
    clanCardKd: (data) => {
        const fallbackSvg = `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22 font-size=%2230%22%3E${data.fallbackInitial}%3C/text%3E%3C/svg%3E`;
        return `
        <div class="player-rank ${data.rankClass}">#${data.rank}</div>
        <div class="player-avatar">
            <img src="${data.pfpUrl || fallbackSvg}" alt="${data.name}" onerror="this.src='${fallbackSvg}'">
        </div>
        <div class="player-info">
            <h3 class="player-username">${data.name || 'Unknown'}</h3>
            <p class="clan-tag">[${data.tag || 'N/A'}]</p>
            <div class="player-stats">
                <div class="player-stat">
                    <span class="stat-label">Kills</span>
                    <span class="stat-value kills">${data.kills || 0}</span>
                </div>
                <div class="player-stat">
                    <span class="stat-label">Deaths</span>
                    <span class="stat-value deaths">${data.deaths || 0}</span>
                </div>
                <div class="player-stat highlight">
                    <span class="stat-label">K/D</span>
                    <span class="stat-value kd">${data.kdr}</span>
                </div>
                <div class="player-stat">
                    <span class="stat-label">Members</span>
                    <span class="stat-value">${data.members || 0}/${data.maxMembers || 25}</span>
                </div>
            </div>
        </div>
    `;
    },

    // Clan Card - Kills Focus
    clanCardKills: (data) => {
        const fallbackSvg = `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22 font-size=%2230%22%3E${data.fallbackInitial}%3C/text%3E%3C/svg%3E`;
        return `
        <div class="player-rank ${data.rankClass}">#${data.rank}</div>
        <div class="player-avatar">
            <img src="${data.pfpUrl || fallbackSvg}" alt="${data.name}" onerror="this.src='${fallbackSvg}'">
        </div>
        <div class="player-info">
            <h3 class="player-username">${data.name || 'Unknown'}</h3>
            <p class="clan-tag">[${data.tag || 'N/A'}]</p>
            <div class="player-stats">
                <div class="player-stat highlight">
                    <span class="stat-label">Kills</span>
                    <span class="stat-value kills">${data.kills || 0}</span>
                </div>
                <div class="player-stat">
                    <span class="stat-label">Deaths</span>
                    <span class="stat-value deaths">${data.deaths || 0}</span>
                </div>
                <div class="player-stat">
                    <span class="stat-label">K/D</span>
                    <span class="stat-value kd">${data.kdr}</span>
                </div>
            </div>
        </div>
    `;
    },

    // Clan Card - Deaths Focus
    clanCardDeaths: (data) => {
        const fallbackSvg = `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22 font-size=%2230%22%3E${data.fallbackInitial}%3C/text%3E%3C/svg%3E`;
        return `
        <div class="player-rank ${data.rankClass}">#${data.rank}</div>
        <div class="player-avatar">
            <img src="${data.pfpUrl || fallbackSvg}" alt="${data.name}" onerror="this.src='${fallbackSvg}'">
        </div>
        <div class="player-info">
            <h3 class="player-username">${data.name || 'Unknown'}</h3>
            <p class="clan-tag">[${data.tag || 'N/A'}]</p>
            <div class="player-stats">
                <div class="player-stat">
                    <span class="stat-label">Kills</span>
                    <span class="stat-value kills">${data.kills || 0}</span>
                </div>
                <div class="player-stat highlight">
                    <span class="stat-label">Deaths</span>
                    <span class="stat-value deaths">${data.deaths || 0}</span>
                </div>
                <div class="player-stat">
                    <span class="stat-label">K/D</span>
                    <span class="stat-value kd">${data.kdr}</span>
                </div>
            </div>
        </div>
    `;
    },

    // Clan Card - Points Focus
    clanCardPoints: (data) => {
        const fallbackSvg = `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22 font-size=%2230%22%3E${data.fallbackInitial}%3C/text%3E%3C/svg%3E`;
        return `
        <div class="player-rank ${data.rankClass}">#${data.rank}</div>
        <div class="player-avatar">
            <img src="${data.pfpUrl || fallbackSvg}" alt="${data.name}" onerror="this.src='${fallbackSvg}'">
        </div>
        <div class="player-info">
            <h3 class="player-username">${data.name || 'Unknown'}</h3>
            <p class="clan-tag">[${data.tag || 'N/A'}]</p>
            <div class="player-stats">
                <div class="player-stat highlight">
                    <span class="stat-label">Clan Points</span>
                    <span class="stat-value">${data.clanPoints}</span>
                </div>
                <div class="player-stat">
                    <span class="stat-label">Kills</span>
                    <span class="stat-value kills">${data.kills || 0}</span>
                </div>
                <div class="player-stat">
                    <span class="stat-label">Deaths</span>
                    <span class="stat-value deaths">${data.deaths || 0}</span>
                </div>
            </div>
        </div>
    `;
    },

    // Clan Card - Members Focus
    clanCardMembers: (data) => {
        const fallbackSvg = `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22 font-size=%2230%22%3E${data.fallbackInitial}%3C/text%3E%3C/svg%3E`;
        return `
        <div class="player-rank ${data.rankClass}">#${data.rank}</div>
        <div class="player-avatar">
            <img src="${data.pfpUrl || fallbackSvg}" alt="${data.name}" onerror="this.src='${fallbackSvg}'">
        </div>
        <div class="player-info">
            <h3 class="player-username">${data.name || 'Unknown'}</h3>
            <p class="clan-tag">[${data.tag || 'N/A'}]</p>
            <div class="player-stats">
                <div class="player-stat highlight">
                    <span class="stat-label">Members</span>
                    <span class="stat-value">${data.members || 0}/${data.maxMembers || 25}</span>
                </div>
                <div class="player-stat">
                    <span class="stat-label">Kills</span>
                    <span class="stat-value kills">${data.kills || 0}</span>
                </div>
                <div class="player-stat">
                    <span class="stat-label">K/D</span>
                    <span class="stat-value kd">${data.kdr}</span>
                </div>
            </div>
        </div>
    `;
    },

    // Region Item Template
    regionItem: (data) => `
        <div class="region-header">
            <div class="region-name">${data.ip}</div>
            <div class="region-flag">${data.flag}</div>
        </div>
        <div class="region-stats">
            <div class="region-players">${data.players}<span class="region-players-label"> players</span></div>
            <div class="region-percent">${data.percentage}</div>
        </div>
        <div class="region-bar">
            <div class="region-bar-fill" style="width: 0%;"></div>
        </div>
    `
};
