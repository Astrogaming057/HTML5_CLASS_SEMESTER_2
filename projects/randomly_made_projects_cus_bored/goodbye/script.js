function updateCountdown() {
    const targetDate = new Date('2026-03-24T03:00:00Z');
    const now = new Date();
    const difference = targetDate - now;

    if (difference <= 0) {
        document.getElementById('days').textContent = '00';
        document.getElementById('hours').textContent = '00';
        document.getElementById('minutes').textContent = '00';
        document.getElementById('seconds').textContent = '00';
        return;
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    const animateCountdown = (element, newValue) => {
        if (element.textContent !== newValue) {
            element.style.transform = 'scale(1.2)';
            element.style.transition = 'transform 0.2s ease';
            setTimeout(() => {
                element.textContent = newValue;
                element.style.transform = 'scale(1)';
            }, 100);
        } else {
            element.textContent = newValue;
        }
    };

    animateCountdown(document.getElementById('days'), String(days).padStart(2, '0'));
    animateCountdown(document.getElementById('hours'), String(hours).padStart(2, '0'));
    animateCountdown(document.getElementById('minutes'), String(minutes).padStart(2, '0'));
    animateCountdown(document.getElementById('seconds'), String(seconds).padStart(2, '0'));
}

setInterval(updateCountdown, 1000);
updateCountdown();

const dinoStatsRaw = [
    {
        "_id": "Omniraptor",
        "avg_kills": 0.4049079754601227,
        "avg_deaths": 0.9386503067484663,
        "avg_timeplayed": 8495742.846625768,
        "avg_distance": 12997.86297148073,
        "avg_times_spawned": 3.6748466257668713,
        "total_kills": 330,
        "total_deaths": 765,
        "total_timeplayed": 6924030420,
        "total_distance": 10593258.321756795,
        "total_times_spawned": 2995
    },
    {
        "_id": "Herrerasaurus",
        "avg_kills": 0.2717391304347826,
        "avg_deaths": 0.33695652173913043,
        "avg_timeplayed": 7473811.673913044,
        "avg_distance": 6623.4592124128985,
        "avg_times_spawned": 2.858695652173913,
        "total_kills": 125,
        "total_deaths": 155,
        "total_timeplayed": 3437953370,
        "total_distance": 3046791.237709933,
        "total_times_spawned": 1315
    },
    {
        "_id": "Carnotaurus",
        "avg_kills": 0.4396551724137931,
        "avg_deaths": 0.4482758620689655,
        "avg_timeplayed": 7622522.612068965,
        "avg_distance": 12082.160533805809,
        "avg_times_spawned": 3.1379310344827585,
        "total_kills": 255,
        "total_deaths": 260,
        "total_timeplayed": 4421063115,
        "total_distance": 7007653.1096073695,
        "total_times_spawned": 1820
    },
    {
        "_id": "Dilophosaurus",
        "avg_kills": 0.13636363636363635,
        "avg_deaths": 0.5303030303030303,
        "avg_timeplayed": 6178083.363636363,
        "avg_distance": 10045.025162442278,
        "avg_times_spawned": 2.5454545454545454,
        "total_kills": 45,
        "total_deaths": 175,
        "total_timeplayed": 2038767510,
        "total_distance": 3314858.303605952,
        "total_times_spawned": 840
    },
    {
        "_id": "Allosaurus",
        "avg_kills": 0.29411764705882354,
        "avg_deaths": 0.23529411764705882,
        "avg_timeplayed": 20239114.23529412,
        "avg_distance": 2776.4094098858786,
        "avg_times_spawned": 1.9411764705882353,
        "total_kills": 25,
        "total_deaths": 20,
        "total_timeplayed": 1720324710,
        "total_distance": 235994.79984029967,
        "total_times_spawned": 165
    },
    {
        "_id": "Tyrannosaurus",
        "avg_kills": 0.9354838709677419,
        "avg_deaths": 0.16129032258064516,
        "avg_timeplayed": 42745617.29032258,
        "avg_distance": 10514.191937136535,
        "avg_times_spawned": 4.064516129032258,
        "total_kills": 145,
        "total_deaths": 25,
        "total_timeplayed": 6625570680,
        "total_distance": 1629699.750256163,
        "total_times_spawned": 630
    },
    {
        "_id": "Pachycephalosaurus",
        "avg_kills": 0.10714285714285714,
        "avg_deaths": 0.42857142857142855,
        "avg_timeplayed": 4780356.535714285,
        "avg_distance": 6799.659950305767,
        "avg_times_spawned": 2.2142857142857144,
        "total_kills": 15,
        "total_deaths": 60,
        "total_timeplayed": 669249915,
        "total_distance": 951952.3930428074,
        "total_times_spawned": 310
    },
    {
        "_id": "Beipiaosaurus",
        "avg_kills": 0.2777777777777778,
        "avg_deaths": 0.8703703703703703,
        "avg_timeplayed": 51587946.277777776,
        "avg_distance": 6267.511692446168,
        "avg_times_spawned": 2.8703703703703702,
        "total_kills": 75,
        "total_deaths": 235,
        "total_timeplayed": 13928745495,
        "total_distance": 1692228.1569604655,
        "total_times_spawned": 775
    },
    {
        "_id": "Stegosaurus",
        "avg_kills": 0.7936507936507936,
        "avg_deaths": 0.30158730158730157,
        "avg_timeplayed": 18307164.333333332,
        "avg_distance": 5279.16922037284,
        "avg_times_spawned": 2.492063492063492,
        "total_kills": 250,
        "total_deaths": 95,
        "total_timeplayed": 5766756765,
        "total_distance": 1662938.3044174445,
        "total_times_spawned": 785
    },
    {
        "_id": "Maiasaura",
        "avg_kills": 1.5416666666666667,
        "avg_deaths": 0.5416666666666666,
        "avg_timeplayed": 14911313.291666666,
        "avg_distance": 23475.937462091955,
        "avg_times_spawned": 3.7083333333333335,
        "total_kills": 185,
        "total_deaths": 65,
        "total_timeplayed": 1789357595,
        "total_distance": 2817112.4954510345,
        "total_times_spawned": 445
    },
    {
        "_id": "Deinosuchus",
        "avg_kills": 0.36787564766839376,
        "avg_deaths": 0.19170984455958548,
        "avg_timeplayed": 33219060.94818653,
        "avg_distance": 8828.043544046543,
        "avg_times_spawned": 3.917098445595855,
        "total_kills": 355,
        "total_deaths": 185,
        "total_timeplayed": 32056393815,
        "total_distance": 8519062.020004913,
        "total_times_spawned": 3780
    },
    {
        "_id": "Gallimimus",
        "avg_kills": 0.13043478260869565,
        "avg_deaths": 0.17391304347826086,
        "avg_timeplayed": 5999279.630434782,
        "avg_distance": 8811.919714915948,
        "avg_times_spawned": 2.891304347826087,
        "total_kills": 30,
        "total_deaths": 40,
        "total_timeplayed": 1379834315,
        "total_distance": 2026741.534430668,
        "total_times_spawned": 665
    },
    {
        "_id": "Troodon",
        "avg_kills": 0.09210526315789473,
        "avg_deaths": 0.5789473684210527,
        "avg_timeplayed": 13660704.671052631,
        "avg_distance": 8608.539843689372,
        "avg_times_spawned": 2.3684210526315788,
        "total_kills": 35,
        "total_deaths": 220,
        "total_timeplayed": 5191067775,
        "total_distance": 3271245.140601961,
        "total_times_spawned": 900
    },
    {
        "_id": "Dryosaurus",
        "avg_kills": 0,
        "avg_deaths": 0,
        "avg_timeplayed": 4268998.428571428,
        "avg_distance": 4930.875684443256,
        "avg_times_spawned": 2.142857142857143,
        "total_kills": 0,
        "total_deaths": 0,
        "total_timeplayed": 149414945,
        "total_distance": 172580.64895551397,
        "total_times_spawned": 75
    },
    {
        "_id": "Hypsilophodon",
        "avg_kills": 0,
        "avg_deaths": 0.21212121212121213,
        "avg_timeplayed": 8041408.515151516,
        "avg_distance": 4254.790563788954,
        "avg_times_spawned": 2.212121212121212,
        "total_kills": 0,
        "total_deaths": 35,
        "total_timeplayed": 1326832405,
        "total_distance": 702040.4430251775,
        "total_times_spawned": 365
    },
    {
        "_id": "Ceratosaurus",
        "avg_kills": 0.9418604651162791,
        "avg_deaths": 0.6918604651162791,
        "avg_timeplayed": 12777229.325581396,
        "avg_distance": 15150.844245651162,
        "avg_times_spawned": 4.011627906976744,
        "total_kills": 810,
        "total_deaths": 595,
        "total_timeplayed": 10988417220,
        "total_distance": 13029726.05126,
        "total_times_spawned": 3450
    },
    {
        "_id": "Diabloceratops",
        "avg_kills": 0.5961538461538461,
        "avg_deaths": 0.5192307692307693,
        "avg_timeplayed": 16596057.096153846,
        "avg_distance": 6334.236041998031,
        "avg_times_spawned": 2.6538461538461537,
        "total_kills": 155,
        "total_deaths": 135,
        "total_timeplayed": 4314974845,
        "total_distance": 1646901.3709194883,
        "total_times_spawned": 690
    },
    {
        "_id": "Tenontosaurus",
        "avg_kills": 0.6129032258064516,
        "avg_deaths": 0.41935483870967744,
        "avg_timeplayed": 6418853.161290322,
        "avg_distance": 8405.366866154749,
        "avg_times_spawned": 2.4193548387096775,
        "total_kills": 95,
        "total_deaths": 65,
        "total_timeplayed": 994922240,
        "total_distance": 1302831.8642539862,
        "total_times_spawned": 375
    },
    {
        "_id": "Pteranodon",
        "avg_kills": 0.04807692307692308,
        "avg_deaths": 0.375,
        "avg_timeplayed": 15327848.471153846,
        "avg_distance": 8064.27780292328,
        "avg_times_spawned": 2.894230769230769,
        "total_kills": 25,
        "total_deaths": 195,
        "total_timeplayed": 7970481205,
        "total_distance": 4193424.457520106,
        "total_times_spawned": 1505
    },
    {
        "_id": "Triceratops",
        "avg_kills": 1.0533333333333332,
        "avg_deaths": 0.28,
        "avg_timeplayed": 13717544.84,
        "avg_distance": 10055.23760263689,
        "avg_times_spawned": 5.1866666666666665,
        "total_kills": 395,
        "total_deaths": 105,
        "total_timeplayed": 5144079315,
        "total_distance": 3770714.100988834,
        "total_times_spawned": 1945
    },
    {
        "_id": "Human",
        "avg_kills": 0,
        "avg_deaths": 0,
        "avg_timeplayed": 646741.3243243244,
        "avg_distance": 2860.0990912188295,
        "avg_times_spawned": 0.3783783783783784,
        "total_kills": 0,
        "total_deaths": 0,
        "total_timeplayed": 119647145,
        "total_distance": 529118.3318754834,
        "total_times_spawned": 70
    }
];

const dinoStats = dinoStatsRaw
    .map(dino => ({
        name: dino._id,
        avg_distance: dino.avg_distance,
        avg_kills: dino.avg_kills,
        avg_deaths: dino.avg_deaths,
        avg_timeplayed: dino.avg_timeplayed,
        avg_times_spawned: dino.avg_times_spawned,
        total_kills: dino.total_kills,
        total_deaths: dino.total_deaths,
        total_timeplayed: dino.total_timeplayed,
        total_distance: dino.total_distance,
        total_times_spawned: dino.total_times_spawned
    }))
    .sort((a, b) => b.avg_timeplayed - a.avg_timeplayed);

function formatTimePlayed(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
        return `${hours.toLocaleString()}h ${minutes}m`;
    }
    return `${minutes}m`;
}

function renderDinoStats() {
    const container = document.getElementById('dinoStats');
    dinoStats.forEach((dino, index) => {
        const rank = index + 1;
        const card = document.createElement('div');
        card.className = 'dino-card';
        card.style.animationDelay = `${index * 0.05}s`;
        card.style.opacity = '0';
        card.style.animation = 'fadeInUp 0.6s ease forwards';

        const rankClass = rank <= 3 ? ' top-rank' : '';

        card.innerHTML = Templates.dinoCard({
            rank: rank,
            rankClass: rankClass,
            dinoName: dino.name,
            avgTimePlayed: formatTimePlayed(dino.avg_timeplayed),
            avgDistance: dino.avg_distance.toLocaleString(undefined, { maximumFractionDigits: 2 }),
            avgKills: dino.avg_kills.toFixed(2),
            avgDeaths: dino.avg_deaths.toFixed(2),
            avgTimesSpawned: dino.avg_times_spawned.toFixed(2),
            totalTimePlayed: formatTimePlayed(dino.total_timeplayed),
            totalDistance: dino.total_distance.toLocaleString(undefined, { maximumFractionDigits: 2 }),
            totalKills: dino.total_kills.toLocaleString(),
            totalDeaths: dino.total_deaths.toLocaleString(),
            totalTimesSpawned: dino.total_times_spawned.toLocaleString()
        });
        container.appendChild(card);
    });
}

