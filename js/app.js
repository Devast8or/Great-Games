const SUPPORTED_SPORTS = new Set(['mlb', 'nba']);
const SPORT_STORAGE_KEY = 'great-games-sport';

const SPORT_CONTENT = {
    mlb: {
        title: 'MLB Great Games - Watch Without Spoilers',
        brandLogo: 'https://www.mlbstatic.com/team-logos/league-on-dark/1.svg',
        brandAlt: 'Major League Baseball',
        footerPrimary: 'MLB Great Games • Spoiler-free baseball viewing',
        footerSecondary: 'Data provided by MLB Stats API'
    },
    nba: {
        title: 'NBA Great Games - Watch Without Spoilers',
        brandLogo: 'https://cdn.nba.com/logos/leagues/logo-nba.svg',
        brandAlt: 'NBA Great Games',
        footerPrimary: 'NBA Great Games • Spoiler-free basketball viewing',
        footerSecondary: 'Data provided by NBA data providers'
    }
};

function resolveRequestedSport() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = (params.get('sport') || '').trim().toLowerCase();

    if (SUPPORTED_SPORTS.has(fromUrl)) {
        return fromUrl;
    }

    const fromStorage = (localStorage.getItem(SPORT_STORAGE_KEY) || '').trim().toLowerCase();
    if (SUPPORTED_SPORTS.has(fromStorage)) {
        return fromStorage;
    }

    return 'mlb';
}

function setSportInUrl(sport) {
    const url = new URL(window.location.href);

    if (sport === 'mlb') {
        url.searchParams.delete('sport');
    } else {
        url.searchParams.set('sport', sport);
    }

    window.location.assign(url.toString());
}

function updateSwitcherState(activeSport) {
    const buttons = Array.from(document.querySelectorAll('#sport-switcher .sport-switch-btn'));

    buttons.forEach((button) => {
        const sport = String(button.dataset.sport || '').toLowerCase();
        const isActive = sport === activeSport;

        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));

        button.addEventListener('click', () => {
            if (sport && sport !== activeSport && SUPPORTED_SPORTS.has(sport)) {
                localStorage.setItem(SPORT_STORAGE_KEY, sport);
                setSportInUrl(sport);
            }
        });
    });
}

function setToggleCopy(toggleId, nameText, descriptionText) {
    const input = document.getElementById(toggleId);
    const wrapper = input?.closest('.filter-toggle-wrapper');

    if (!wrapper) {
        return;
    }

    const name = wrapper.querySelector('.toggle-name');
    const description = wrapper.querySelector('.toggle-description');

    if (name) {
        name.textContent = nameText;
    }

    if (description) {
        description.textContent = descriptionText;
    }
}

function applyMlbFilterPresentation() {
    const openPeriodFilterButton = document.getElementById('open-period-filter');
    if (openPeriodFilterButton) {
        openPeriodFilterButton.classList.remove('hidden');
    }

    const periodFilterModal = document.getElementById('period-filter-modal');
    if (periodFilterModal) {
        periodFilterModal.classList.add('hidden');
    }

    const allToggleWrappers = document.querySelectorAll('.filters-modal .filter-toggle-wrapper');
    allToggleWrappers.forEach((wrapper) => {
        wrapper.classList.remove('hidden');
    });

    const categories = document.querySelectorAll('.filters-modal .filter-category');
    categories.forEach((category) => {
        category.classList.remove('hidden');
    });

    const categoryTitles = Array.from(document.querySelectorAll('.filters-modal .filter-category h4'));
    if (categoryTitles[0]) {
        categoryTitles[0].textContent = 'Game Dynamics';
    }
    if (categoryTitles[1]) {
        categoryTitles[1].textContent = 'Game Factors';
    }
    if (categoryTitles[2]) {
        categoryTitles[2].textContent = 'Statistical Factors';
    }

    setToggleCopy('close-games', 'Close Games', 'Narrow score gaps');
    setToggleCopy('lead-changes', 'Lead Changes', 'Momentum swings');
    setToggleCopy('comeback-wins', 'Comeback Wins', 'Deficit reversals');
    setToggleCopy('late-game-drama', 'Late Game Drama', 'Final innings tension');
    setToggleCopy('extra-innings', 'Extra Innings', 'Beyond regulation');
    setToggleCopy('high-scoring', 'High Scoring', 'Run-heavy games');
    setToggleCopy('team-rankings', 'Team Rankings', 'Contender matchups');
    setToggleCopy('rivalry-game', 'Rivalry Games', 'Historic intensity');
    setToggleCopy('total-hits', 'Total Hits', 'High-contact games');
    setToggleCopy('defensive-plays', 'Defensive Drama', 'Errors and chaos');
    setToggleCopy('scoring-distribution', 'Scoring Distribution', 'Runs across innings');
    setToggleCopy('player-milestones', 'Player Milestones', 'Notable performances');
    setToggleCopy('seasonal-context', 'Playoff Implications', 'Postseason pressure');
}

