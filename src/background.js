/*
Get Started
https://developer.chrome.com/docs/extensions/mv3/getstarted/
Storage API docs
https://developer.chrome.com/docs/extensions/reference/storage/
Tabs API docs
https://developer.chrome.com/docs/extensions/reference/tabs/
Windows API docs
https://developer.chrome.com/docs/extensions/reference/windows/
 */


const TABS = 'tabs';
const TABS_LIMIT = 10;

const _invoke = (callback) => {
    if (typeof callback !== 'undefined') {
        callback();
    }
};

class Tabs {
    constructor() {
        this._data = {};
    }

    static async restore() {
        const tabs = new this();
        tabs._data = await tabs._restore();
        return tabs;
    }

    static async getActiveTab() {
        return new Promise(resolve => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                resolve(tabs[0]);
            });
        });
    }

    getAll() {
        return this._data;
    }

    get(windowId) {
        return this._data[windowId] || [];
    }

    async setAll(allTabs, persist = true) {
        this._data = allTabs;
        if (persist) {
            await this._persist();
        }
    }

    async set(windowId, tabs, persist = true) {
        this._data[windowId] = tabs;
        if (persist) {
            await this._persist();
        }
    }

    async pushRecentTab(windowId, tabId, persist = true) {
        let tabs = this._data[windowId];
        if (typeof tabs === 'undefined') {
            tabs = this._data[windowId] = [];
        }
        if (tabs.length === TABS_LIMIT) {
            tabs.shift();
        }
        tabs.push(tabId);
        if (persist) {
            await this._persist();
        }
    }

    async switchToMostRecentTab(activeWindowId, activeTabId) {
        const mostRecentTabId = await this._findMostRecentTab(activeWindowId, activeTabId);
        if (mostRecentTabId != null) {
            await this._activateTab(mostRecentTabId);
            this._data[activeWindowId].push(activeTabId);
        }
        await this._persist();
    }

    async forgetTabs(windowId) {
        delete this._data[windowId];
        await this._persist();
    }

    _activateTab(tabId) {
        return new Promise(resolve => {
            chrome.tabs.update(tabId, {active: true}, resolve);
        });
    }

    _doesTabExists(tabId) {
        return new Promise(resolve => {
            chrome.tabs.get(tabId, (tab) => {
                resolve(tab != null);
            });
        });
    };

    async _findMostRecentTab(windowId, activeTabId) {
        const tabs = this.get(windowId);
        if (tabs.length < 2) {
            return null;
        }
        let tabId = 0;
        while (tabs.length > 0) {
            tabId = tabs.pop();
            if (tabId === activeTabId) {
                continue;
            }
            if (await this._doesTabExists(tabId)) {
                return tabId;
            }
        }
        return null;
    }

    _persist(callback) {
        return new Promise(resolve => {
            chrome.storage.local.set({[TABS]: this._data}, () => {
                _invoke(callback);
                resolve();
            });
        });
    }

    _restore() {
        return new Promise((resolve) => {
            chrome.storage.local.get(TABS, ({tabs}) => {
                resolve(tabs || {});
            })
        });
    }
}

const onInstalled = async (details) => {
    const {reason} = details;

    console.log('onInstalled', details);

    if (reason !== 'install' && reason !== 'update') {
        return;
    }
    console.log('tabs before onInstalled', await Tabs.restore());
    const tabs = await Tabs.restore();
    const activeTab = await Tabs.getActiveTab();
    if (activeTab != null) {
        await tabs.pushRecentTab(activeTab.windowId, activeTab.id);
    }
    console.log('tabs after onInstalled', await Tabs.restore());
};


const onNewShortcut = async (command, tab) => {
    console.log('tabs before onNewShortcut', await Tabs.restore());
    const tabs = await Tabs.restore();
    await tabs.switchToMostRecentTab(tab.windowId, tab.id);
    console.log('tabs after onNewShortcut', await Tabs.restore());
};


const onNewTabActivated = async (activeInfo) => {
    console.log('tabs before onNewTabActivated', await Tabs.restore());
    const tabs = await Tabs.restore();
    const {windowId, tabId} = activeInfo;
    await tabs.pushRecentTab(windowId, tabId);
    console.log('tabs after onNewTabActivated', await Tabs.restore());
};


const onWindowClosed = async (windowId) => {
    console.log('tabs before onWindowClosed', await Tabs.restore());
    const tabs = await Tabs.restore();
    await tabs.forgetTabs(windowId);
    console.log('tabs after onWindowClosed', await Tabs.restore());
};


chrome.runtime.onInstalled.addListener(onInstalled);
chrome.commands.onCommand.addListener(onNewShortcut);
chrome.tabs.onActivated.addListener(onNewTabActivated);
chrome.windows.onRemoved.addListener(onWindowClosed);
