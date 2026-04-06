(function () {
    const STORAGE_KEYS = Object.freeze({
        users: "nuowu_users_v2",
        currentUser: "nuowu_current_user_v2",
        works: "nuowu_works_v2"
    });

    function readJSON(key, fallbackValue) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallbackValue;
        } catch (error) {
            return fallbackValue;
        }
    }

    function writeJSON(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function safeText(value) {
        return String(value || "").trim();
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function createWorkId() {
        return `work_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function fallbackTitle(prompt) {
        const text = safeText(prompt);
        if (!text) {
            return "未命名傩作";
        }
        return text.length > 18 ? `${text.slice(0, 18)}...` : text;
    }

    function normalizeWork(work) {
        const createdAt = work.createdAt || work.time || nowIso();
        const updatedAt = work.updatedAt || createdAt;
        const prompt = safeText(work.prompt);
        return {
            id: String(work.id || createWorkId()),
            username: safeText(work.username),
            title: safeText(work.title) || fallbackTitle(prompt),
            img: safeText(work.img),
            prompt,
            source: safeText(work.source) || (prompt ? "ai" : "manual"),
            createdAt,
            updatedAt,
            width: Number(work.width) || 1200,
            height: Number(work.height) || 720
        };
    }

    function migrateLegacyStorage() {
        if (window.__NUOWU_MIGRATED__) {
            return;
        }

        const legacyUser = readJSON("nuowu_user", null);
        const legacyWorks = readJSON("nuowu_works", null);

        if (!localStorage.getItem(STORAGE_KEYS.users) && legacyUser && legacyUser.username) {
            writeJSON(STORAGE_KEYS.users, [legacyUser]);
        }

        if (!localStorage.getItem(STORAGE_KEYS.currentUser) && legacyUser && legacyUser.username) {
            localStorage.setItem(STORAGE_KEYS.currentUser, legacyUser.username);
        }

        if (!localStorage.getItem(STORAGE_KEYS.works) && Array.isArray(legacyWorks)) {
            writeJSON(STORAGE_KEYS.works, legacyWorks.map(normalizeWork));
        }

        window.__NUOWU_MIGRATED__ = true;
    }

    function getUsers() {
        migrateLegacyStorage();
        const users = readJSON(STORAGE_KEYS.users, []);
        return Array.isArray(users) ? users.filter((item) => item && item.username) : [];
    }

    function saveUsers(users) {
        writeJSON(STORAGE_KEYS.users, users);
    }

    function findUser(username) {
        const cleanUsername = safeText(username);
        return getUsers().find((item) => item.username === cleanUsername) || null;
    }

    function setCurrentUser(user) {
        if (!user || !user.username) {
            return;
        }
        localStorage.setItem(STORAGE_KEYS.currentUser, user.username);
        localStorage.setItem("nuowu_user", JSON.stringify(user));
    }

    function getCurrentUser() {
        migrateLegacyStorage();
        const username = localStorage.getItem(STORAGE_KEYS.currentUser);
        return username ? findUser(username) : null;
    }

    function registerLocalUser(username, password) {
        const cleanUsername = safeText(username);
        const cleanPassword = safeText(password);

        if (!cleanUsername || !cleanPassword) {
            throw new Error("请完整填写用户名和密码。");
        }

        const users = getUsers();
        if (users.some((item) => item.username === cleanUsername)) {
            throw new Error("该用户名已存在，请直接登录。");
        }

        const user = {
            username: cleanUsername,
            password: cleanPassword,
            createdAt: nowIso(),
            storageMode: "local-sync-code"
        };

        users.push(user);
        saveUsers(users);
        setCurrentUser(user);
        return user;
    }

    function loginLocalUser(username, password) {
        const cleanUsername = safeText(username);
        const cleanPassword = safeText(password);
        const user = findUser(cleanUsername);

        if (!user) {
            throw new Error("账号不存在，请先注册或导入同步码。");
        }

        if (safeText(user.password) !== cleanPassword) {
            throw new Error("用户名或密码不正确。");
        }

        setCurrentUser(user);
        return user;
    }

    function logoutCurrentUser() {
        localStorage.removeItem(STORAGE_KEYS.currentUser);
        localStorage.removeItem("nuowu_user");
    }

    function getAllWorks() {
        migrateLegacyStorage();
        const works = readJSON(STORAGE_KEYS.works, []);
        if (!Array.isArray(works)) {
            return [];
        }
        return works.map(normalizeWork).filter((item) => item.username && item.img);
    }

    function saveAllWorks(works) {
        const normalized = works.map(normalizeWork);
        writeJSON(STORAGE_KEYS.works, normalized);
        localStorage.setItem("nuowu_works", JSON.stringify(normalized));
    }

    function getWorkById(workId) {
        const targetId = String(workId || "");
        return getAllWorks().find((item) => item.id === targetId) || null;
    }

    function getUserWorks(username) {
        const cleanUsername = safeText(username);
        return getAllWorks()
            .filter((item) => item.username === cleanUsername)
            .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
    }

    function upsertWork(work) {
        const normalized = normalizeWork(work);
        const works = getAllWorks();
        const index = works.findIndex((item) => item.id === normalized.id);
        if (index >= 0) {
            works[index] = {
                ...works[index],
                ...normalized,
                updatedAt: nowIso()
            };
        } else {
            works.unshift({
                ...normalized,
                id: normalized.id || createWorkId(),
                createdAt: normalized.createdAt || nowIso(),
                updatedAt: nowIso()
            });
        }
        saveAllWorks(works);
        return normalized;
    }

    function deleteWork(workId) {
        const targetId = String(workId || "");
        const works = getAllWorks().filter((item) => item.id !== targetId);
        saveAllWorks(works);
    }

    function formatDisplayDate(value) {
        const date = value ? new Date(value) : new Date();
        if (Number.isNaN(date.getTime())) {
            return "";
        }
        return new Intl.DateTimeFormat("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    }

    function encodeBase64(text) {
        const bytes = new TextEncoder().encode(text);
        let binary = "";
        bytes.forEach((value) => {
            binary += String.fromCharCode(value);
        });
        return btoa(binary);
    }

    function decodeBase64(text) {
        const binary = atob(text);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    }

    function buildSyncPack(username) {
        const user = findUser(username);
        if (!user) {
            throw new Error("当前没有可导出的账号信息。");
        }

        const payload = {
            version: 1,
            exportedAt: nowIso(),
            user,
            works: getUserWorks(username)
        };

        return encodeBase64(JSON.stringify(payload));
    }

    function importSyncPack(syncCode) {
        const raw = decodeBase64(safeText(syncCode));
        const payload = JSON.parse(raw);

        if (!payload || !payload.user || !payload.user.username) {
            throw new Error("同步码内容不完整，请检查后重试。");
        }

        const users = getUsers();
        const userIndex = users.findIndex((item) => item.username === payload.user.username);
        if (userIndex >= 0) {
            users[userIndex] = payload.user;
        } else {
            users.push(payload.user);
        }
        saveUsers(users);

        const works = getAllWorks();
        const merged = Array.isArray(payload.works) ? payload.works.map(normalizeWork) : [];
        merged.forEach((item) => {
            const existingIndex = works.findIndex((work) => work.id === item.id);
            if (existingIndex >= 0) {
                works[existingIndex] = item;
            } else {
                works.push(item);
            }
        });
        saveAllWorks(works);

        setCurrentUser(payload.user);
        return payload;
    }

    function downloadDataUrl(dataUrl, filename) {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        return Promise.resolve();
    }

    function ensureAuth(options) {
        const config = {
            message: "请先登录后再继续。",
            redirect: "login.html",
            ...(options || {})
        };

        const user = getCurrentUser();
        if (!user) {
            if (config.message) {
                alert(config.message);
            }
            window.location.href = config.redirect;
            return null;
        }
        return user;
    }

    function updateHeaderState() {
        const currentUser = getCurrentUser();
        const currentPage = document.body.dataset.page || "";

        document.querySelectorAll("[data-nav]").forEach((item) => {
            item.classList.toggle("active", item.dataset.nav === currentPage);
        });

        document.querySelectorAll("[data-user-link]").forEach((item) => {
            if (currentUser) {
                item.textContent = `${currentUser.username} / 作品库`;
                item.href = "works.html";
                item.classList.toggle("active", currentPage === "works");
            } else {
                item.textContent = "登录 / 注册";
                item.href = "login.html";
                item.classList.toggle("active", currentPage === "login");
            }
        });

        document.querySelectorAll("[data-logout-link]").forEach((item) => {
            item.classList.toggle("hidden", !currentUser);
        });
    }

    function bindLogoutEvents() {
        document.querySelectorAll("[data-logout-link]").forEach((item) => {
            item.addEventListener("click", () => {
                logoutCurrentUser();
                updateHeaderState();
                alert("已退出当前账号。");
                window.location.href = "index.html";
            });
        });
    }

    function initSite() {
        migrateLegacyStorage();
        updateHeaderState();
        bindLogoutEvents();
    }

    window.NuowuApp = {
        STORAGE_KEYS,
        safeText,
        createWorkId,
        getUsers,
        getCurrentUser,
        registerLocalUser,
        loginLocalUser,
        logoutCurrentUser,
        getAllWorks,
        getUserWorks,
        getWorkById,
        upsertWork,
        deleteWork,
        formatDisplayDate,
        buildSyncPack,
        importSyncPack,
        downloadDataUrl,
        copyText,
        ensureAuth,
        initSite,
        updateHeaderState
    };

    document.addEventListener("DOMContentLoaded", initSite);
})();