function applyNbaFilterPresentation() {
    const openPeriodFilterButton = document.getElementById('open-period-filter');
    if (openPeriodFilterButton) {
        openPeriodFilterButton.classList.remove('hidden');
        openPeriodFilterButton.setAttribute('aria-expanded', 'false');
    }

    const activePeriodFilterBadge = document.getElementById('active-period-filter');
    if (activePeriodFilterBadge) {
        activePeriodFilterBadge.classList.add('hidden');
    }

    const periodFilterModal = document.getElementById('period-filter-modal');
    if (periodFilterModal) {
        periodFilterModal.classList.add('hidden');
    }

    const enabledToggleIds = new Set([
        'close-games',
        'lead-changes',
        'extra-innings'
    ]);

    const allToggleWrappers = Array.from(document.querySelectorAll('.filters-modal .filter-toggle-wrapper'));
    allToggleWrappers.forEach((wrapper) => {
        const input = wrapper.querySelector('input.toggle-input');
        const shouldShow = input && enabledToggleIds.has(input.id);
        wrapper.classList.toggle('hidden', !shouldShow);
    });

    const categories = Array.from(document.querySelectorAll('.filters-modal .filter-category'));
    categories.forEach((category) => {
        const visibleToggleCount = category.querySelectorAll('.filter-toggle-wrapper:not(.hidden)').length;
        category.classList.toggle('hidden', visibleToggleCount === 0);
    });

    const categoryTitles = Array.from(document.querySelectorAll('.filters-modal .filter-category h4'));
    if (categoryTitles[0]) {
        categoryTitles[0].textContent = 'Core Excitement Signals';
    }
    if (categoryTitles[1]) {
        categoryTitles[1].textContent = 'NBA Game Context';
    }
    if (categoryTitles[2]) {
        categoryTitles[2].textContent = 'Performance Impact';
    }

    setToggleCopy('close-games', 'Finish Tension', 'How close the ending was');
    setToggleCopy('lead-changes', 'Momentum Swings', 'Lead changes, ties, and Q4 comebacks');
    setToggleCopy('extra-innings', 'Overtime Drama', 'Regulation plus extra periods');
}

function applyShellContent(activeSport) {
    const content = SPORT_CONTENT[activeSport] || SPORT_CONTENT.mlb;

    document.title = content.title;

    const brandLogo = document.getElementById('brand-logo');
    if (brandLogo) {
        brandLogo.src = content.brandLogo;
        brandLogo.alt = content.brandAlt;
    }

    const footerPrimary = document.getElementById('footer-primary');
    const footerSecondary = document.getElementById('footer-secondary');

    if (footerPrimary) {
        footerPrimary.textContent = content.footerPrimary;
    }

    if (footerSecondary) {
        footerSecondary.textContent = content.footerSecondary;
    }

    document.body.classList.remove('sport-mlb', 'sport-nba');
    document.body.classList.add(`sport-${activeSport}`);

    if (activeSport === 'nba') {
        applyNbaFilterPresentation();
    } else {
        applyMlbFilterPresentation();
    }
}

async function bootstrapSportApp(activeSport) {
    if (activeSport === 'nba') {
        const module = await import('./nba/app.js');
        if (typeof module.initNbaApp === 'function') {
            module.initNbaApp();
        }
        return;
    }

    const module = await import('./mlb/app.js');
    if (typeof module.initMlbApp === 'function') {
        module.initMlbApp();
    }
}

async function initShell() {
    const activeSport = resolveRequestedSport();
    localStorage.setItem(SPORT_STORAGE_KEY, activeSport);

    updateSwitcherState(activeSport);
    applyShellContent(activeSport);

    try {
        await bootstrapSportApp(activeSport);
    } catch (error) {
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.textContent = `Unable to initialize ${activeSport.toUpperCase()} mode: ${error.message || 'Unknown error'}`;
            errorMessage.classList.remove('hidden');
        }
        console.error('Sport bootstrap error:', error);
    }
}

void initShell();
