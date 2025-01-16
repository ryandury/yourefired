(async () => {
    const config = await getConfig(true, true);
    const contentFilter = new ContentFilter(config);
    contentFilter.run();
})();

async function getConfig(forceNew, forceLocal) {
    const defaultConfig = {
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
                "shreddit-comment"
            ],
            "x.com": [
                'article',
            ],

        }
    };

    let config = { ...defaultConfig };

    const storedKeywords = await new Promise((resolve) => {
        chrome.storage.local.get(['keywords'], function(result) {
            resolve(result.keywords);
        });
    });
    
    if (storedKeywords) {
        config.filters = storedKeywords;
    }

    if (forceLocal) {
        return config;
    }

    try {
        const cacheKey = 'cachedWebsites';
        const cacheTimestampKey = 'cacheTimestamp';
        const expiry = 12 * 60 * 60 * 1000;

        const { cachedWebsites, cacheTimestamp } = await new Promise((resolve) => {
            chrome.storage.local.get([cacheKey, cacheTimestampKey], function(result) {
                resolve({
                    cachedWebsites: result[cacheKey],
                    cacheTimestamp: result[cacheTimestampKey]
                });
            });
        });

        const now = new Date().getTime();

        if (cachedWebsites && cacheTimestamp && (now - cacheTimestamp < expiry) && !forceNew) {
            config.websites = JSON.parse(cachedWebsites);
            //console.log('Using cached websites:', config);
        } else {
            // Fetches config daily to stay updated with website changes without updating the extension.
            const response = await fetch('https://www.yourefi.red/api/config.json');
            const configRes = await response.json();
            chrome.storage.local.set({
                [cacheKey]: JSON.stringify(configRes.websites),
                [cacheTimestampKey]: now.toString()
            });
            config.websites = configRes.websites;
            //console.log('Fetching websites:', config);
        }

        return config;

    } catch (error) {
        console.error('Error fetching config:', error);
    }
}


class ContentFilter {
    constructor(config) {
        this.config = config;
        this.initializeStorage();
        this.mutationCount = 0;
        this.elements = this.config.websites[window.location.hostname] || false;
    }

    initializeStorage() {
        if (!localStorage.getItem('removalCount')) {
            localStorage.setItem('removalCount', '0');
        }
        localStorage.setItem('removalCount', '0');
    }

    incrementRemovalCount() {
        let count = parseInt(localStorage.getItem('removalCount'), 10);
        count = isNaN(count) ? 0 : count + 1;
        localStorage.setItem('removalCount', count.toString());
    }

    getTotalCount() {
        let count = parseInt(localStorage.getItem('removalCount'), 10);
        return isNaN(count) ? 0 : count;
    }

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

    run() {
        if (!this.elements) 
            return;

        this.findElements();
        this.observeMutations();
    }

    findElements() {
        const elements = document.querySelectorAll(this.elements.join(','));
        this.filterElements(elements);
    }

    filterElements(elements) {
        elements.forEach(element => {
            this.config.filters.forEach(filter => {
            const variations = [filter.toLowerCase(), `${filter.toLowerCase()}'s`, `${filter.toLowerCase()}s`];
            const regex = new RegExp(`\\b(${variations.join('|')})\\b`, 'i');
            if (regex.test(element.textContent.toLowerCase())) {
                //console.log(`Found filter "${filter}" in element:`, element);
                //element.style.opacity = '0.2';
                element.remove();
            }
            });
        });
    }

    observeMutations() {
        if (document.body) {
            const observer = new MutationObserver(this.observerCallback);

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    observerCallback = (mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
    
                        if (node.shadowRoot) {
                            const shadowObserver = new MutationObserver(this.observerCallback);
                            shadowObserver.observe(node.shadowRoot, {
                                childList: true,
                                subtree: true
                            });
                        }
    
                        let elements = [];
    
                        if (node.matches && this.elements.some(selector => node.matches(selector))) {
                            elements.push(node);
                        }
    
                        this.elements.forEach(selector => {
                            elements.push(...node.querySelectorAll(selector));
                        });
    
                        this.filterElements(elements);
                    }
                });
            }
        }
    }

}