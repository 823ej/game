function showCityObjectTooltip(text, anchorEl, x, y) {
    if (!text) return;
    if (!anchorEl && !(Number.isFinite(x) && Number.isFinite(y))) return;
    let tip = document.getElementById('city-object-tooltip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'city-object-tooltip';
        tip.className = 'city-object-tooltip';
        document.body.appendChild(tip);
    }
    tip.textContent = String(text);
    tip.style.display = 'block';
    tip.style.visibility = 'visible';
    if (!window.game) window.game = {};
    game.cityTooltipAnchor = anchorEl || null;
    game.cityTooltipPoint = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    requestAnimationFrame(() => positionCityObjectTooltip(tip));
    scheduleCityTooltipReposition();

    const dismiss = (ev) => {
        if (ev?.target === tip) return;
        tip.style.display = 'none';
        document.removeEventListener('mousedown', dismiss, true);
        document.removeEventListener('touchstart', dismiss, true);
    };
    document.addEventListener('mousedown', dismiss, true);
    document.addEventListener('touchstart', dismiss, true);
}

function hideCityObjectTooltip() {
    const tip = document.getElementById('city-object-tooltip');
    if (!tip) return;
    tip.style.display = 'none';
    game.cityTooltipAnchor = null;
    game.cityTooltipPoint = null;
    if (game.cityTooltipFollowFrame) {
        cancelAnimationFrame(game.cityTooltipFollowFrame);
        game.cityTooltipFollowFrame = null;
    }
}

function scheduleCityTooltipReposition() {
    if (game.cityTooltipRepositionTimer) {
        clearTimeout(game.cityTooltipRepositionTimer);
    }
    game.cityTooltipRepositionTimer = setTimeout(() => {
        positionCityObjectTooltip();
        game.cityTooltipRepositionTimer = null;
    }, 360);
    startCityTooltipFollow(420);
}

function startCityTooltipFollow(durationMs = 420) {
    const start = performance.now();
    const step = (now) => {
        positionCityObjectTooltip();
        if (now - start < durationMs) {
            game.cityTooltipFollowFrame = requestAnimationFrame(step);
        } else {
            game.cityTooltipFollowFrame = null;
        }
    };
    if (game.cityTooltipFollowFrame) cancelAnimationFrame(game.cityTooltipFollowFrame);
    game.cityTooltipFollowFrame = requestAnimationFrame(step);
}

function positionCityObjectTooltip(tipEl) {
    const tip = tipEl || document.getElementById('city-object-tooltip');
    if (!tip || tip.style.display === 'none') return;
    const padding = 14;
    let baseX = window.innerWidth / 2;
    let baseY = window.innerHeight / 2;
    const anchor = game.cityTooltipAnchor;
    if (anchor && typeof anchor.getBoundingClientRect === 'function') {
        const rect = anchor.getBoundingClientRect();
        baseX = rect.right;
        baseY = rect.bottom;
    } else if (game.cityTooltipPoint) {
        baseX = game.cityTooltipPoint.x;
        baseY = game.cityTooltipPoint.y;
    }
    const rect = tip.getBoundingClientRect();
    let left = baseX + 16;
    let top = baseY + 16;
    if (left + rect.width + padding > window.innerWidth) left = window.innerWidth - rect.width - padding;
    if (top + rect.height + padding > window.innerHeight) top = window.innerHeight - rect.height - padding;
    if (left < padding) left = padding;
    if (top < padding) top = padding;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
}