const playerData={config:{version:"1.0",lastUpdated:"2026-03-23",description:"Jurassic Jungle player statistics and leaderboards"},descriptions:{topPlayers:"Top 10 players ranked by best K/D (Kill/Death) ratio - the most skilled players",mostKillsPlayers:"Top 10 players with the most total kills - the ultimate hunters",mostDeathsPlayers:"Top 10 players with the most deaths - the most persistent players",mostPlaytimePlayers:"Top 10 players with the most playtime (in milliseconds) - the most dedicated players",mostXPPlayers:"Top 10 players with the most experience points gained - the most experienced players",richestPlayers:"Top 10 players with the highest coin balance - the wealthiest survivors",distanceTraveledPlayers:"Top 10 players who traveled the farthest distance (in meters) - the most explored players",clanLeaderboard:"Complete clan leaderboard ranked by clan points - all clans that participated in Jurassic Jungle"},topPlayers:[{kd:16,username:"Carpetninjagaming",id:"76561198068706444",pfp:"https://avatars.steamstatic.com/18cf9e93edbe79213f24fd277a0c8fc05e9ec68f_full.jpg",kills:16,deaths:0},{kd:14,username:"renea",id:"76561198966601680",pfp:"https://avatars.steamstatic.com/8d2ae7dfc6ca32396bd3d79e8efeec9f30721b9e_full.jpg",kills:14,deaths:0},{kd:12,username:"JamesWob",id:"76561198018568191",pfp:"https://avatars.steamstatic.com/3f47c3634c822270cbccf23f4cb4fcf2272e23d1_full.jpg",kills:12,deaths:0},{kd:9,username:"EZxFans-TTV",id:"76561198062400708",pfp:"https://avatars.steamstatic.com/9c0b13b74e1513da2b9193977a23f81931ebb00b_full.jpg",kills:9,deaths:1},{kd:8,username:"ANZAC_Ace",id:"76561198031500363",pfp:"https://avatars.steamstatic.com/7cb23478c4e5a961f576e835855b878ed9003673_full.jpg",kills:16,deaths:2},{kd:7,username:"theGRIM",id:"76561198858392507",pfp:"https://avatars.steamstatic.com/63efb0a03b572543d218a33b1007ecbb4e2fd46d_full.jpg",kills:7,deaths:0},{kd:7,username:"Lagopède",id:"76561198099988021",pfp:"https://avatars.steamstatic.com/8e2c2e47a82ba59a52c9ab1a83ec177e6a7a49da_full.jpg",kills:7,deaths:0},{kd:6,username:"No_Kapanen",id:"76561199191228384",pfp:"https://avatars.steamstatic.com/b9399852ddb9fa3b92371a22d3ab5df068958b27_full.jpg",kills:12,deaths:2},{kd:6,username:"Testy^",id:"76561198359443452",pfp:"https://avatars.steamstatic.com/89b08127d0af52317141b403a8cf891d48b90c62_full.jpg",kills:6,deaths:1},{kd:5.277777777777778,username:"Its Karl",id:"76561199130531865",pfp:"https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",kills:95,deaths:18},{kd:4.5,username:"SinnySinSin",id:"76561199077457672",pfp:"https://avatars.steamstatic.com/3482eca34588bf567c67ebdac0211b6d94b9bd5f_full.jpg",kills:18,deaths:4},{kd:4.333333333333333,username:"OneTrickBambi",id:"76561198052701645",pfp:"https://avatars.steamstatic.com/bca48b2858f00c2a377764846feaecdc786f1e3a_full.jpg",kills:78,deaths:18},{kd:4,username:"Artemis",id:"76561198068302684",pfp:"https://avatars.steamstatic.com/6889e542266ff1eca9c32d7f405a723a0e19f756_full.jpg",kills:8,deaths:2},{kd:4,username:"►_S€CO_◄",id:"76561198097842255",pfp:"https://avatars.steamstatic.com/6e820272092c81312aa954866dd72d65523ef077_full.jpg",kills:4,deaths:0},{kd:4,username:"Star Set",id:"76561198039545364",pfp:"https://avatars.steamstatic.com/3604ac34b47c87e187d151f22aa17e107253ce34_full.jpg",kills:4,deaths:0},{kd:4,username:"Jayuk120",id:"76561198064317073",pfp:"https://avatars.steamstatic.com/f931fd4a0162c8bc7069d7f3d362a35b0a9bc303_full.jpg",kills:4,deaths:1},{kd:4,username:"Leafy709",id:"76561199207589973",pfp:"https://avatars.steamstatic.com/83f5446fb2a6f27d4c45c67dbf9ce2b80235495d_full.jpg",kills:4,deaths:1},{kd:3,username:"Rookie",id:"76561197991390538",pfp:"https://avatars.steamstatic.com/c738d7d1f5f1496e12cb233b88478dd304a6ed9e_full.jpg",kills:3,deaths:0},{kd:3,username:"Jellyveesh",id:"76561198274703199",pfp:"https://avatars.steamstatic.com/8bb2d4ae63a469359881a5f80853ab5de333bc44_full.jpg",kills:3,deaths:0},{kd:3,username:"Tarzan",id:"76561198023992016",pfp:"https://avatars.steamstatic.com/43695f7f06ca9a7e155e6b56058d33f49d0b045c_full.jpg",kills:3,deaths:0},{kd:2.857142857142857,username:"BlargHammer40000",id:"76561198006711999",pfp:"https://avatars.steamstatic.com/fd4eb830996666a1f32280771c3180cb46da0bad_full.jpg",kills:60,deaths:21},{kd:2.347826086956522,username:"FROG_M4N - TTV",id:"76561199216504928",pfp:"https://avatars.steamstatic.com/d75cd95f7976b0bf6483af511d8b57380ecc5f9f_full.jpg",kills:54,deaths:23},{kd:2.3333333333333335,username:"guardianjt",id:"76561198073120039",pfp:"https://avatars.steamstatic.com/3524a889dd3359592420cb95a06a82255092ce77_full.jpg",kills:7,deaths:3},{kd:2.142857142857143,username:"Tuggy",id:"76561197972292916",pfp:"https://avatars.steamstatic.com/c83e0a94062acaeedd63ddf4c5571a5108eb830d_full.jpg",kills:15,deaths:7}],mostKillsPlayers:[{kd:5.277777777777778,username:"Its Karl",id:"76561199130531865",pfp:"https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",kills:95,deaths:18},{kd:4.333333333333333,username:"OneTrickBambi",id:"76561198052701645",pfp:"https://avatars.steamstatic.com/bca48b2858f00c2a377764846feaecdc786f1e3a_full.jpg",kills:78,deaths:18},{kd:2.857142857142857,username:"BlargHammer40000",id:"76561198006711999",pfp:"https://avatars.steamstatic.com/fd4eb830996666a1f32280771c3180cb46da0bad_full.jpg",kills:60,deaths:21},{kd:2.347826086956522,username:"FROG_M4N - TTV",id:"76561199216504928",pfp:"https://avatars.steamstatic.com/d75cd95f7976b0bf6483af511d8b57380ecc5f9f_full.jpg",kills:54,deaths:23},{kd:1.3928571428571428,username:"Shadows_of_Spite",id:"76561199242981283",pfp:"https://avatars.steamstatic.com/fa8234de7bd25687052b8f074bccb48406450c52_full.jpg",kills:39,deaths:28},{kd:1.7,username:"StateofKnight TTV",id:"76561198044094497",pfp:"https://avatars.steamstatic.com/404cb9fa708c22051d886f1cb7d2e9db9368101b_full.jpg",kills:34,deaths:20},{kd:1.6111111111111112,username:"SpeedyFireEagle",id:"76561199062777090",pfp:"https://avatars.steamstatic.com/ef05ceb5c17ff86fd80a0bc309d992edf31e4490_full.jpg",kills:29,deaths:18},{kd:.9655172413793104,username:"TristanRTX TTV",id:"76561199681257140",pfp:"https://avatars.steamstatic.com/a64e32a30325cd5e327de9186fe3242dc2ef1dc7_full.jpg",kills:28,deaths:29},{kd:.7352941176470589,username:"DadSMASHEDmyXXXBOX",id:"76561198029054235",pfp:"https://avatars.steamstatic.com/34883f89cb6c53c3f51e837f51897113540217e0_full.jpg",kills:25,deaths:34},{kd:.2894736842105263,username:"ttv/Astrogaming057",id:"76561198984149581",pfp:"https://avatars.steamstatic.com/07acf0edb9fa2a77676781ac483238a7cb95b0b9_full.jpg",kills:22,deaths:76},{kd:1.1875,username:"NightWolf_317",id:"76561199018564350",pfp:"https://avatars.steamstatic.com/a0036a83021d4770c5a9ed362cc79f36e393c4ad_full.jpg",kills:19,deaths:16},{kd:.24050632911392406,username:"lilbean",id:"76561198416530923",pfp:"https://avatars.steamstatic.com/ffd992dddc058c7b410976ec8163f200df6d04e3_full.jpg",kills:19,deaths:79},{kd:4.5,username:"SinnySinSin",id:"76561199077457672",pfp:"https://avatars.steamstatic.com/3482eca34588bf567c67ebdac0211b6d94b9bd5f_full.jpg",kills:18,deaths:4},{kd:16,username:"Carpetninjagaming",id:"76561198068706444",pfp:"https://avatars.steamstatic.com/18cf9e93edbe79213f24fd277a0c8fc05e9ec68f_full.jpg",kills:16,deaths:0},{kd:8,username:"ANZAC_Ace",id:"76561198031500363",pfp:"https://avatars.steamstatic.com/7cb23478c4e5a961f576e835855b878ed9003673_full.jpg",kills:16,deaths:2},{kd:2.142857142857143,username:"Tuggy",id:"76561197972292916",pfp:"https://avatars.steamstatic.com/c83e0a94062acaeedd63ddf4c5571a5108eb830d_full.jpg",kills:15,deaths:7},{kd:14,username:"renea",id:"76561198966601680",pfp:"https://avatars.steamstatic.com/8d2ae7dfc6ca32396bd3d79e8efeec9f30721b9e_full.jpg",kills:14,deaths:0},{kd:1.5555555555555556,username:"Yerpnderp",id:"76561198445545143",pfp:"https://avatars.steamstatic.com/4005785334bc4e5dca7be15435ab56322ac1c082_full.jpg",kills:14,deaths:9},{kd:12,username:"JamesWob",id:"76561198018568191",pfp:"https://avatars.steamstatic.com/3f47c3634c822270cbccf23f4cb4fcf2272e23d1_full.jpg",kills:12,deaths:0},{kd:6,username:"No_Kapanen",id:"76561199191228384",pfp:"https://avatars.steamstatic.com/b9399852ddb9fa3b92371a22d3ab5df068958b27_full.jpg",kills:12,deaths:2},{kd:2,username:"Miss_Shadow",id:"76561198439488605",pfp:"https://avatars.steamstatic.com/8fe062381559f4f8b2523d3a980f265aefcae313_full.jpg",kills:12,deaths:6},{kd:1.5,username:"emmi",id:"76561199181747055",pfp:"https://avatars.steamstatic.com/90e0de1ee3bce36cded783e2a4f95c45d1969aa8_full.jpg",kills:12,deaths:8},{kd:.631578947368421,username:"GunnerThewolf_.TTV",id:"76561198200830682",pfp:"https://avatars.steamstatic.com/8dc62b81b3175aa2c36357a658683e339b03a75f_full.jpg",kills:12,deaths:19},{kd:2,username:"lapizlulu",id:"76561198414589247",pfp:"https://avatars.steamstatic.com/622bc23b996e2d019f2db895a68dc39711256e14_full.jpg",kills:10,deaths:5}],mostDeathsPlayers:[{kd:.24050632911392406,username:"lilbean",id:"76561198416530923",pfp:"https://avatars.steamstatic.com/ffd992dddc058c7b410976ec8163f200df6d04e3_full.jpg",kills:19,deaths:79},{kd:.2894736842105263,username:"ttv/Astrogaming057",id:"76561198984149581",pfp:"https://avatars.steamstatic.com/07acf0edb9fa2a77676781ac483238a7cb95b0b9_full.jpg",kills:22,deaths:76},{kd:.2631578947368421,username:"ItsBJD",id:"76561198050156829",pfp:"https://avatars.steamstatic.com/2ef9d468f51e8a2cc9a985f3b667fb64f71ed7db_full.jpg",kills:10,deaths:38},{kd:.7352941176470589,username:"DadSMASHEDmyXXXBOX",id:"76561198029054235",pfp:"https://avatars.steamstatic.com/34883f89cb6c53c3f51e837f51897113540217e0_full.jpg",kills:25,deaths:34},{kd:.9655172413793104,username:"TristanRTX TTV",id:"76561199681257140",pfp:"https://avatars.steamstatic.com/a64e32a30325cd5e327de9186fe3242dc2ef1dc7_full.jpg",kills:28,deaths:29},{kd:1.3928571428571428,username:"Shadows_of_Spite",id:"76561199242981283",pfp:"https://avatars.steamstatic.com/fa8234de7bd25687052b8f074bccb48406450c52_full.jpg",kills:39,deaths:28},{kd:2.347826086956522,username:"FROG_M4N - TTV",id:"76561199216504928",pfp:"https://avatars.steamstatic.com/d75cd95f7976b0bf6483af511d8b57380ecc5f9f_full.jpg",kills:54,deaths:23},{kd:.38095238095238093,username:"CaptnDeadpool",id:"76561199568199909",pfp:"https://avatars.steamstatic.com/5843bb20e1901b995135a3b06980786358cb27fd_full.jpg",kills:8,deaths:21},{kd:2.857142857142857,username:"BlargHammer40000",id:"76561198006711999",pfp:"https://avatars.steamstatic.com/fd4eb830996666a1f32280771c3180cb46da0bad_full.jpg",kills:60,deaths:21},{kd:1.7,username:"StateofKnight TTV",id:"76561198044094497",pfp:"https://avatars.steamstatic.com/404cb9fa708c22051d886f1cb7d2e9db9368101b_full.jpg",kills:34,deaths:20},{kd:.631578947368421,username:"GunnerThewolf_.TTV",id:"76561198200830682",pfp:"https://avatars.steamstatic.com/8dc62b81b3175aa2c36357a658683e339b03a75f_full.jpg",kills:12,deaths:19},{kd:1.6111111111111112,username:"SpeedyFireEagle",id:"76561199062777090",pfp:"https://avatars.steamstatic.com/ef05ceb5c17ff86fd80a0bc309d992edf31e4490_full.jpg",kills:29,deaths:18},{kd:4.333333333333333,username:"OneTrickBambi",id:"76561198052701645",pfp:"https://avatars.steamstatic.com/bca48b2858f00c2a377764846feaecdc786f1e3a_full.jpg",kills:78,deaths:18},{kd:5.277777777777778,username:"Its Karl",id:"76561199130531865",pfp:"https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",kills:95,deaths:18},{kd:.058823529411764705,username:"Asuna1539",id:"76561198825262979",pfp:"https://avatars.steamstatic.com/2b2bb921c80afe6e46bb0592cfdc67d353bef387_full.jpg",kills:1,deaths:17},{kd:1.1875,username:"NightWolf_317",id:"76561199018564350",pfp:"https://avatars.steamstatic.com/a0036a83021d4770c5a9ed362cc79f36e393c4ad_full.jpg",kills:19,deaths:16},{kd:.06666666666666667,username:"Crazun_TTV",id:"76561199075273065",pfp:"https://avatars.steamstatic.com/1f3ce4747901f02c8c8f375be387b98175923ad9_full.jpg",kills:1,deaths:15},{kd:.16666666666666666,username:"SlightlySalty",id:"76561199105689599",pfp:"https://avatars.steamstatic.com/d5fca3542a31e69cef9d5005a62485c5bca524a4_full.jpg",kills:2,deaths:12},{kd:.5,username:"Just_Plumb",id:"76561198381223606",pfp:"https://avatars.steamstatic.com/a569c77d29a2bd71de0f35e491302212823c162a_full.jpg",kills:6,deaths:12},{kd:.18181818181818182,username:"k4t3r69",id:"76561199583101555",pfp:"https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",kills:2,deaths:11},{kd:.2727272727272727,username:"MisfitPanic",id:"76561199515999706",pfp:"https://avatars.steamstatic.com/ab1a827e2157192266669d17b1f4eaf112d52b09_full.jpg",kills:3,deaths:11},{kd:.36363636363636365,username:"Ram_Bitious",id:"76561199376149846",pfp:"https://avatars.steamstatic.com/8ad72cecd7df706d94b1636afe1f5f6e7405af6a_full.jpg",kills:4,deaths:11},{kd:.1,username:"Pickledish",id:"76561199041161942",pfp:"https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",kills:1,deaths:10},{kd:.3,username:"Trivvert",id:"76561198125796289",pfp:"https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",kills:3,deaths:10}],mostPlaytimePlayers:[{username:"LadyStark",id:"76561198174814914",pfp:"https://avatars.steamstatic.com/5e960903e3c3c213fc11850c53b3a4eeef9ef8f3_full.jpg",playtime:4751176168},{username:"Shadows_of_Spite",id:"76561199242981283",pfp:"https://avatars.steamstatic.com/fa8234de7bd25687052b8f074bccb48406450c52_full.jpg",playtime:1488403311},{username:"Ram_Bitious",id:"76561199376149846",pfp:"https://avatars.steamstatic.com/8ad72cecd7df706d94b1636afe1f5f6e7405af6a_full.jpg",playtime:1062132919},{username:"ttv/Astrogaming057",id:"76561198984149581",pfp:"https://avatars.steamstatic.com/07acf0edb9fa2a77676781ac483238a7cb95b0b9_full.jpg",playtime:603708049},{username:"TrippMachine",id:"76561198179977445",pfp:"https://avatars.steamstatic.com/2dda6e45381e63183c1351d320102decc2c9128f_full.jpg",playtime:592264689},{username:"TaNkEr",id:"76561198132074963",pfp:"https://avatars.steamstatic.com/809d42ff50d3760ee9568ac145a1292302bab528_full.jpg",playtime:546146815},{username:"Its Karl",id:"76561199130531865",pfp:"https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",playtime:531583139},{username:"ItsBJD",id:"76561198050156829",pfp:"https://avatars.steamstatic.com/2ef9d468f51e8a2cc9a985f3b667fb64f71ed7db_full.jpg",playtime:514367504},{username:"MrsSilentG",id:"76561198386180655",pfp:"https://avatars.steamstatic.com/be797efde40f1f62b98bd49916d7088412fcc3c6_full.jpg",playtime:468775854},{username:"TristanRTX TTV",id:"76561199681257140",pfp:"https://avatars.steamstatic.com/a64e32a30325cd5e327de9186fe3242dc2ef1dc7_full.jpg",playtime:443655804},{username:"OneTrickBambi",id:"76561198052701645",pfp:"https://avatars.steamstatic.com/bca48b2858f00c2a377764846feaecdc786f1e3a_full.jpg",playtime:442798730},{username:"Barçaríc",id:"76561198002702208",pfp:"https://avatars.steamstatic.com/48e5a3b4eb38fdda2dabff82dcfe3d80318b3253_full.jpg",playtime:400276780},{username:"lilbean",id:"76561198416530923",pfp:"https://avatars.steamstatic.com/ffd992dddc058c7b410976ec8163f200df6d04e3_full.jpg",playtime:373661683},{username:"FROG_M4N - TTV",id:"76561199216504928",pfp:"https://avatars.steamstatic.com/d75cd95f7976b0bf6483af511d8b57380ecc5f9f_full.jpg",playtime:331013440},{username:"BlargHammer40000",id:"76561198006711999",pfp:"https://avatars.steamstatic.com/fd4eb830996666a1f32280771c3180cb46da0bad_full.jpg",playtime:307630177},{username:"Tuggy",id:"76561197972292916",pfp:"https://avatars.steamstatic.com/c83e0a94062acaeedd63ddf4c5571a5108eb830d_full.jpg",playtime:302111901},{username:"DadSMASHEDmyXXXBOX",id:"76561198029054235",pfp:"https://avatars.steamstatic.com/34883f89cb6c53c3f51e837f51897113540217e0_full.jpg",playtime:292752810},{username:"MrSilentG",id:"76561198166510519",pfp:"https://avatars.steamstatic.com/7ca2c26657a769cbb0a8e241ffad5612a3dd29b2_full.jpg",playtime:228729016},{username:"StateofKnight TTV",id:"76561198044094497",pfp:"https://avatars.steamstatic.com/404cb9fa708c22051d886f1cb7d2e9db9368101b_full.jpg",playtime:216091361},{username:"SlightlySalty",id:"76561199105689599",pfp:"https://avatars.steamstatic.com/d5fca3542a31e69cef9d5005a62485c5bca524a4_full.jpg",playtime:198819905},{username:"Yan tu",id:"76561199519608013",pfp:"https://avatars.steamstatic.com/ee29d342108db889912b9404e9bed194a7a9d08c_full.jpg",playtime:196599600},{username:"SpeedyFireEagle",id:"76561199062777090",pfp:"https://avatars.steamstatic.com/ef05ceb5c17ff86fd80a0bc309d992edf31e4490_full.jpg",playtime:160433863},{username:"edgeman45",id:"76561199481609897",pfp:"https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",playtime:157480140},{username:"Raven",id:"76561197982408421",pfp:"https://avatars.steamstatic.com/c0756687ca7f8ebd1b15586cdd9bfdfb3982b5e5_full.jpg",playtime:157427671}],mostXPPlayers:[{kd:5.277777777777778,username:"Its Karl",id:"76561199130531865",pfp:"https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",kills:95,deaths:18,xp:3554},{kd:4.333333333333333,username:"OneTrickBambi",id:"76561198052701645",pfp:"https://avatars.steamstatic.com/bca48b2858f00c2a377764846feaecdc786f1e3a_full.jpg",kills:78,deaths:18,xp:2936.3},{kd:2.347826086956522,username:"FROG_M4N - TTV",id:"76561199216504928",pfp:"https://avatars.steamstatic.com/d75cd95f7976b0bf6483af511d8b57380ecc5f9f_full.jpg",kills:54,deaths:23,xp:2216.7999999999997},{kd:2.857142857142857,username:"BlargHammer40000",id:"76561198006711999",pfp:"https://avatars.steamstatic.com/fd4eb830996666a1f32280771c3180cb46da0bad_full.jpg",kills:60,deaths:21,xp:2180.800000000001},{kd:.9655172413793104,username:"TristanRTX TTV",id:"76561199681257140",pfp:"https://avatars.steamstatic.com/a64e32a30325cd5e327de9186fe3242dc2ef1dc7_full.jpg",kills:28,deaths:29,xp:1260.2},{kd:1.7,username:"StateofKnight TTV",id:"76561198044094497",pfp:"https://avatars.steamstatic.com/404cb9fa708c22051d886f1cb7d2e9db9368101b_full.jpg",kills:34,deaths:20,xp:1172.2000000000012},{kd:1.6111111111111112,username:"SpeedyFireEagle",id:"76561199062777090",pfp:"https://avatars.steamstatic.com/ef05ceb5c17ff86fd80a0bc309d992edf31e4490_full.jpg",kills:29,deaths:18,xp:1111.5999999999992},{kd:.7352941176470589,username:"DadSMASHEDmyXXXBOX",id:"76561198029054235",pfp:"https://avatars.steamstatic.com/34883f89cb6c53c3f51e837f51897113540217e0_full.jpg",kills:25,deaths:34,xp:1040.0000000000005},{kd:1.3928571428571428,username:"Shadows_of_Spite",id:"76561199242981283",pfp:"https://avatars.steamstatic.com/fa8234de7bd25687052b8f074bccb48406450c52_full.jpg",kills:39,deaths:28,xp:1039.4999999999995},{kd:.2894736842105263,username:"ttv/Astrogaming057",id:"76561198984149581",pfp:"https://avatars.steamstatic.com/07acf0edb9fa2a77676781ac483238a7cb95b0b9_full.jpg",kills:22,deaths:76,xp:810.2000000000002},{kd:1.1875,username:"NightWolf_317",id:"76561199018564350",pfp:"https://avatars.steamstatic.com/a0036a83021d4770c5a9ed362cc79f36e393c4ad_full.jpg",kills:19,deaths:16,xp:642.3999999999999},{kd:2.142857142857143,username:"Tuggy",id:"76561197972292916",pfp:"https://avatars.steamstatic.com/c83e0a94062acaeedd63ddf4c5571a5108eb830d_full.jpg",kills:15,deaths:7,xp:630.3999999999999},{kd:4.5,username:"SinnySinSin",id:"76561199077457672",pfp:"https://avatars.steamstatic.com/3482eca34588bf567c67ebdac0211b6d94b9bd5f_full.jpg",kills:18,deaths:4,xp:621},{kd:2,username:"Miss_Shadow",id:"76561198439488605",pfp:"https://avatars.steamstatic.com/8fe062381559f4f8b2523d3a980f265aefcae313_full.jpg",kills:12,deaths:6,xp:610.4000000000001},{kd:.631578947368421,username:"GunnerThewolf_.TTV",id:"76561198200830682",pfp:"https://avatars.steamstatic.com/8dc62b81b3175aa2c36357a658683e339b03a75f_full.jpg",kills:12,deaths:19,xp:587.5999999999999},{kd:1.5555555555555556,username:"Yerpnderp",id:"76561198445545143",pfp:"https://avatars.steamstatic.com/4005785334bc4e5dca7be15435ab56322ac1c082_full.jpg",kills:14,deaths:9,xp:577.4000000000001},{kd:.2631578947368421,username:"ItsBJD",id:"76561198050156829",pfp:"https://avatars.steamstatic.com/2ef9d468f51e8a2cc9a985f3b667fb64f71ed7db_full.jpg",kills:10,deaths:38,xp:570.2},{kd:8,username:"ANZAC_Ace",id:"76561198031500363",pfp:"https://avatars.steamstatic.com/7cb23478c4e5a961f576e835855b878ed9003673_full.jpg",kills:16,deaths:2,xp:565.6000000000008},{kd:1.5,username:"emmi",id:"76561199181747055",pfp:"https://avatars.steamstatic.com/90e0de1ee3bce36cded783e2a4f95c45d1969aa8_full.jpg",kills:12,deaths:8,xp:532.1999999999995},{kd:.24050632911392406,username:"lilbean",id:"76561198416530923",pfp:"https://avatars.steamstatic.com/ffd992dddc058c7b410976ec8163f200df6d04e3_full.jpg",kills:19,deaths:79,xp:532},{kd:4,username:"Leafy709",id:"76561199207589973",pfp:"https://avatars.steamstatic.com/83f5446fb2a6f27d4c45c67dbf9ce2b80235495d_full.jpg",kills:4,deaths:1,xp:515.7},{kd:14,username:"renea",id:"76561198966601680",pfp:"https://avatars.steamstatic.com/8d2ae7dfc6ca32396bd3d79e8efeec9f30721b9e_full.jpg",kills:14,deaths:0,xp:505},{kd:9,username:"EZxFans-TTV",id:"76561198062400708",pfp:"https://avatars.steamstatic.com/9c0b13b74e1513da2b9193977a23f81931ebb00b_full.jpg",kills:9,deaths:1,xp:474.2},{kd:16,username:"Carpetninjagaming",id:"76561198068706444",pfp:"https://avatars.steamstatic.com/18cf9e93edbe79213f24fd277a0c8fc05e9ec68f_full.jpg",kills:16,deaths:0,xp:467}],richestPlayers:[{_id:{$oid:"68bd1f8e833b57d7954b4e21"},username:"Its Karl",id:"76561199130531865",pfp:"https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",balance:205933},{_id:{$oid:"68bd1f8f833b57d7954b4e7e"},username:"FROG_M4N - TTV",id:"76561199216504928",pfp:"https://avatars.steamstatic.com/d75cd95f7976b0bf6483af511d8b57380ecc5f9f_full.jpg",balance:46838},{_id:{$oid:"68bd1f8d833b57d7954b4ba8"},username:"OneTrickBambi",id:"76561198052701645",pfp:"https://avatars.steamstatic.com/bca48b2858f00c2a377764846feaecdc786f1e3a_full.jpg",balance:25387},{_id:{$oid:"68bd1f8d833b57d7954b4b03"},username:"Tuggy",id:"76561197972292916",pfp:"https://avatars.steamstatic.com/c83e0a94062acaeedd63ddf4c5571a5108eb830d_full.jpg",balance:18692},{_id:{$oid:"68bd1f8d833b57d7954b4b24"},username:"Barçaríc",id:"76561198002702208",pfp:"https://avatars.steamstatic.com/48e5a3b4eb38fdda2dabff82dcfe3d80318b3253_full.jpg",balance:12938},{_id:{$oid:"68bd1f8e833b57d7954b4c2c"},username:"1hp",id:"76561198142812901",pfp:"https://avatars.steamstatic.com/e6fd518f874dd79985ac50344f9ec2e461fda5eb_full.jpg",balance:12371},{_id:{$oid:"68bd1f8d833b57d7954b4b57"},username:"Gevian",id:"76561198016575104",pfp:"https://avatars.steamstatic.com/1819a9fdfe4de3677fa58cec444b92992b8aaa7c_full.jpg",balance:11707},{_id:{$oid:"68bdc1d9fe7ec59b1c4c5e81"},username:"JamanGrr",id:"76561197980024701",pfp:"https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",balance:11670},{_id:{$oid:"68bd1f8d833b57d7954b4b2d"},username:"BlargHammer40000",id:"76561198006711999",pfp:"https://avatars.steamstatic.com/fd4eb830996666a1f32280771c3180cb46da0bad_full.jpg",balance:10812},{_id:{$oid:"68bd1f8e833b57d7954b4e54"},username:"Hasty_HenTTV",id:"76561199176131585",pfp:"https://avatars.steamstatic.com/914e569d80b6357f7b750d326255823b89c8d32f_full.jpg",balance:10804},{_id:{$oid:"68bd1f8e833b57d7954b4cdd"},username:"MrsSilentG",id:"76561198386180655",pfp:"https://avatars.steamstatic.com/be797efde40f1f62b98bd49916d7088412fcc3c6_full.jpg",balance:10796},{_id:{$oid:"68bd1f8e833b57d7954b4e2d"},username:"TheRamenFoxx",id:"76561199144375058",pfp:"https://avatars.steamstatic.com/d4371bdba4c8c3484bc5b88edc6ee3c15d2bc250_full.jpg",balance:7884},{_id:{$oid:"68bd1f8d833b57d7954b4b0c"},username:"Raven",id:"76561197982408421",pfp:"https://avatars.steamstatic.com/c0756687ca7f8ebd1b15586cdd9bfdfb3982b5e5_full.jpg",balance:7686},{_id:{$oid:"68c37d6a66ffd7fea34a352c"},username:"Ram_Bitious",id:"76561199376149846",pfp:"https://avatars.steamstatic.com/8ad72cecd7df706d94b1636afe1f5f6e7405af6a_full.jpg",balance:7221},{_id:{$oid:"68bd1f8e833b57d7954b4d04"},username:"Miss_Shadow",id:"76561198439488605",pfp:"https://avatars.steamstatic.com/8fe062381559f4f8b2523d3a980f265aefcae313_full.jpg",balance:7062},{_id:{$oid:"68bd1f8e833b57d7954b4e36"},username:"SakePlayS",id:"76561199149388126",pfp:"https://avatars.steamstatic.com/4f4098db75bd7fec494464f41e3868aaf485032b_full.jpg",balance:6747},{_id:{$oid:"68bd1f8e833b57d7954b4bc9"},username:"Jayuk120",id:"76561198064317073",pfp:"https://avatars.steamstatic.com/f931fd4a0162c8bc7069d7f3d362a35b0a9bc303_full.jpg",balance:5398},{_id:{$oid:"68bd1f8d833b57d7954b4b0f"},username:"Wreckona TTV",id:"76561197983423462",pfp:"https://avatars.steamstatic.com/dbe5d4b6072b534428923b1d87c34acb2eca2934_full.jpg",balance:5060},{_id:{$oid:"68bd1f8e833b57d7954b4bde"},username:"guardianjt",id:"76561198073120039",pfp:"https://avatars.steamstatic.com/3524a889dd3359592420cb95a06a82255092ce77_full.jpg",balance:4683},{_id:{$oid:"68bd1f8e833b57d7954b4daf"},username:"NightWolf_317",id:"76561199018564350",pfp:"https://avatars.steamstatic.com/a0036a83021d4770c5a9ed362cc79f36e393c4ad_full.jpg",balance:4550},{_id:{$oid:"68bd1f8d833b57d7954b4b93"},username:"Superwormie",id:"76561198043764835",pfp:"https://avatars.steamstatic.com/a8c5d92192f114f5ed05a03a86e53facc7d22a27_full.jpg",balance:4478},{_id:{$oid:"68bd1f8e833b57d7954b4e12"},username:"schmiddi",id:"76561199114876191",pfp:"https://avatars.steamstatic.com/b93f04b9194fba8980a2dc74947d47d0087ba113_full.jpg",balance:3838},{_id:{$oid:"68bd1f8f833b57d7954b4f44"},username:"TristanRTX TTV",id:"76561199681257140",pfp:"https://avatars.steamstatic.com/a64e32a30325cd5e327de9186fe3242dc2ef1dc7_full.jpg",balance:3781},{_id:{$oid:"68c4f34866ffd7fea34a3537"},username:"theGRIM",id:"76561198858392507",pfp:"https://avatars.steamstatic.com/63efb0a03b572543d218a33b1007ecbb4e2fd46d_full.jpg",balance:3657}],distanceTraveledPlayers:[{distance_traveled:677317.6050841707,username:"Shadows_of_Spite",id:{$oid:"68bd1f8f833b57d7954b4ea2"},pfp:"https://avatars.steamstatic.com/fa8234de7bd25687052b8f074bccb48406450c52_full.jpg"},{distance_traveled:557705.9429665315,username:"BlargHammer40000",id:{$oid:"68bd1f8d833b57d7954b4b2d"},pfp:"https://avatars.steamstatic.com/fd4eb830996666a1f32280771c3180cb46da0bad_full.jpg"},{distance_traveled:529447.0842900963,username:"TristanRTX TTV",id:{$oid:"68bd1f8f833b57d7954b4f44"},pfp:"https://avatars.steamstatic.com/a64e32a30325cd5e327de9186fe3242dc2ef1dc7_full.jpg"},{distance_traveled:507413.1066428087,username:"Barçaríc",id:{$oid:"68bd1f8d833b57d7954b4b24"},pfp:"https://avatars.steamstatic.com/48e5a3b4eb38fdda2dabff82dcfe3d80318b3253_full.jpg"},{distance_traveled:490783.29008386313,username:"ttv/Astrogaming057",id:{$oid:"68bd1f8e833b57d7954b4d79"},pfp:"https://avatars.steamstatic.com/07acf0edb9fa2a77676781ac483238a7cb95b0b9_full.jpg"},{distance_traveled:471669.37864221365,username:"ItsBJD",id:{$oid:"68bd1f8d833b57d7954b4ba5"},pfp:"https://avatars.steamstatic.com/2ef9d468f51e8a2cc9a985f3b667fb64f71ed7db_full.jpg"},{distance_traveled:466707.78031683975,username:"DadSMASHEDmyXXXBOX",id:{$oid:"68bd1f8d833b57d7954b4b63"},pfp:"https://avatars.steamstatic.com/34883f89cb6c53c3f51e837f51897113540217e0_full.jpg"},{distance_traveled:450304.99983428285,username:"FROG_M4N - TTV",id:{$oid:"68bd1f8f833b57d7954b4e7e"},pfp:"https://avatars.steamstatic.com/d75cd95f7976b0bf6483af511d8b57380ecc5f9f_full.jpg"},{distance_traveled:406212.21902597905,username:"Its Karl",id:{$oid:"68bd1f8e833b57d7954b4e21"},pfp:"https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg"},{distance_traveled:346411.76351862744,username:"lilbean",id:{$oid:"68bd1f8e833b57d7954b4cf2"},pfp:"https://avatars.steamstatic.com/ffd992dddc058c7b410976ec8163f200df6d04e3_full.jpg"},{distance_traveled:253838.36014248323,username:"MrsSilentG",id:{$oid:"68bd1f8e833b57d7954b4cdd"},pfp:"https://avatars.steamstatic.com/be797efde40f1f62b98bd49916d7088412fcc3c6_full.jpg"},{distance_traveled:214741.95559266827,username:"Ram_Bitious",id:{$oid:"68c37d6a66ffd7fea34a352c"},pfp:"https://avatars.steamstatic.com/8ad72cecd7df706d94b1636afe1f5f6e7405af6a_full.jpg"},{distance_traveled:212905.80393935472,username:"SpeedyFireEagle",id:{$oid:"68bd1f8e833b57d7954b4dd9"},pfp:"https://avatars.steamstatic.com/ef05ceb5c17ff86fd80a0bc309d992edf31e4490_full.jpg"},{distance_traveled:210320.56426279945,username:"OneTrickBambi",id:{$oid:"68bd1f8d833b57d7954b4ba8"},pfp:"https://avatars.steamstatic.com/bca48b2858f00c2a377764846feaecdc786f1e3a_full.jpg"},{distance_traveled:195567.57797159423,username:"LadyStark",id:{$oid:"69156fce7aeaf316aeea7cbd"},pfp:"https://avatars.steamstatic.com/5e960903e3c3c213fc11850c53b3a4eeef9ef8f3_full.jpg"},{distance_traveled:193298.1670295455,username:"GunnerThewolf_.TTV",id:{$oid:"68d741bb3c38f91a1d05d241"},pfp:"https://avatars.steamstatic.com/8dc62b81b3175aa2c36357a658683e339b03a75f_full.jpg"},{distance_traveled:186085.080846868,username:"Tuggy",id:{$oid:"68bd1f8d833b57d7954b4b03"},pfp:"https://avatars.steamstatic.com/c83e0a94062acaeedd63ddf4c5571a5108eb830d_full.jpg"},{distance_traveled:181707.40210579635,username:"StateofKnight TTV",id:{$oid:"68bd1f8d833b57d7954b4b99"},pfp:"https://avatars.steamstatic.com/404cb9fa708c22051d886f1cb7d2e9db9368101b_full.jpg"},{distance_traveled:181518.48541168685,username:"NightWolf_317",id:{$oid:"68bd1f8e833b57d7954b4daf"},pfp:"https://avatars.steamstatic.com/a0036a83021d4770c5a9ed362cc79f36e393c4ad_full.jpg"},{distance_traveled:168795.36066427108,username:"SlightlySalty",id:{$oid:"68bd1f8e833b57d7954b4e0c"},pfp:"https://avatars.steamstatic.com/d5fca3542a31e69cef9d5005a62485c5bca524a4_full.jpg"},{distance_traveled:164230.45236746184,username:"MisfitPanic",id:{$oid:"68c6dc45aaf2ef64da748cc5"},pfp:"https://avatars.steamstatic.com/ab1a827e2157192266669d17b1f4eaf112d52b09_full.jpg"},{distance_traveled:161374.54638682547,username:"Miss_Shadow",id:{$oid:"68bd1f8e833b57d7954b4d04"},pfp:"https://avatars.steamstatic.com/8fe062381559f4f8b2523d3a980f265aefcae313_full.jpg"},{distance_traveled:143032.2008194113,username:"SakePlayS",id:{$oid:"68bd1f8e833b57d7954b4e36"},pfp:"https://avatars.steamstatic.com/4f4098db75bd7fec494464f41e3868aaf485032b_full.jpg"},{distance_traveled:140286.78942464024,username:"MrSilentG",id:{$oid:"68bd1f8e833b57d7954b4c3b"},pfp:"https://avatars.steamstatic.com/7ca2c26657a769cbb0a8e241ffad5612a3dd29b2_full.jpg"}],clanLeaderboard:[{rank:1,id:"tzq3ivct9io4jjqcdvffhouls2oat",name:"Gang Gang",tag:"|GG|",level:1,kills:144,deaths:63,kdr:2.29,rankName:"|GG|",clanPoints:4831.19999999999,members:17,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=tzq3ivct9io4jjqcdvffhouls2oat&i_type=pfp",banner:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=tzq3ivct9io4jjqcdvffhouls2oat&i_type=banner",patron_status:{is_patreon_member:!0,patreon_id:null,tier:3,tier_name:"Adult Apex",monthly_contribution:20,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:5,xp_boost:.3,coin_boost:.3,sell_commission:.08,voucher_expire_boost:.3,cooldowns:{after_storing:.85,after_redeeming:2,after_claiming:1.75,after_market_purchase:.75},skin_creator:!0,unlock_locked_dinos:"most",queue_skip:!0,early_access:!1,premium_discord_role:!1,discord_supporter_role:!0,supporter_channels:!0,priority_event_invites:!0}}},{rank:2,id:"mhaggnb64m4df46ljgladkzs0l9cdc",name:"Nie Wiem",tag:"NiWi",level:1,kills:182,deaths:46,kdr:3.96,rankName:"NiWi",clanPoints:3541,members:3,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=mhaggnb64m4df46ljgladkzs0l9cdc&i_type=pfp",banner:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=mhaggnb64m4df46ljgladkzs0l9cdc&i_type=banner",patron_status:{is_patreon_member:!0,patreon_id:null,tier:3,tier_name:"Adult Apex",monthly_contribution:20,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:5,xp_boost:.3,coin_boost:.3,sell_commission:.08,voucher_expire_boost:.3,cooldowns:{after_storing:.85,after_redeeming:2,after_claiming:1.75,after_market_purchase:.75},skin_creator:!0,unlock_locked_dinos:"most",queue_skip:!0,early_access:!1,premium_discord_role:!1,discord_supporter_role:!0,supporter_channels:!0,priority_event_invites:!0}}},{rank:3,id:"g0sv05lwq0gml56lw7pol72kpt5fkg",name:"GalliGang",tag:"HONK",level:1,kills:101,deaths:116,kdr:.87,rankName:"HONK",clanPoints:2706.4,members:8,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=g0sv05lwq0gml56lw7pol72kpt5fkg&i_type=pfp",banner:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=g0sv05lwq0gml56lw7pol72kpt5fkg&i_type=banner",patron_status:{is_patreon_member:!0,patreon_id:null,tier:4,tier_name:"Elder Apex",monthly_contribution:30,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:6,xp_boost:.4,coin_boost:.4,sell_commission:.06,voucher_expire_boost:.5,cooldowns:{after_storing:.7,after_redeeming:1.5,after_claiming:1.25,after_market_purchase:.5},skin_creator:!0,unlock_locked_dinos:"apex",queue_skip:!0,early_access:!0,premium_discord_role:!0,discord_supporter_role:!0,supporter_channels:!0,priority_event_invites:!0}}},{rank:4,id:"6gmvgn68q23fhwij7zg69lepkysysv",name:"Beanie Babies",tag:"bean",level:1,kills:48,deaths:112,kdr:.43,rankName:"bean",clanPoints:1125.3,members:4,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=6gmvgn68q23fhwij7zg69lepkysysv&i_type=pfp",banner:null,patron_status:{is_patreon_member:!0,patreon_id:null,tier:3,tier_name:"Adult Apex",monthly_contribution:20,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:5,xp_boost:.3,coin_boost:.3,sell_commission:.08,voucher_expire_boost:.3,cooldowns:{after_storing:.85,after_redeeming:2,after_claiming:1.75,after_market_purchase:.75},skin_creator:!0,unlock_locked_dinos:"most",queue_skip:!0,early_access:!1,premium_discord_role:!1,discord_supporter_role:!0,supporter_channels:!0,priority_event_invites:!0}}},{rank:5,id:"tucxxcv31xo83wafk4fjgs6icypbbq",name:"LIZARDS",tag:"LZRD",level:1,kills:41,deaths:24,kdr:1.71,rankName:"LZRD",clanPoints:1063.8,members:2,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=tucxxcv31xo83wafk4fjgs6icypbbq&i_type=pfp",banner:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=tucxxcv31xo83wafk4fjgs6icypbbq&i_type=banner",patron_status:{is_patreon_member:!0,patreon_id:null,tier:3,tier_name:"Adult Apex",monthly_contribution:20,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:5,xp_boost:.3,coin_boost:.3,sell_commission:.08,voucher_expire_boost:.3,cooldowns:{after_storing:.85,after_redeeming:2,after_claiming:1.75,after_market_purchase:.75},skin_creator:!0,unlock_locked_dinos:"most",queue_skip:!0,early_access:!1,premium_discord_role:!1,discord_supporter_role:!0,supporter_channels:!0,priority_event_invites:!0}}},{rank:6,id:"p9265mbku687jec3kppo8trbf4lcdv",name:"Dino family",tag:"fam",level:1,kills:22,deaths:40,kdr:.55,rankName:"fam",clanPoints:459.799999999999,members:8,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=p9265mbku687jec3kppo8trbf4lcdv&i_type=pfp",banner:null,patron_status:null},{rank:7,id:"r2dy0kqrjl2ir9o0wnauiqnk0zvtpr",name:"Reptile Roost",tag:"RR",level:1,kills:8,deaths:8,kdr:1,rankName:"RR",clanPoints:360.4,members:6,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=r2dy0kqrjl2ir9o0wnauiqnk0zvtpr&i_type=pfp",banner:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=r2dy0kqrjl2ir9o0wnauiqnk0zvtpr&i_type=banner",patron_status:{is_patreon_member:!0,patreon_id:null,tier:4,tier_name:"Elder Apex",monthly_contribution:30,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:6,xp_boost:.4,coin_boost:.4,sell_commission:.06,voucher_expire_boost:.5,cooldowns:{after_storing:.7,after_redeeming:1.5,after_claiming:1.25,after_market_purchase:.5},skin_creator:!0,unlock_locked_dinos:"apex",queue_skip:!0,early_access:!0,premium_discord_role:!0,discord_supporter_role:!0,supporter_channels:!0,priority_event_invites:!0}}},{rank:8,id:"5m127n7ypejb0lqs6ui3v0nljb0nfq",name:"Walmart Supercenter",tag:"Wal",level:1,kills:13,deaths:14,kdr:.93,rankName:"Wal",clanPoints:277.1,members:5,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=5m127n7ypejb0lqs6ui3v0nljb0nfq&i_type=pfp",banner:null,patron_status:{is_patreon_member:!1,patreon_id:null,tier:0,tier_name:"Hatchling",monthly_contribution:0,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:2,xp_boost:0,coin_boost:0,sell_commission:.12,voucher_expire_boost:0,cooldowns:{after_storing:1.5,after_redeeming:3.5,after_claiming:3.5,after_market_purchase:3},skin_creator:!1,unlock_locked_dinos:"none",queue_skip:!1,early_access:!1,premium_discord_role:!1,discord_supporter_role:!1,supporter_channels:!1,priority_event_invites:!1}}},{rank:9,id:"sonwm548ly9b0f5tfhohk7geqx70ec",name:"The Silent Gs",tag:"TSGs",level:1,kills:11,deaths:12,kdr:.92,rankName:"TSGs",clanPoints:275.6,members:2,maxMembers:25,pfp:null,banner:null,patron_status:{is_patreon_member:!1,patreon_id:null,tier:0,tier_name:"Hatchling",monthly_contribution:0,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:2,xp_boost:0,coin_boost:0,sell_commission:.12,voucher_expire_boost:0,cooldowns:{after_storing:1.5,after_redeeming:3.5,after_claiming:3.5,after_market_purchase:3},skin_creator:!1,unlock_locked_dinos:"none",queue_skip:!1,early_access:!1,premium_discord_role:!1,discord_supporter_role:!1,supporter_channels:!1,priority_event_invites:!1}}},{rank:10,id:"tfkiphkxfj0sg8puj9uroujj98t1z5",name:"Golden Apple Corps",tag:"ERIS",level:1,kills:10,deaths:38,kdr:.26,rankName:"ERIS",clanPoints:234.8,members:1,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=tfkiphkxfj0sg8puj9uroujj98t1z5&i_type=pfp",banner:null,patron_status:{is_patreon_member:!0,patreon_id:null,tier:3,tier_name:"Adult Apex",monthly_contribution:20,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:5,xp_boost:.3,coin_boost:.3,sell_commission:.08,voucher_expire_boost:.3,cooldowns:{after_storing:.85,after_redeeming:2,after_claiming:1.75,after_market_purchase:.75},skin_creator:!0,unlock_locked_dinos:"most",queue_skip:!0,early_access:!1,premium_discord_role:!1,discord_supporter_role:!0,supporter_channels:!0,priority_event_invites:!0}}},{rank:11,id:"ja58gm50e6p6yall8xw1gx910eangl",name:"Troocon's",tag:"Tros",level:1,kills:11,deaths:14,kdr:.79,rankName:"Tros",clanPoints:200.5,members:5,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=ja58gm50e6p6yall8xw1gx910eangl&i_type=pfp",banner:null,patron_status:{is_patreon_member:!1,patreon_id:null,tier:0,tier_name:"Hatchling",monthly_contribution:0,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:2,xp_boost:0,coin_boost:0,sell_commission:.12,voucher_expire_boost:0,cooldowns:{after_storing:1.5,after_redeeming:3.5,after_claiming:3.5,after_market_purchase:3},skin_creator:!1,unlock_locked_dinos:"none",queue_skip:!1,early_access:!1,premium_discord_role:!1,discord_supporter_role:!1,supporter_channels:!1,priority_event_invites:!1}}},{rank:12,id:"ry18l3ioug4554szl1981luwjb2blu",name:"Crimson Knights",tag:"CK",level:1,kills:7,deaths:0,kdr:7,rankName:"CK",clanPoints:183.2,members:5,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=ry18l3ioug4554szl1981luwjb2blu&i_type=pfp",banner:null,patron_status:null},{rank:13,id:"jo4a0k9vkdjq3fshpkby5lm84v92of",name:"The Originals",tag:"OG",level:1,kills:3,deaths:9,kdr:.33,rankName:"OG",clanPoints:125.4,members:4,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=jo4a0k9vkdjq3fshpkby5lm84v92of&i_type=pfp",banner:null,patron_status:{is_patreon_member:!0,patreon_id:null,tier:4,tier_name:"Elder Apex",monthly_contribution:30,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:6,xp_boost:.4,coin_boost:.4,sell_commission:.06,voucher_expire_boost:.5,cooldowns:{after_storing:.7,after_redeeming:1.5,after_claiming:1.25,after_market_purchase:.5},skin_creator:!0,unlock_locked_dinos:"apex",queue_skip:!0,early_access:!0,premium_discord_role:!0,discord_supporter_role:!0,supporter_channels:!0,priority_event_invites:!0}}},{rank:14,id:"tegj6ljezlri8mb1wbbz1jeasm3cik",name:"Primal Fury",tag:"FURY",level:1,kills:2,deaths:3,kdr:.67,rankName:"FURY",clanPoints:74,members:3,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=tegj6ljezlri8mb1wbbz1jeasm3cik&i_type=pfp",banner:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=tegj6ljezlri8mb1wbbz1jeasm3cik&i_type=banner",patron_status:{is_patreon_member:!0,patreon_id:null,tier:4,tier_name:"Elder Apex",monthly_contribution:30,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:6,xp_boost:.4,coin_boost:.4,sell_commission:.06,voucher_expire_boost:.5,cooldowns:{after_storing:.7,after_redeeming:1.5,after_claiming:1.25,after_market_purchase:.5},skin_creator:!0,unlock_locked_dinos:"apex",queue_skip:!0,early_access:!0,premium_discord_role:!0,discord_supporter_role:!0,supporter_channels:!0,priority_event_invites:!0}}},{rank:15,id:"b61l1eepy2dodc71v0tcfg4c5en3fz",name:"Primitive War",tag:"WAR",level:1,kills:4,deaths:11,kdr:.36,rankName:"WAR",clanPoints:64.4,members:1,maxMembers:25,pfp:null,banner:null,patron_status:null},{rank:16,id:"acr3300jane9c7vdnvncmdec0hxmcd",name:"Lihaperunasoselaatikko",tag:"FIN",level:1,kills:4,deaths:8,kdr:.5,rankName:"FIN",clanPoints:50.4,members:3,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=acr3300jane9c7vdnvncmdec0hxmcd&i_type=pfp",banner:null,patron_status:null},{rank:17,id:"9eoefthk03ukzo1m5lxysa68k26k8j",name:"Wob's Tree Rats",tag:"WTR",level:1,kills:12,deaths:0,kdr:12,rankName:"WTR",clanPoints:48.2,members:1,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=9eoefthk03ukzo1m5lxysa68k26k8j&i_type=pfp",banner:null,patron_status:{is_patreon_member:!1,patreon_id:null,tier:0,tier_name:"Hatchling",monthly_contribution:0,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:2,xp_boost:0,coin_boost:0,sell_commission:.12,voucher_expire_boost:0,cooldowns:{after_storing:1.5,after_redeeming:3.5,after_claiming:3.5,after_market_purchase:3},skin_creator:!1,unlock_locked_dinos:"none",queue_skip:!1,early_access:!1,premium_discord_role:!1,discord_supporter_role:!1,supporter_channels:!1,priority_event_invites:!1}}},{rank:18,id:"92ftxlmxjzilz369jkzthz2lsh19wx",name:"Birthing Affiliates & Nesting Group",tag:"BANG",level:1,kills:3,deaths:2,kdr:1.5,rankName:"BANG",clanPoints:45,members:1,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=92ftxlmxjzilz369jkzthz2lsh19wx&i_type=pfp",banner:null,patron_status:{is_patreon_member:!1,patreon_id:null,tier:0,tier_name:"Hatchling",monthly_contribution:0,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:2,xp_boost:0,coin_boost:0,sell_commission:.12,voucher_expire_boost:0,cooldowns:{after_storing:1.5,after_redeeming:3.5,after_claiming:3.5,after_market_purchase:3},skin_creator:!1,unlock_locked_dinos:"none",queue_skip:!1,early_access:!1,premium_discord_role:!1,discord_supporter_role:!1,supporter_channels:!1,priority_event_invites:!1}}},{rank:19,id:"fi5fc92iux",name:"Feral Dominion",tag:"FERL",level:1,kills:0,deaths:0,kdr:0,rankName:"FERL",clanPoints:44.2,members:2,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=fi5fc92iux&i_type=pfp",banner:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=fi5fc92iux&i_type=banner",patron_status:{is_patreon_member:!1,patreon_id:null,tier:null,tier_name:null,monthly_contribution:null,currency:null,supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{}}},{rank:20,id:"x5izwr5gsalofvtqn3yi2oc4w96nvo",name:"Dino",tag:"9000",level:1,kills:40,deaths:32,kdr:1.25,rankName:"9000",clanPoints:7,members:5,maxMembers:25,pfp:null,banner:null,patron_status:null},{rank:21,id:"k6v7zwwab4v27jbnphupebdrlb0vme",name:"DINO NUGGETS",tag:"NUGS",level:1,kills:0,deaths:2,kdr:0,rankName:"NUGS",clanPoints:5,members:2,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=k6v7zwwab4v27jbnphupebdrlb0vme&i_type=pfp",banner:null,patron_status:{is_patreon_member:!1,patreon_id:null,tier:0,tier_name:"Hatchling",monthly_contribution:0,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:2,xp_boost:0,coin_boost:0,sell_commission:.12,voucher_expire_boost:0,cooldowns:{after_storing:1.5,after_redeeming:3.5,after_claiming:3.5,after_market_purchase:3},skin_creator:!1,unlock_locked_dinos:"none",queue_skip:!1,early_access:!1,premium_discord_role:!1,discord_supporter_role:!1,supporter_channels:!1,priority_event_invites:!1}}},{rank:22,id:"sq95sb5oicuo6ggktcvmost2rsm7fq",name:"Featherweight OP",tag:"FWOP",level:1,kills:0,deaths:4,kdr:0,rankName:"FWOP",clanPoints:4,members:2,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=sq95sb5oicuo6ggktcvmost2rsm7fq&i_type=pfp",banner:null,patron_status:{is_patreon_member:!1,patreon_id:null,tier:0,tier_name:"Hatchling",monthly_contribution:0,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:2,xp_boost:0,coin_boost:0,sell_commission:.12,voucher_expire_boost:0,cooldowns:{after_storing:1.5,after_redeeming:3.5,after_claiming:3.5,after_market_purchase:3},skin_creator:!1,unlock_locked_dinos:"none",queue_skip:!1,early_access:!1,premium_discord_role:!1,discord_supporter_role:!1,supporter_channels:!1,priority_event_invites:!1}}},{rank:23,id:"1ts9txvyh0z333u9tr6l8o3ydjkn6e",name:"Midnight Stalkers",tag:"MNDI",level:1,kills:0,deaths:0,kdr:0,rankName:"MNDI",clanPoints:0,members:1,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=1ts9txvyh0z333u9tr6l8o3ydjkn6e&i_type=pfp",banner:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=1ts9txvyh0z333u9tr6l8o3ydjkn6e&i_type=banner",patron_status:null},{rank:24,id:"3sh9f5ysmijh1fyx3whdyug3533z0e",name:"Herrerasaurus",tag:"HERA",level:1,kills:0,deaths:0,kdr:0,rankName:"HERA",clanPoints:0,members:1,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=3sh9f5ysmijh1fyx3whdyug3533z0e&i_type=pfp",banner:null,patron_status:{is_patreon_member:!1,patreon_id:null,tier:null,tier_name:null,monthly_contribution:null,currency:null,supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{}}},{rank:25,id:"btc340cc4wkmo9aj8ki4yjnkq4d36",name:"Herbivore Paladins",tag:"Pali",level:1,kills:0,deaths:0,kdr:0,rankName:"Pali",clanPoints:0,members:1,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=btc340cc4wkmo9aj8ki4yjnkq4d36&i_type=pfp",banner:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=btc340cc4wkmo9aj8ki4yjnkq4d36&i_type=banner",patron_status:{is_patreon_member:!0,patreon_id:null,tier:4,tier_name:"Elder Apex",monthly_contribution:30,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:6,xp_boost:.4,coin_boost:.4,sell_commission:.06,voucher_expire_boost:.5,cooldowns:{after_storing:.7,after_redeeming:1.5,after_claiming:1.25,after_market_purchase:.5},skin_creator:!0,unlock_locked_dinos:"apex",queue_skip:!0,early_access:!0,premium_discord_role:!0,discord_supporter_role:!0,supporter_channels:!0,priority_event_invites:!0}}},{rank:26,id:"g1rd3fdyc84iav632ukro3ykbejaih",name:"The Chosen ones",tag:"JJCO",level:1,kills:1,deaths:0,kdr:1,rankName:"JJCO",clanPoints:0,members:1,maxMembers:25,pfp:null,banner:null,patron_status:{is_patreon_member:!1,patreon_id:null,tier:0,tier_name:"Hatchling",monthly_contribution:0,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:2,xp_boost:0,coin_boost:0,sell_commission:.12,voucher_expire_boost:0,cooldowns:{after_storing:1.5,after_redeeming:3.5,after_claiming:3.5,after_market_purchase:3},skin_creator:!1,unlock_locked_dinos:"none",queue_skip:!1,early_access:!1,premium_discord_role:!1,discord_supporter_role:!1,supporter_channels:!1,priority_event_invites:!1}}},{rank:27,id:"w8e3c3ycq2pqdqexmt6hjbbxr8oz9c",name:"Cats",tag:"Cats",level:1,kills:0,deaths:0,kdr:0,rankName:"Cats",clanPoints:0,members:1,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=w8e3c3ycq2pqdqexmt6hjbbxr8oz9c&i_type=pfp",banner:null,patron_status:null},{rank:28,id:"z8ak70m3zs5lwqtfttvg5l4czao3es",name:"The Haze Gang",tag:"HAZE",level:1,kills:0,deaths:4,kdr:0,rankName:"HAZE",clanPoints:0,members:1,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=z8ak70m3zs5lwqtfttvg5l4czao3es&i_type=pfp",banner:null,patron_status:{is_patreon_member:!1,patreon_id:null,tier:0,tier_name:"Hatchling",monthly_contribution:0,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:2,xp_boost:0,coin_boost:0,sell_commission:.12,voucher_expire_boost:0,cooldowns:{after_storing:1.5,after_redeeming:3.5,after_claiming:3.5,after_market_purchase:3},skin_creator:!1,unlock_locked_dinos:"none",queue_skip:!1,early_access:!1,premium_discord_role:!1,discord_supporter_role:!1,supporter_channels:!1,priority_event_invites:!1}}},{rank:29,id:"aieksv6vqdc4dj2mmryf74hs5s2njy",name:"Damage Per Second",tag:"DPS",level:1,kills:0,deaths:1,kdr:0,rankName:"DPS",clanPoints:0,members:2,maxMembers:25,pfp:null,banner:null,patron_status:null},{rank:30,id:"qo1xfjg5ndjfay78jsys6cwzfmr3vc",name:"Jeffery Epstein Didn't Kill Himself",tag:"JDKH",level:1,kills:7,deaths:6,kdr:1.17,rankName:"JDKH",clanPoints:0,members:2,maxMembers:25,pfp:null,banner:null,patron_status:null},{rank:31,id:"hr2wy29fvdaa21ujtgen34yn59o0gu",name:"Killers of Stealth",tag:"KoS",level:1,kills:22,deaths:76,kdr:.29,rankName:"KoS",clanPoints:0,members:1,maxMembers:25,pfp:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=hr2wy29fvdaa21ujtgen34yn59o0gu&i_type=pfp",banner:"/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=hr2wy29fvdaa21ujtgen34yn59o0gu&i_type=banner",patron_status:{is_patreon_member:!0,patreon_id:null,tier:4,tier_name:"Elder Apex",monthly_contribution:30,currency:"USD",supporting_since:null,next_billing_date:null,exclusive_features:[],benefits:{storage_slots:6,xp_boost:.4,coin_boost:.4,sell_commission:.06,voucher_expire_boost:.5,cooldowns:{after_storing:.7,after_redeeming:1.5,after_claiming:1.25,after_market_purchase:.5},skin_creator:!0,unlock_locked_dinos:"apex",queue_skip:!0,early_access:!0,premium_discord_role:!0,discord_supporter_role:!0,supporter_channels:!0,priority_event_invites:!0}}}]};

const topPlayers = playerData.topPlayers;
const mostKillsPlayers = playerData.mostKillsPlayers;
const mostDeathsPlayers = playerData.mostDeathsPlayers;
const mostPlaytimePlayers = playerData.mostPlaytimePlayers;
const mostXPPlayers = playerData.mostXPPlayers;
const richestPlayers = playerData.richestPlayers;
const distanceTraveledPlayers = playerData.distanceTraveledPlayers;

function formatPlaytime(ms) {
    const hours = ms / (1000 * 60 * 60);
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = Math.floor(hours % 24);
        if (remainingHours === 0) {
            return `${days} ${days === 1 ? 'day' : 'days'}`;
        }
        return `${days} ${days === 1 ? 'day' : 'days'}, ${remainingHours} ${remainingHours === 1 ? 'hour' : 'hours'}`;
    }
    return `${Math.floor(hours)} ${Math.floor(hours) === 1 ? 'hour' : 'hours'}`;
}

