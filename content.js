(async function () {
    const config = await getConfig();
    const filter = new ContentFilter(config);
    filter.run();
})();

async function getConfig(forceNew, forceLocal, showElements) {
    const defaultConfig = {
        showElements: showElements,
        filters: [
            "Trump",
        ],
        websites: {
            "www.youtube.com": [
                "ytd-rich-item-renderer",
                "ytd-channel-video-player-renderer",
                "ytd-grid-video-renderer",
                "ytd-compact-video-renderer",
                "ytd-rich-grid-media",
                "ytd-video-renderer",
                "ytm-shorts-lockup-view-model-v2"
            ],
            "www.reddit.com": [
                "article",
                "li",
                "shreddit-comment",
                "shreddit-ad-post"
            ],
            "www.threads.net": [
                "div[data-pressable-container]"
            ],
            "www.facebook.com": [
                "div[data-virtualized]"
            ],
            "x.com": [
                "article"
            ],
        }
    };

    let config = { ...defaultConfig };

    const storedKeywords = await new Promise((resolve) => {
        chrome.storage.local.get(['keywords'], function (result) {
            resolve(result.keywords);
        });
    });

    if (storedKeywords) {
        config.filters = storedKeywords;
    }

    const revealCheckboxState = await new Promise((resolve) => {
        chrome.storage.local.get(['revealCheckboxState'], function (result) {
            resolve(result.revealCheckboxState);
        });
    });

    if (typeof revealCheckboxState !== 'undefined') {
        config.showElements = revealCheckboxState;
    }

    if (forceLocal) {
        console.log('- WARNING: Using local config -');
        return config;
    }

    try {
        const cacheKey = 'cachedWebsites';
        const cacheTimestampKey = 'cacheTimestamp';
        const expiry = 1 * 60 * 60 * 1000;

        const { cachedWebsites, cacheTimestamp } = await new Promise((resolve) => {
            chrome.storage.local.get([cacheKey, cacheTimestampKey], function (result) {
                resolve({
                    cachedWebsites: result[cacheKey],
                    cacheTimestamp: result[cacheTimestampKey]
                });
            });
        });

        const now = new Date().getTime();

        if (cachedWebsites && cacheTimestamp && (now - cacheTimestamp < expiry) && !forceNew) {
            config.websites = JSON.parse(cachedWebsites);
            console.log('Using cached websites:', config);
        } else {
            // Fetches config daily to stay updated with website changes without updating the extension.
            const response = await fetch('https://www.yourefi.red/api/config.json');
            const configRes = await response.json();
            chrome.storage.local.set({
                [cacheKey]: JSON.stringify(configRes.websites),
                [cacheTimestampKey]: now.toString()
            });
            config.websites = configRes.websites;
            console.log('Fetching websites:', config);
        }

        return config;

    } catch (error) {
        console.error('Error fetching config:', error);
    }
}

class ContentFilter {
    constructor(config) {
        this.config = config;
        this.targetSelectors = this.config.websites[window.location.hostname] || false;
    }

    run() {
        if (!this.targetSelectors)
            return;

        this.findElements();
        this.observeMutations();
    }

    findElements() {
        const elements = document.querySelectorAll(this.targetSelectors.join(','));
        this.filterNodes(elements);
    }

    observeMutations() {
        if (document.body) {
            const observer = new MutationObserver(this.handleMutations);

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
            });
        }
    }

    parseTextContent = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent.trim();
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            return Array.from(node.childNodes)
                .map(this.parseTextContent)
                .filter(Boolean)
                .join(' ');
        }
        return '';
    }

    filterNodes(elements) {
        elements.forEach(element => {
            this.config.filters.forEach(filter => {
                const variations = [filter.toLowerCase(), `${filter.toLowerCase()}'s`, `${filter.toLowerCase()}s`];
                const regex = new RegExp(`\\b(${variations.join('|')})\\b`, 'i');
                const textContents = this.parseTextContent(element);

                if (regex.test(textContents.toLowerCase())) {
                    //console.log(`Found filter "${filter}" in element:`, element);

                    if (this.config.showElements) {
                        element.style.border = '2px solid red';
                        element.style.opacity = '0.5';
                    } else {
                        element.remove();
                    }
                }
            });
        });
    }

    handleMutations = (mutationsList, observer) => {
        for (const mutation of mutationsList) {
            let matchingNodes = new Set();

            if (mutation.type === 'attributes') {
                if (this.targetSelectors.some(selector => mutation.target.matches(selector))) {
                    matchingNodes.add(mutation.target);
                }
            }

            if ((mutation.type === 'childList') && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(addedNode => {
                    if (addedNode.nodeType === Node.ELEMENT_NODE) {
                        if (addedNode.matches && this.targetSelectors.some(selector => addedNode.matches(selector))) {
                            matchingNodes.add(addedNode);
                        }

                        this.targetSelectors.forEach(selector => {
                            addedNode.querySelectorAll(selector).forEach(el => matchingNodes.add(el));
                        });
                    }
                });
            }

            matchingNodes = Array.from(matchingNodes);

            if (matchingNodes.length > 0) {
                this.filterNodes(matchingNodes);
            }
        }
    }

    // Not used atm
    checkImagesForFilters(images, filters) {
        images.forEach(img => {
            const altText = img.alt.toLowerCase();
            const src = img.src.toLowerCase();
            filters.forEach(filter => {
                if (altText.includes(filter) || src.includes(filter)) {
                    img.style.opacity = ''; // or any other action you want to take
                    img.style.backgroundColor = '#FA8072';
                }
            });
        });
    }
}