function applyCityZoom(zoomEl, anchorEl, storeKey) {
    if (!zoomEl || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const mapRect = zoomEl.getBoundingClientRect();
    const mode = storeKey === 'map' ? 'map' : 'area';
    const panelWidth = (mode === 'map')
        ? (document.getElementById('city-detail-panel')?.getBoundingClientRect().width || 360)
        : (document.querySelector('#city-area-mode .city-detail-panel')?.getBoundingClientRect().width || 360);
    const anchorCenterX = rect.left + rect.width / 2;
    const panelBias = Math.min(420, panelWidth * 1.1);
    const targetCenterX = mapRect.left + (mapRect.width - panelWidth) / 2 - panelBias;
    const anchorCenterY = rect.top + rect.height / 2;
    const targetCenterY = mapRect.top + mapRect.height / 2;
    const dx = (anchorCenterX - targetCenterX);
    const dy = (anchorCenterY - targetCenterY);
    const originX = ((anchorCenterX + dx - mapRect.left) / Math.max(1, mapRect.width)) * 100;
    const originY = ((anchorCenterY + dy - mapRect.top) / Math.max(1, mapRect.height)) * 100;
    zoomEl.style.setProperty('--city-map-origin-x', `${originX}%`);
    zoomEl.style.setProperty('--city-map-origin-y', `${originY}%`);
    const prevZoom = parseFloat(getComputedStyle(zoomEl).getPropertyValue('--city-map-zoom')) || 1;
    zoomEl.style.setProperty('--city-map-zoom', '1.02');
    zoomEl.classList.add('is-zoomed');
    requestAnimationFrame(() => {
        const nextZoom = prevZoom > 1.02 ? 1.15 : 1.15;
        zoomEl.style.setProperty('--city-map-zoom', String(nextZoom));
        if (storeKey === 'area') {
            if (!window.game) window.game = {};
            if (!game.cityArea) game.cityArea = {};
            game.cityArea.lastZoom = {
                originX: `${originX}%`,
                originY: `${originY}%`,
                scale: nextZoom
            };
        } else if (storeKey === 'map') {
            if (!window.game) window.game = {};
            game.cityMapZoom = {
                originX: `${originX}%`,
                originY: `${originY}%`,
                scale: nextZoom
            };
        }
    });
}

function setCityMapZoom(anchorEl) {
    const mapEl = document.getElementById('city-area-map');
    const zoomEl = mapEl ? mapEl.querySelector('.city-area-zoom') : null;
    applyCityZoom(zoomEl, anchorEl, 'area');
}

function setCityWorldMapZoom(anchorEl) {
    const mapEl = document.getElementById('city-map');
    const zoomEl = mapEl ? mapEl.querySelector('.city-map-zoom') : null;
    applyCityZoom(zoomEl, anchorEl, 'map');
}

function resetCityZoom(mode) {
    if (mode === 'map') {
        const mapEl = document.getElementById('city-map');
        const zoomEl = mapEl ? mapEl.querySelector('.city-map-zoom') : null;
        if (zoomEl) {
            zoomEl.style.setProperty('--city-map-zoom', '1');
            zoomEl.classList.remove('is-zoomed');
        }
        if (window.game) game.cityMapZoom = null;
        return;
    }
    if (mode === 'area') {
        const mapEl = document.getElementById('city-area-map');
        const zoomEl = mapEl ? mapEl.querySelector('.city-area-zoom') : null;
        if (zoomEl) {
            zoomEl.style.setProperty('--city-map-zoom', '1');
            zoomEl.classList.remove('is-zoomed');
        }
        if (window.game && game.cityArea) game.cityArea.lastZoom = null;
    }
}

function openCityNarrationPanel(mode, anchorEl) {
    if (mode !== 'map' && mode !== 'area') return;
    if (typeof setCityPanelVisible === 'function') {
        setCityPanelVisible(mode, true);
    }
    if (anchorEl) {
        if (mode === 'map' && typeof setCityWorldMapZoom === 'function') {
            setCityWorldMapZoom(anchorEl);
        }
        if (mode === 'area' && typeof setCityMapZoom === 'function') {
            setCityMapZoom(anchorEl);
        }
    }
    scheduleCityNarrationClose(mode);
}

function scheduleCityNarrationClose(mode, delayMs = 1800) {
    if (game.cityNarrationCloseTimer) {
        clearTimeout(game.cityNarrationCloseTimer);
    }
    game.cityNarrationCloseTimer = setTimeout(() => {
        closeCityNarrationPanel(mode);
        game.cityNarrationCloseTimer = null;
    }, delayMs);
}

function closeCityNarrationPanel(mode) {
    if (mode !== 'map' && mode !== 'area') return;
    if (typeof setCityPanelVisible === 'function') {
        setCityPanelVisible(mode, false);
    }
    resetCityZoom(mode);
    if (game.cityNarrationCloseTimer) {
        clearTimeout(game.cityNarrationCloseTimer);
        game.cityNarrationCloseTimer = null;
    }
}

function closeAllCityNarrationPanels() {
    closeCityNarrationPanel('map');
    closeCityNarrationPanel('area');
    if (typeof setCityPanelVisible === 'function') {
        setCityPanelVisible('map', false);
        setCityPanelVisible('area', false);
    }
    if (game.cityNarrationCloseTimer) {
        clearTimeout(game.cityNarrationCloseTimer);
        game.cityNarrationCloseTimer = null;
    }
}