function renderPlayersRecap() {
    const container = document.getElementById('playersRecap');
    if (!container) return;

    container.innerHTML = '';

    topPlayers.forEach((player, index) => {
        const card = document.createElement('div');
        const rank = index + 1;
        const isHidden = rank > 3;
        card.className = `player-card ${isHidden ? 'player-hidden' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;

        let rankClass = '';
        if (rank === 1) rankClass = 'rank-gold';
        else if (rank === 2) rankClass = 'rank-silver';
        else if (rank === 3) rankClass = 'rank-bronze';

        card.innerHTML = Templates.playerCardKd({
            rank: rank,
            rankClass: rankClass,
            pfp: player.pfp,
            username: player.username,
            firstLetter: player.username.charAt(0).toUpperCase(),
            kills: player.kills,
            deaths: player.deaths,
            kd: player.kd.toFixed(2)
        });
        container.appendChild(card);
    });
}

function renderMostKills() {
    const container = document.getElementById('mostKillsRecap');
    if (!container) return;

    container.innerHTML = '';

    mostKillsPlayers.forEach((player, index) => {
        const card = document.createElement('div');
        const rank = index + 1;
        const isHidden = rank > 3;
        card.className = `player-card ${isHidden ? 'player-hidden' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;

        let rankClass = '';
        if (rank === 1) rankClass = 'rank-gold';
        else if (rank === 2) rankClass = 'rank-silver';
        else if (rank === 3) rankClass = 'rank-bronze';

        card.innerHTML = Templates.playerCardKills({
            rank: rank,
            rankClass: rankClass,
            pfp: player.pfp,
            username: player.username,
            firstLetter: player.username.charAt(0).toUpperCase(),
            kills: player.kills,
            deaths: player.deaths,
            kd: player.kd.toFixed(2)
        });
        container.appendChild(card);
    });
}

function renderMostDeaths() {
    const container = document.getElementById('mostDeathsRecap');
    if (!container) return;

    container.innerHTML = '';

    mostDeathsPlayers.forEach((player, index) => {
        const card = document.createElement('div');
        const rank = index + 1;
        const isHidden = rank > 3;
        card.className = `player-card ${isHidden ? 'player-hidden' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;

        let rankClass = '';
        if (rank === 1) rankClass = 'rank-gold';
        else if (rank === 2) rankClass = 'rank-silver';
        else if (rank === 3) rankClass = 'rank-bronze';

        card.innerHTML = Templates.playerCardDeaths({
            rank: rank,
            rankClass: rankClass,
            pfp: player.pfp,
            username: player.username,
            firstLetter: player.username.charAt(0).toUpperCase(),
            kills: player.kills,
            deaths: player.deaths,
            kd: player.kd.toFixed(2)
        });
        container.appendChild(card);
    });
}

function renderMostPlaytime() {
    const container = document.getElementById('mostPlaytimeRecap');
    if (!container) return;

    container.innerHTML = '';

    mostPlaytimePlayers.forEach((player, index) => {
        const card = document.createElement('div');
        const rank = index + 1;
        const isHidden = rank > 3;
        card.className = `player-card ${isHidden ? 'player-hidden' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;

        let rankClass = '';
        if (rank === 1) rankClass = 'rank-gold';
        else if (rank === 2) rankClass = 'rank-silver';
        else if (rank === 3) rankClass = 'rank-bronze';

        const playtimeFormatted = formatPlaytime(player.playtime);
        const hours = Math.floor(player.playtime / (1000 * 60 * 60));

        card.innerHTML = Templates.playerCardPlaytime({
            rank: rank,
            rankClass: rankClass,
            pfp: player.pfp,
            username: player.username,
            firstLetter: player.username.charAt(0).toUpperCase(),
            playtime: playtimeFormatted,
            hours: hours.toLocaleString()
        });
        container.appendChild(card);
    });
}

function renderMostXP() {
    const container = document.getElementById('mostXPRecap');
    if (!container) return;

    container.innerHTML = '';

    mostXPPlayers.forEach((player, index) => {
        const card = document.createElement('div');
        const rank = index + 1;
        const isHidden = rank > 3;
        card.className = `player-card ${isHidden ? 'player-hidden' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;

        let rankClass = '';
        if (rank === 1) rankClass = 'rank-gold';
        else if (rank === 2) rankClass = 'rank-silver';
        else if (rank === 3) rankClass = 'rank-bronze';

        const xpRounded = Math.round(player.xp);
        const xpFormatted = xpRounded.toLocaleString('en-US');

        card.innerHTML = Templates.playerCardXP({
            rank: rank,
            rankClass: rankClass,
            pfp: player.pfp,
            username: player.username,
            firstLetter: player.username.charAt(0).toUpperCase(),
            kills: player.kills,
            deaths: player.deaths,
            xp: xpFormatted
        });
        container.appendChild(card);
    });
}

function renderRichestPlayers() {
    const container = document.getElementById('richestPlayersRecap');
    if (!container) return;

    container.innerHTML = '';

    richestPlayers.forEach((player, index) => {
        const card = document.createElement('div');
        const rank = index + 1;
        const isHidden = rank > 3;
        card.className = `player-card ${isHidden ? 'player-hidden' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;

        let rankClass = '';
        if (rank === 1) rankClass = 'rank-gold';
        else if (rank === 2) rankClass = 'rank-silver';
        else if (rank === 3) rankClass = 'rank-bronze';

        card.innerHTML = Templates.playerCardBalance({
            rank: rank,
            rankClass: rankClass,
            pfp: player.pfp,
            username: player.username,
            firstLetter: player.username.charAt(0).toUpperCase(),
            balance: player.balance.toLocaleString()
        });
        container.appendChild(card);
    });
}

function renderDistanceTraveled() {
    const container = document.getElementById('distanceTraveledRecap');
    if (!container) return;

    container.innerHTML = '';

    distanceTraveledPlayers.forEach((player, index) => {
        const card = document.createElement('div');
        const rank = index + 1;
        const isHidden = rank > 3;
        card.className = `player-card ${isHidden ? 'player-hidden' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;

        let rankClass = '';
        if (rank === 1) rankClass = 'rank-gold';
        else if (rank === 2) rankClass = 'rank-silver';
        else if (rank === 3) rankClass = 'rank-bronze';

        const distanceRounded = Math.round(player.distance_traveled);
        const distanceKm = (player.distance_traveled / 1000).toFixed(2);

        card.innerHTML = Templates.playerCardDistance({
            rank: rank,
            rankClass: rankClass,
            pfp: player.pfp,
            username: player.username,
            firstLetter: player.username.charAt(0).toUpperCase(),
            distance: distanceRounded.toLocaleString(),
            distanceKm: distanceKm
        });
        container.appendChild(card);
    });
}

function togglePlayers(containerId, buttonId) {
    const container = document.getElementById(containerId);
    const button = document.getElementById(buttonId);
    const expandText = button.querySelector('.expand-text');
    const expandIcon = button.querySelector('.expand-icon');
    const hiddenCards = container.querySelectorAll('.player-hidden');
    const section = container.closest('.players-recap-section');

    if (hiddenCards.length > 0 && hiddenCards[0].style.display === 'none') {
        hiddenCards.forEach(card => {
            card.style.display = '';
            card.classList.add('visible');
        });
        expandText.textContent = 'Show Less';
        expandIcon.textContent = '▲';
        button.classList.add('expanded');
        if (section) section.classList.add('expanded');
    } else {
        hiddenCards.forEach(card => {
            card.style.display = 'none';
        });
        expandText.textContent = 'Show More';
        expandIcon.textContent = '▼';
        button.classList.remove('expanded');
        if (section) section.classList.remove('expanded');
    }
}

function getClanImageUrl(clan, imageType = 'pfp') {
    if (!clan || !clan.id) return null;
    
    const iType = imageType === 'banner' ? 'banner' : 'pfp';
    return `https://cdn.astroslounge.com/api/v4/jj/authenticated?type=clan_img&key=bypass&clan_id=${clan.id}&i_type=${iType}`;
}

function renderClanKd() {
    const container = document.getElementById('clanKdRecap');
    if (!container) return;

    container.innerHTML = '';
    const clans = [...playerData.clanLeaderboard].sort((a, b) => b.kdr - a.kdr).slice(0, 9);

    clans.forEach((clan, index) => {
        const card = document.createElement('div');
        const rank = index + 1;
        const isHidden = rank > 3;
        card.className = `player-card ${isHidden ? 'player-hidden' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;
        if (isHidden) {
            card.style.display = 'none';
        }

        let rankClass = '';
        if (rank === 1) rankClass = 'rank-gold';
        else if (rank === 2) rankClass = 'rank-silver';
        else if (rank === 3) rankClass = 'rank-bronze';

        const pfpUrl = getClanImageUrl(clan);
        const fallbackInitial = clan.name ? clan.name.charAt(0).toUpperCase() : '?';

        card.innerHTML = Templates.clanCardKd({
            rank: rank,
            rankClass: rankClass,
            pfpUrl: pfpUrl,
            fallbackInitial: fallbackInitial,
            name: clan.name || 'Unknown',
            tag: clan.tag || 'N/A',
            kills: clan.kills || 0,
            deaths: clan.deaths || 0,
            kdr: (clan.kdr || 0).toFixed(2),
            members: clan.members || 0,
            maxMembers: clan.maxMembers || 25
        });
        container.appendChild(card);
    });
}

function renderClanKills() {
    const container = document.getElementById('clanKillsRecap');
    if (!container) return;

    container.innerHTML = '';
    const clans = [...playerData.clanLeaderboard].sort((a, b) => b.kills - a.kills).slice(0, 9);

    clans.forEach((clan, index) => {
        const card = document.createElement('div');
        const rank = index + 1;
        const isHidden = rank > 3;
        card.className = `player-card ${isHidden ? 'player-hidden' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;
        if (isHidden) {
            card.style.display = 'none';
        }

        let rankClass = '';
        if (rank === 1) rankClass = 'rank-gold';
        else if (rank === 2) rankClass = 'rank-silver';
        else if (rank === 3) rankClass = 'rank-bronze';

        const pfpUrl = getClanImageUrl(clan);
        const fallbackInitial = clan.name ? clan.name.charAt(0).toUpperCase() : '?';

        card.innerHTML = Templates.clanCardKills({
            rank: rank,
            rankClass: rankClass,
            pfpUrl: pfpUrl,
            fallbackInitial: fallbackInitial,
            name: clan.name || 'Unknown',
            tag: clan.tag || 'N/A',
            kills: clan.kills || 0,
            deaths: clan.deaths || 0,
            kdr: (clan.kdr || 0).toFixed(2)
        });
        container.appendChild(card);
    });
}

function renderClanDeaths() {
    const container = document.getElementById('clanDeathsRecap');
    if (!container) return;

    container.innerHTML = '';
    const clans = [...playerData.clanLeaderboard].sort((a, b) => b.deaths - a.deaths).slice(0, 9);

    clans.forEach((clan, index) => {
        const card = document.createElement('div');
        const rank = index + 1;
        const isHidden = rank > 3;
        card.className = `player-card ${isHidden ? 'player-hidden' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;
        if (isHidden) {
            card.style.display = 'none';
        }

        let rankClass = '';
        if (rank === 1) rankClass = 'rank-gold';
        else if (rank === 2) rankClass = 'rank-silver';
        else if (rank === 3) rankClass = 'rank-bronze';

        const pfpUrl = getClanImageUrl(clan);
        const fallbackInitial = clan.name ? clan.name.charAt(0).toUpperCase() : '?';

        card.innerHTML = Templates.clanCardDeaths({
            rank: rank,
            rankClass: rankClass,
            pfpUrl: pfpUrl,
            fallbackInitial: fallbackInitial,
            name: clan.name || 'Unknown',
            tag: clan.tag || 'N/A',
            kills: clan.kills || 0,
            deaths: clan.deaths || 0,
            kdr: (clan.kdr || 0).toFixed(2)
        });
        container.appendChild(card);
    });
}

function renderClanPoints() {
    const container = document.getElementById('clanPointsRecap');
    if (!container) return;

    container.innerHTML = '';
    const clans = [...playerData.clanLeaderboard].sort((a, b) => b.clanPoints - a.clanPoints).slice(0, 9);

    clans.forEach((clan, index) => {
        const card = document.createElement('div');
        const rank = index + 1;
        const isHidden = rank > 3;
        card.className = `player-card ${isHidden ? 'player-hidden' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;
        if (isHidden) {
            card.style.display = 'none';
        }

        let rankClass = '';
        if (rank === 1) rankClass = 'rank-gold';
        else if (rank === 2) rankClass = 'rank-silver';
        else if (rank === 3) rankClass = 'rank-bronze';

        const pfpUrl = getClanImageUrl(clan);
        const fallbackInitial = clan.name ? clan.name.charAt(0).toUpperCase() : '?';

        card.innerHTML = Templates.clanCardPoints({
            rank: rank,
            rankClass: rankClass,
            pfpUrl: pfpUrl,
            fallbackInitial: fallbackInitial,
            name: clan.name || 'Unknown',
            tag: clan.tag || 'N/A',
            clanPoints: Math.round(clan.clanPoints || 0).toLocaleString(),
            kills: clan.kills || 0,
            deaths: clan.deaths || 0
        });
        container.appendChild(card);
    });
}

function renderClanMembers() {
    const container = document.getElementById('clanMembersRecap');
    if (!container) return;

    container.innerHTML = '';
    const clans = [...playerData.clanLeaderboard].sort((a, b) => b.members - a.members).slice(0, 9);

    clans.forEach((clan, index) => {
        const card = document.createElement('div');
        const rank = index + 1;
        const isHidden = rank > 3;
        card.className = `player-card ${isHidden ? 'player-hidden' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;
        if (isHidden) {
            card.style.display = 'none';
        }

        let rankClass = '';
        if (rank === 1) rankClass = 'rank-gold';
        else if (rank === 2) rankClass = 'rank-silver';
        else if (rank === 3) rankClass = 'rank-bronze';

        const pfpUrl = getClanImageUrl(clan);
        const fallbackInitial = clan.name ? clan.name.charAt(0).toUpperCase() : '?';

        card.innerHTML = Templates.clanCardMembers({
            rank: rank,
            rankClass: rankClass,
            pfpUrl: pfpUrl,
            fallbackInitial: fallbackInitial,
            name: clan.name || 'Unknown',
            tag: clan.tag || 'N/A',
            members: clan.members || 0,
            maxMembers: clan.maxMembers || 25,
            kills: clan.kills || 0,
            kdr: (clan.kdr || 0).toFixed(2)
        });
        container.appendChild(card);
    });
}

function toggleClans(containerId, buttonId) {
    const container = document.getElementById(containerId);
    const button = document.getElementById(buttonId);
    const expandText = button.querySelector('.expand-text');
    const expandIcon = button.querySelector('.expand-icon');
    const hiddenCards = container.querySelectorAll('.player-hidden');
    const section = container.closest('.players-recap-section');

    if (hiddenCards.length > 0 && hiddenCards[0].style.display === 'none') {
        hiddenCards.forEach(card => {
            card.style.display = '';
            card.classList.add('visible');
        });
        expandText.textContent = 'Show Less';
        expandIcon.textContent = '▲';
        button.classList.add('expanded');
        if (section) section.classList.add('expanded');
    } else {
        hiddenCards.forEach(card => {
            card.style.display = 'none';
        });
        expandText.textContent = 'Show More';
        expandIcon.textContent = '▼';
        button.classList.remove('expanded');
        if (section) section.classList.remove('expanded');
    }
}

const streamers = [
    { name: "Astrogaming057", url: "https://www.twitch.tv/astrogaming057" },
    { name: "TristanRTX", url: "https://www.twitch.tv/tristanrtx" },
    { name: "SpeedyFireEagle", url: "https://www.twitch.tv/speedyfireeagle" },
    { name: "EZxFans", url: "https://www.twitch.tv/ezxfans" },
    { name: "Ivy_Rose_Wolf", url: "https://www.twitch.tv/ivy_rose_wolf" },
    { name: "deamoncrazed", url: "https://www.twitch.tv/deamoncrazed" },
    { name: "ANZAC_Ace1", url: "https://www.twitch.tv/anzac_ace1" },
    { name: "hastyhen", url: "https://www.twitch.tv/hasty_hen" },
    { name: "duskwolfttv", url: "https://www.twitch.tv/duskwolfttv" },
    { name: "booshg4tv", url: "https://www.twitch.tv/booshg4tv" },
    { name: "harufox", url: "https://www.twitch.tv/harufox" },
    { name: "stevie_the_tv", url: "https://www.twitch.tv/stevie_the_tv" },
    { name: "FadedGhost_", url: "https://www.twitch.tv/fadedghost_" },
    { name: "bdawggg", url: "https://www.twitch.tv/bdawggg" },
    { name: "sadxsadie", url: "https://www.twitch.tv/sadxsadie" },
    { name: "cactiisaurus", url: "https://www.twitch.tv/cactiisaurus" },
    { name: "MandyMurder", url: "https://www.twitch.tv/mandymurder" },
    { name: "that_carroll_guy", url: "https://www.twitch.tv/that_carroll_guy" },
    { name: "Wreckona", url: "https://www.twitch.tv/wreckona" },
    { name: "doryuuu_", url: "https://www.twitch.tv/doryuuu_" },
    { name: "Gunnerthewolf_", url: "https://www.twitch.tv/gunnerthewolf_" },
    { name: "ram_bitious", url: "https://www.twitch.tv/ram_bitious" },
    { name: "Ebenholzross", url: "https://www.twitch.tv/ebenholzross" },
    { name: "FROG_M4N", url: "https://www.twitch.tv/frog_m4n" },
    { name: "LolliTwtch", url: "https://www.twitch.tv/lollitwtch" },
    { name: "its_jus_slim", url: "https://www.twitch.tv/its_jus_slim" },
    { name: "AdamWas_Here", url: "https://www.twitch.tv/adamwas_here" },
    { name: "CaptFantastic__", url: "https://www.twitch.tv/captfantastic__" },
    { name: "RecklessBanzai", url: "https://www.twitch.tv/recklessbanzai" },
    { name: "WhersMyBic", url: "https://www.twitch.tv/whersmybic" },
    { name: "meneerdank", url: "https://www.twitch.tv/meneerdank" }
];

function renderStreamers() {
    const container = document.getElementById('streamersList');
    streamers.forEach((streamer, index) => {
        const streamerElement = document.createElement('a');
        streamerElement.href = streamer.url;
        streamerElement.target = '_blank';
        streamerElement.rel = 'noopener noreferrer';
        streamerElement.className = 'streamer-link';
        streamerElement.textContent = streamer.name;
        streamerElement.style.animationDelay = `${index * 0.03}s`;
        streamerElement.style.opacity = '0';
        streamerElement.style.animation = 'fadeInUp 0.6s ease forwards';
        container.appendChild(streamerElement);
    });
}

const patreonBackers = [
    "EZxFans", "Riersch Tibor", "Erza", "Lenny Reiling", "Midos", "Spencer Powell", "spencer",
    "Kyle Perun", "TrippMachine", "Gauchen -sama", "doryuuu_", "K4D3D2", "Jordan",
    "Gumble G", "TristanRTX", "CmK", "Aly Werner", "Sylvia Vorderbrug", "Stan Stephenson",
    "kyle Bertsch", "ปรัชญา บุญชู", "Jamie C", "Twatty", "Syed Jasoor", "MrsSilentG",
    "Francis Sy", "Zawesomesauce", "Eirik Kvi", "Pavel Tůma", "Elena_noir", "Mike Litoris",
    "Rose Effect", "Karly", "Braden Neal", "Toska", "Emily", "Ramzee", "NecrosisGaming",
    "Duckie", "OneTrickBambi", "EdwardJJ Jenkins", "Dariela Martinez", "WALTER",
    "George Dervishian", "Aaron Simmons", "Shindig Jones", "Misty Blackfoot",
    "pattiesonamfgrill", "Luke Miller", "Marius Kvedaravicius", "ANZAC Ace", "NightWolf_317",
    "Bryce Doucette", "Victoria Crow", "Katie", "Brad", "Ashton Grahm", "D W", "Asuna 1539",
    "El Russo", "HastyDrake", "Raven Kalera", "wayne fenton", "tanker", "LelaPlayz",
    "Sabin Sharon", "Thomas Rodgers", "StonyBongBoa", "Tuggy", "Lexi Davis", "Tim Trabbic",
    "Eric Behrsin", "Madison Harris", "SlightlySxlty", "Cory Andress", "astrogaming057"
];

function renderPatreonBackers() {
    const container = document.getElementById('patreonList');
    patreonBackers.forEach((name, index) => {
        const nameElement = document.createElement('div');
        nameElement.className = 'patreon-name';
        nameElement.textContent = name;
        nameElement.style.animationDelay = `${index * 0.05}s`;
        nameElement.style.opacity = '0';
        nameElement.style.animation = 'fadeInUp 0.6s ease forwards';
        container.appendChild(nameElement);
    });
}

function updateTotalStats() {
    const totalKills = dinoStatsRaw.reduce((sum, dino) => sum + (dino.total_kills || 0), 0);
    const totalDeaths = dinoStatsRaw.reduce((sum, dino) => sum + (dino.total_deaths || 0), 0);
    const totalTimePlayedMs = dinoStatsRaw.reduce((sum, dino) => sum + (dino.total_timeplayed || 0), 0);

    const totalHoursPlayed = Math.floor(totalTimePlayedMs / (1000 * 60 * 60));

    const killsElement = document.getElementById('totalKills');
    const deathsElement = document.getElementById('totalDeaths');
    const hoursElement = document.getElementById('totalHoursPlayed');

    if (killsElement) {
        killsElement.textContent = totalKills.toLocaleString();
    }
    if (deathsElement) {
        deathsElement.textContent = totalDeaths.toLocaleString();
    }
    if (hoursElement) {
        hoursElement.textContent = totalHoursPlayed.toLocaleString();
    }
}

function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    setTimeout(() => {
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach((card) => {
            observer.observe(card);
        });
    }, 100);

    const timelineItems = document.querySelectorAll('.timeline-item');
    timelineItems.forEach((item) => {
        observer.observe(item);
    });

    const memoryCards = document.querySelectorAll('.memory-card');
    memoryCards.forEach((card) => {
        observer.observe(card);
    });

    const playerCards = document.querySelectorAll('.player-card');
    playerCards.forEach((card) => {
        observer.observe(card);
    });
}

function enhanceInteractivity() {
    const interactiveElements = document.querySelectorAll('a, button, .stat-card, .dino-card, .staff-member, .streamer-link, .patreon-name');

    interactiveElements.forEach(element => {
        element.addEventListener('mouseenter', function () {
            this.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        });
    });
}

function initParallax() {
    const hero = document.querySelector('.hero');
    if (hero) {
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const rate = scrolled * 0.5;
            hero.style.transform = `translateY(${rate}px)`;
        });
    }
}

function initMusicPlayer() {
    const audio = document.getElementById('backgroundMusic');
    const toggleButton = document.getElementById('musicToggle');
    const musicIcon = toggleButton.querySelector('.music-icon');
    const musicText = toggleButton.querySelector('.music-text');

    const wasPlaying = localStorage.getItem('musicPlaying') === 'true';

    audio.volume = 0.3;

    audio.addEventListener('canplaythrough', () => {
        if (wasPlaying) {
            audio.play().catch(err => {
                console.log('Autoplay prevented:', err);
            });
        }
    });

    function updateButtonState() {
        if (audio.paused) {
            toggleButton.classList.remove('playing');
            musicText.textContent = 'Play Theme';
        } else {
            toggleButton.classList.add('playing');
            musicText.textContent = 'Pause Theme';
        }
    }

    toggleButton.addEventListener('click', () => {
        if (audio.paused) {
            audio.play().then(() => {
                localStorage.setItem('musicPlaying', 'true');
                updateButtonState();
            }).catch(err => {
                console.log('Play failed:', err);
                alert('Please click the button to start the music. Some browsers require user interaction to play audio.');
            });
        } else {
            audio.pause();
            localStorage.setItem('musicPlaying', 'false');
            updateButtonState();
        }
    });

    audio.addEventListener('pause', updateButtonState);
    audio.addEventListener('play', updateButtonState);

    audio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        musicText.textContent = 'Music Unavailable';
        toggleButton.style.opacity = '0.5';
        toggleButton.style.cursor = 'not-allowed';
    });

    updateButtonState();
}

function initBepiCard() {
    const bepiCard = document.getElementById('bepiCard');
    const rexCard = document.getElementById('rexCard');
    const deinoCard = document.getElementById('deinoCard');
    const alloCard = document.getElementById('alloCard');
    const stegoCard = document.getElementById('stegoCard');
    const diabloCard = document.getElementById('diabloCard');
    const pteroCard = document.getElementById('pteroCard');
    const maiaCard = document.getElementById('maiaCard');
    const triceraCard = document.getElementById('triceraCard');
    const troodonCard = document.getElementById('troodonCard');
    const ceratoCard = document.getElementById('ceratoCard');
    const omniCard = document.getElementById('omniCard');
    const hypsiCard = document.getElementById('hypsiCard');
    const carnoCard = document.getElementById('carnoCard');
    const herreraCard = document.getElementById('herreraCard');
    const tenontoCard = document.getElementById('tenontoCard');
    const diloCard = document.getElementById('diloCard');
    const galliCard = document.getElementById('galliCard');
    const pachyCard = document.getElementById('pachyCard');
    const dryoCard = document.getElementById('dryoCard');

    function initCard(card) {
        if (!card) return;

        const hintText = card.querySelector('.bepi-hover-hint');

        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        if (isTouchDevice) {
            if (hintText) {
                hintText.textContent = 'Tap to see stats';
            }
            card.addEventListener('click', () => {
                card.classList.toggle('flipped');
            });
        }
    }

    initCard(bepiCard);
    initCard(rexCard);
    initCard(deinoCard);
    initCard(alloCard);
    initCard(stegoCard);
    initCard(diabloCard);
    initCard(pteroCard);
    initCard(maiaCard);
    initCard(triceraCard);
    initCard(troodonCard);
    initCard(ceratoCard);
    initCard(omniCard);
    initCard(hypsiCard);
    initCard(carnoCard);
    initCard(herreraCard);
    initCard(tenontoCard);
    initCard(diloCard);
    initCard(galliCard);
    initCard(pachyCard);
    initCard(dryoCard);
}

const totalPlayers = 4743;

const playerLocationsData = [
    { "ip": "US", "percentage": "66.2%", "players": Math.round(totalPlayers * 0.662) },
    { "ip": "GB", "percentage": "8.8%", "players": Math.round(totalPlayers * 0.088) },
    { "ip": "CA", "percentage": "6.48%", "players": Math.round(totalPlayers * 0.0648) },
    { "ip": "AU", "percentage": "3.24%", "players": Math.round(totalPlayers * 0.0324) },
    { "ip": "DE", "percentage": "2.78%", "players": Math.round(totalPlayers * 0.0278) },
    { "ip": "CN", "percentage": "2.50%", "players": Math.round(totalPlayers * 0.025) },
    { "ip": "RU", "percentage": "2.20%", "players": Math.round(totalPlayers * 0.022) },
    { "ip": "NO", "percentage": "1.85%", "players": Math.round(totalPlayers * 0.0185) },
    { "ip": "IN", "percentage": "1.39%", "players": Math.round(totalPlayers * 0.0139) },
    { "ip": "SE", "percentage": "1.39%", "players": Math.round(totalPlayers * 0.0139) },
    { "ip": "NZ", "percentage": "0.93%", "players": Math.round(totalPlayers * 0.0093) },
    { "ip": "PL", "percentage": "0.93%", "players": Math.round(totalPlayers * 0.0093) },
    { "ip": "BG", "percentage": "0.93%", "players": Math.round(totalPlayers * 0.0093) },
    { "ip": "FI", "percentage": "0.93%", "players": Math.round(totalPlayers * 0.0093) },
    { "ip": "FR", "percentage": "0.93%", "players": Math.round(totalPlayers * 0.0093) },
    { "ip": "BR", "percentage": "0.70%", "players": Math.round(totalPlayers * 0.007) },
    { "ip": "ES", "percentage": "0.65%", "players": Math.round(totalPlayers * 0.0065) },
    { "ip": "IT", "percentage": "0.60%", "players": Math.round(totalPlayers * 0.006) },
    { "ip": "NL", "percentage": "0.46%", "players": Math.round(totalPlayers * 0.0046) },
    { "ip": "JP", "percentage": "0.46%", "players": Math.round(totalPlayers * 0.0046) },
    { "ip": "IE", "percentage": "0.46%", "players": Math.round(totalPlayers * 0.0046) },
    { "ip": "GR", "percentage": "0.46%", "players": Math.round(totalPlayers * 0.0046) },
    { "ip": "ZA", "percentage": "0.46%", "players": Math.round(totalPlayers * 0.0046) },
    { "ip": "PH", "percentage": "0.46%", "players": Math.round(totalPlayers * 0.0046) },
    { "ip": "MX", "percentage": "0.46%", "players": Math.round(totalPlayers * 0.0046) },
    { "ip": "BE", "percentage": "0.42%", "players": Math.round(totalPlayers * 0.0042) },
    { "ip": "DK", "percentage": "0.38%", "players": Math.round(totalPlayers * 0.0038) },
    { "ip": "CH", "percentage": "0.35%", "players": Math.round(totalPlayers * 0.0035) },
    { "ip": "AT", "percentage": "0.32%", "players": Math.round(totalPlayers * 0.0032) },
    { "ip": "PT", "percentage": "0.30%", "players": Math.round(totalPlayers * 0.003) },
    { "ip": "CZ", "percentage": "0.28%", "players": Math.round(totalPlayers * 0.0028) },
    { "ip": "RO", "percentage": "0.25%", "players": Math.round(totalPlayers * 0.0025) },
    { "ip": "HU", "percentage": "0.23%", "players": Math.round(totalPlayers * 0.0023) },
    { "ip": "TR", "percentage": "0.20%", "players": Math.round(totalPlayers * 0.002) },
    { "ip": "KR", "percentage": "0.18%", "players": Math.round(totalPlayers * 0.0018) },
    { "ip": "AR", "percentage": "0.15%", "players": Math.round(totalPlayers * 0.0015) },
    { "ip": "CL", "percentage": "0.12%", "players": Math.round(totalPlayers * 0.0012) },
    { "ip": "CO", "percentage": "0.10%", "players": Math.round(totalPlayers * 0.001) },
    { "ip": "PE", "percentage": "0.08%", "players": Math.round(totalPlayers * 0.0008) },
    { "ip": "VE", "percentage": "0.05%", "players": Math.round(totalPlayers * 0.0005) },
    { "ip": "TH", "percentage": "0.03%", "players": Math.round(totalPlayers * 0.0003) }
];


const regionFlags = {
    "US": "🇺🇸", "GB": "🇬🇧", "CA": "🇨🇦", "AU": "🇦🇺", "DE": "🇩🇪",
    "CN": "🇨🇳", "RU": "🇷🇺", "NO": "🇳🇴", "IN": "🇮🇳", "SE": "🇸🇪",
    "NZ": "🇳🇿", "PL": "🇵🇱", "BG": "🇧🇬", "FI": "🇫🇮", "FR": "🇫🇷",
    "BR": "🇧🇷", "ES": "🇪🇸", "IT": "🇮🇹", "NL": "🇳🇱", "JP": "🇯🇵",
    "IE": "🇮🇪", "GR": "🇬🇷", "ZA": "🇿🇦", "PH": "🇵🇭", "MX": "🇲🇽",
    "BE": "🇧🇪", "DK": "🇩🇰", "CH": "🇨🇭", "AT": "🇦🇹", "PT": "🇵🇹",
    "CZ": "🇨🇿", "RO": "🇷🇴", "HU": "🇭🇺", "TR": "🇹🇷", "KR": "🇰🇷",
    "AR": "🇦🇷", "CL": "🇨🇱", "CO": "🇨🇴", "PE": "🇵🇪", "VE": "🇻🇪",
    "TH": "🇹🇭", "OTHER": "🌍"
};

function getColorForPercentage(percentage) {
    const percent = parseFloat(percentage.replace('%', ''));
    if (percent >= 50) return 'rgba(0, 255, 136, 0.8)';
    if (percent >= 10) return 'rgba(0, 255, 136, 0.6)';
    if (percent >= 5) return 'rgba(0, 255, 136, 0.4)';
    if (percent >= 1) return 'rgba(0, 255, 136, 0.3)';
    return 'rgba(0, 255, 136, 0.2)';
}

function renderPlayerLocations() {
    const worldMapSvg = document.getElementById('world-map-svg');
    const regionsList = document.getElementById('regionsList');
    
    if (!worldMapSvg || !regionsList) return;
    
    playerLocationsData.forEach(region => {
        const countryPath = worldMapSvg.querySelector(`#${region.ip}`);
        if (countryPath) {
            const color = getColorForPercentage(region.percentage);
            countryPath.setAttribute('fill', color);
            countryPath.style.fill = color;
            countryPath.style.transition = 'fill 0.3s ease';
            countryPath.classList.add('country-has-data');
            
            countryPath.addEventListener('mouseenter', () => {
                countryPath.style.filter = 'drop-shadow(0 0 10px rgba(0, 255, 136, 0.8))';
                const regionItem = document.querySelector(`[data-region-id="${region.ip}"]`);
                if (regionItem) {
                    regionItem.style.transform = 'translateX(15px) scale(1.05)';
                }
            });
            
            countryPath.addEventListener('mouseleave', () => {
                countryPath.style.filter = 'none';
                const regionItem = document.querySelector(`[data-region-id="${region.ip}"]`);
                if (regionItem) {
                    regionItem.style.transform = 'translateX(0) scale(1)';
                }
            });
        }
    });
    
    const sortedByPlayers = [...playerLocationsData]
        .filter(region => typeof region.players === 'number' && region.players > 0)
        .sort((a, b) => b.players - a.players);
    
    const topRegions = sortedByPlayers.slice(0, 4);
    const topPlayersTotal = topRegions.reduce((sum, region) => sum + region.players, 0);
    let restPlayers = totalPlayers - topPlayersTotal;
    if (restPlayers < 0) restPlayers = 0;
    const restPercentageValue = totalPlayers > 0 ? (restPlayers / totalPlayers) * 100 : 0;
    const restPercentage = `${restPercentageValue.toFixed(2)}%`;
    
    const sidebarRegions = [
        ...topRegions,
        { ip: 'OTHER', percentage: restPercentage, players: restPlayers }
    ];
    
    regionsList.innerHTML = '';
    sidebarRegions.forEach((region, index) => {
        const percentValue = parseFloat(region.percentage.replace('%', ''));
        const regionItem = document.createElement('div');
        regionItem.className = 'region-item';
        regionItem.setAttribute('data-region-id', region.ip);
        regionItem.style.animationDelay = `${(index + 1) * 0.1}s`;
        
        regionItem.innerHTML = Templates.regionItem({
            ip: region.ip,
            flag: regionFlags[region.ip] || '🌍',
            players: region.players ? region.players.toLocaleString() : '0',
            percentage: region.percentage
        });
        
        regionsList.appendChild(regionItem);
        
        setTimeout(() => {
            const barFill = regionItem.querySelector('.region-bar-fill');
            if (barFill) {
                barFill.style.width = `${percentValue}%`;
            }
        }, (index + 1) * 200 + 500);
        
        regionItem.addEventListener('mouseenter', () => {
            const countryPath = worldMapSvg.querySelector(`#${region.ip}`);
            if (countryPath) {
                countryPath.style.filter = 'drop-shadow(0 0 15px rgba(0, 255, 136, 1))';
                countryPath.style.stroke = 'rgba(0, 255, 136, 1)';
                countryPath.style.strokeWidth = '2';
            }
        });
        
        regionItem.addEventListener('mouseleave', () => {
            const countryPath = worldMapSvg.querySelector(`#${region.ip}`);
            if (countryPath) {
                countryPath.style.filter = 'none';
                countryPath.style.stroke = '#6E6E6E';
                countryPath.style.strokeWidth = '0.4';
            }
        });
    });
}

function initFullscreenToggle() {
    const fullscreenButton = document.getElementById('fullscreenToggle');
    if (!fullscreenButton) return;
    
    const fullscreenIcon = fullscreenButton.querySelector('.fullscreen-icon');
    const fullscreenText = fullscreenButton.querySelector('.fullscreen-text');
    
    function updateButtonState() {
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        
        if (isFullscreen) {
            fullscreenButton.classList.add('active');
            fullscreenIcon.textContent = '⛶';
            fullscreenText.textContent = 'Exit Fullscreen';
        } else {
            fullscreenButton.classList.remove('active');
            fullscreenIcon.textContent = '⛶';
            fullscreenText.textContent = 'Fullscreen';
        }
    }
    
    fullscreenButton.addEventListener('click', () => {
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        
        if (!isFullscreen) {
            const element = document.documentElement;
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
                element.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    });
    
    document.addEventListener('fullscreenchange', updateButtonState);
    document.addEventListener('webkitfullscreenchange', updateButtonState);
    document.addEventListener('mozfullscreenchange', updateButtonState);
    document.addEventListener('MSFullscreenChange', updateButtonState);
    
    updateButtonState();
}

document.addEventListener('DOMContentLoaded', () => {
    updateTotalStats();
    renderDinoStats();
    renderPlayerLocations();
    renderPlayersRecap();
    renderMostKills();
    renderMostDeaths();
    renderClanKd();
    renderClanKills();
    renderClanDeaths();
    renderClanPoints();
    renderClanMembers();
    renderMostPlaytime();
    renderMostXP();
    renderRichestPlayers();
    renderDistanceTraveled();
    renderStreamers();
    renderPatreonBackers();
    initScrollAnimations();
    enhanceInteractivity();
    initMusicPlayer();
    initFullscreenToggle();
    initBepiCard();


    setTimeout(() => {
        const kdHidden = document.querySelectorAll('#playersRecap .player-hidden');
        const killsHidden = document.querySelectorAll('#mostKillsRecap .player-hidden');
        const deathsHidden = document.querySelectorAll('#mostDeathsRecap .player-hidden');
        const playtimeHidden = document.querySelectorAll('#mostPlaytimeRecap .player-hidden');
        const xpHidden = document.querySelectorAll('#mostXPRecap .player-hidden');
        const richestHidden = document.querySelectorAll('#richestPlayersRecap .player-hidden');
        const distanceHidden = document.querySelectorAll('#distanceTraveledRecap .player-hidden');
        kdHidden.forEach(card => card.style.display = 'none');
        killsHidden.forEach(card => card.style.display = 'none');
        deathsHidden.forEach(card => card.style.display = 'none');
        playtimeHidden.forEach(card => card.style.display = 'none');
        xpHidden.forEach(card => card.style.display = 'none');
        richestHidden.forEach(card => card.style.display = 'none');
        distanceHidden.forEach(card => card.style.display = 'none');
    }, 100);

    let autoDemoActive = false;
    let autoDemoTimer = null;
    let autoScrollInterval = null;
    let lastInteraction = Date.now();
    let currentSectionIndex = 0;
    let isAutoScrolling = false;
    let autoScrollEnabled = localStorage.getItem('autoScrollEnabled') === 'true';

    const allSections = document.querySelectorAll('section');
    const allFlipCards = [
        document.getElementById('bepiCard'),
        document.getElementById('rexCard'),
        document.getElementById('deinoCard'),
        document.getElementById('alloCard'),
        document.getElementById('stegoCard'),
        document.getElementById('diabloCard'),
        document.getElementById('pteroCard'),
        document.getElementById('maiaCard'),
        document.getElementById('triceraCard'),
        document.getElementById('troodonCard'),
        document.getElementById('ceratoCard'),
        document.getElementById('omniCard'),
        document.getElementById('hypsiCard'),
        document.getElementById('carnoCard'),
        document.getElementById('herreraCard'),
        document.getElementById('tenontoCard'),
        document.getElementById('diloCard'),
        document.getElementById('galliCard'),
        document.getElementById('pachyCard'),
        document.getElementById('dryoCard')
    ].filter(card => card !== null);

    const expandButtons = [
        { id: 'expandKD', container: 'playersRecap' },
        { id: 'expandKills', container: 'mostKillsRecap' },
        { id: 'expandDeaths', container: 'mostDeathsRecap' },
        { id: 'expandPlaytime', container: 'mostPlaytimeRecap' },
        { id: 'expandXP', container: 'mostXPRecap' },
        { id: 'expandRichest', container: 'richestPlayersRecap' },
        { id: 'expandDistance', container: 'distanceTraveledRecap' }
    ];

    function resetAutoDemoTimer() {
        if (isAutoScrolling || !autoScrollEnabled) return;

        lastInteraction = Date.now();
        if (autoDemoActive) {
            stopAutoDemo();
        }
        if (autoDemoTimer) {
            clearTimeout(autoDemoTimer);
        }
        autoDemoTimer = setTimeout(startAutoDemo, 10000);
    }

    function stopAutoDemo() {
        autoDemoActive = false;
        isAutoScrolling = false;
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }
    }

    function startAutoDemo() {
        if (autoDemoActive) return;
        autoDemoActive = true;
        currentSectionIndex = 0;

        isAutoScrolling = true;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
            isAutoScrolling = false;
        }, 2000);

        setTimeout(() => {
            autoScrollInterval = setInterval(() => {
                if (!autoDemoActive) {
                    clearInterval(autoScrollInterval);
                    return;
                }

                if (currentSectionIndex >= allSections.length) {
                    currentSectionIndex = 0;
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setTimeout(() => {
                        processCurrentSection();
                    }, 2000);
                    return;
                }

                const section = allSections[currentSectionIndex];
                if (section) {
                    isAutoScrolling = true;
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setTimeout(() => {
                        processCurrentSection();
                        setTimeout(() => {
                            isAutoScrolling = false;
                        }, 500);
                    }, 2000);
                }

                currentSectionIndex++;
            }, 4000);
        }, 2000);
    }

    function processCurrentSection() {
        if (!autoDemoActive) return;

        const section = allSections[currentSectionIndex - 1];
        if (!section) return;

        const flipCard = section.querySelector('.bepi-flip-card');
        if (flipCard && !flipCard.classList.contains('flipped')) {
            flipCard.classList.add('flipped');
            setTimeout(() => {
                flipCard.classList.remove('flipped');
            }, 2000);
        }
        const expandButton = section.querySelector('.expand-button');
        if (expandButton) {
            const buttonId = expandButton.id;
            const onclickAttr = expandButton.getAttribute('onclick');
            if (onclickAttr) {
                const match = onclickAttr.match(/togglePlayers\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\)/);
                if (match) {
                    const containerId = match[1];
                    const container = document.getElementById(containerId);
                    const hiddenCards = container?.querySelectorAll('.player-hidden');
                    if (hiddenCards && hiddenCards.length > 0) {
                        const isExpanded = hiddenCards[0].style.display !== 'none';
                        if (!isExpanded) {
                            setTimeout(() => {
                                if (autoDemoActive) {
                                    togglePlayers(containerId, buttonId);
                                    setTimeout(() => {
                                        if (autoDemoActive) {
                                            togglePlayers(containerId, buttonId);
                                        }
                                    }, 3000);
                                }
                            }, 500);
                        }
                    }
                }
            }
        }
    }

    function initAutoScrollToggle() {
        const toggleButton = document.getElementById('autoScrollToggle');
        if (!toggleButton) return;

        function updateToggleState() {
            if (autoScrollEnabled) {
                toggleButton.classList.remove('disabled');
                toggleButton.querySelector('.music-text').textContent = 'Auto Scroll';
            } else {
                toggleButton.classList.add('disabled');
                toggleButton.querySelector('.music-text').textContent = 'Auto Scroll Off';
                if (autoDemoActive) {
                    stopAutoDemo();
                }
                if (autoDemoTimer) {
                    clearTimeout(autoDemoTimer);
                    autoDemoTimer = null;
                }
            }
        }

        toggleButton.addEventListener('click', () => {
            autoScrollEnabled = !autoScrollEnabled;
            localStorage.setItem('autoScrollEnabled', autoScrollEnabled.toString());
            updateToggleState();

            if (autoScrollEnabled) {
                resetAutoDemoTimer();
            }
        });

        updateToggleState();
    }

    function initScrollSnapToggle() {
        const toggleButton = document.getElementById('scrollSnapToggle');
        const htmlElement = document.documentElement;
        if (!toggleButton) return;

        let scrollSnapEnabled = localStorage.getItem('scrollSnapEnabled') !== 'false';

        function updateScrollSnapState() {
            if (scrollSnapEnabled) {
                htmlElement.style.scrollSnapType = 'y mandatory';
                toggleButton.classList.remove('disabled');
                toggleButton.querySelector('.music-text').textContent = 'Scroll Snap';
            } else {
                htmlElement.style.scrollSnapType = 'none';
                toggleButton.classList.add('disabled');
                toggleButton.querySelector('.music-text').textContent = 'Scroll Snap Off';
            }
        }

        toggleButton.addEventListener('click', () => {
            scrollSnapEnabled = !scrollSnapEnabled;
            localStorage.setItem('scrollSnapEnabled', scrollSnapEnabled.toString());
            updateScrollSnapState();
        });

        updateScrollSnapState();
    }

    function initButtonFade() {
        const toggleContainer = document.getElementById('toggleContainer');
        const heroSection = document.querySelector('.hero');
        if (!toggleContainer || !heroSection) return;

        function checkScrollPosition() {
            const heroBottom = heroSection.offsetTop + heroSection.offsetHeight;
            const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;

            if (scrollPosition > heroBottom - 100) {
                toggleContainer.classList.add('faded');
            } else {
                toggleContainer.classList.remove('faded');
            }
        }

        window.addEventListener('scroll', checkScrollPosition, { passive: true });
        checkScrollPosition();
    }

    let mouseMoveThrottle = null;
    const handleMouseMove = () => {
        if (mouseMoveThrottle) return;
        mouseMoveThrottle = setTimeout(() => {
            resetAutoDemoTimer();
            mouseMoveThrottle = null;
        }, 1000);
    };

    document.addEventListener('scroll', resetAutoDemoTimer, { passive: true });
    document.addEventListener('click', resetAutoDemoTimer);
    document.addEventListener('touchstart', resetAutoDemoTimer, { passive: true });
    document.addEventListener('keydown', resetAutoDemoTimer);
    document.addEventListener('mousemove', handleMouseMove, { passive: true });

    initAutoScrollToggle();
    initScrollSnapToggle();
    initButtonFade();

    initURLHashUpdates();
    initShareButton();

    if (autoScrollEnabled) {
        resetAutoDemoTimer();
    }

});

function initURLHashUpdates() {
    const sections = document.querySelectorAll('section[id]');
    const heroSection = document.querySelector('.hero');
    let ticking = false;

    function updateHash() {
        if (ticking) return;
        ticking = true;

        requestAnimationFrame(() => {
            const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
            const windowHeight = window.innerHeight;
            const viewportTop = scrollPosition;
            const viewportBottom = scrollPosition + windowHeight;
            const viewportCenter = scrollPosition + (windowHeight / 2);

            if (heroSection) {
                const heroBottom = heroSection.offsetTop + heroSection.offsetHeight;
                if (scrollPosition < heroBottom - 100) {
                    if (window.location.hash) {
                        history.replaceState(null, null, window.location.pathname + window.location.search);
                    }
                    ticking = false;
                    return;
                }
            }

            let currentSection = null;
            let bestScore = -1;

            sections.forEach(section => {
                const rect = section.getBoundingClientRect();
                const sectionTop = section.offsetTop;
                const sectionBottom = sectionTop + section.offsetHeight;
                const sectionHeight = section.offsetHeight;
                const sectionCenter = sectionTop + (sectionHeight / 2);
                const isPartiallyVisible = rect.bottom > 0 && rect.top < windowHeight;

                if (!isPartiallyVisible) return;
                const visibleTop = Math.max(viewportTop, sectionTop);
                const visibleBottom = Math.min(viewportBottom, sectionBottom);
                const visibleHeight = Math.max(0, visibleBottom - visibleTop);
const visibility = sectionHeight > 0 ? visibleHeight / sectionHeight : 0;

                const centerDistance = Math.abs(viewportCenter - sectionCenter);
                const centerProximity = Math.max(0, 1 - (centerDistance / (windowHeight * 0.5)));

                const isShortSection = sectionHeight < windowHeight * 0.5;
                const score = isShortSection
                    ? centerProximity * 0.8 + visibility * 0.2
                    : visibility * 0.6 + centerProximity * 0.4;
                if (visibility > 0.2 || centerProximity > 0.5) {
                    if (score > bestScore) {
                        bestScore = score;
                        currentSection = section;
                    }
                }
            });

            if (currentSection && currentSection.id) {
                const newHash = '#' + currentSection.id;
                if (window.location.hash !== newHash) {
                    history.replaceState(null, null, newHash);
                }
            }

            ticking = false;
        });
    }


    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        scrollTimeout = setTimeout(updateHash, 50);
    }, { passive: true });


    updateHash();


    if (window.location.hash) {
        const targetSection = document.querySelector(window.location.hash);
        if (targetSection) {
            setTimeout(() => {
                targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 500);
        }
    }
}


function initShareButton() {
    const shareButton = document.getElementById('shareButton');
    if (!shareButton) return;

    shareButton.addEventListener('click', async () => {
        const currentHash = window.location.hash || '#home';
        const currentURL = window.location.origin + window.location.pathname + currentHash;

        try {

            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(currentURL);
            } else {

                const textArea = document.createElement('textarea');
                textArea.value = currentURL;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }


            const shareText = shareButton.querySelector('.share-text');
            const originalText = shareText.textContent;
            shareButton.classList.add('copied');
            shareText.textContent = 'Copied!';

            setTimeout(() => {
                shareButton.classList.remove('copied');
                shareText.textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy URL:', err);
            const shareText = shareButton.querySelector('.share-text');
            const originalText = shareText.textContent;
            shareText.textContent = 'Error';

            setTimeout(() => {
                shareText.textContent = originalText;
            }, 2000);
        }
    });
}
