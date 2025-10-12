const fs = require('fs');
const path = require('path');

class DatabaseManager {
    constructor() {
        this.dbPath = path.join(__dirname, 'database.json');
        this.initDatabase();
    }

    // Инициализация базы данных
    initDatabase() {
        if (!fs.existsSync(this.dbPath)) {
            const initialData = {
                views: {},
                bookmarks: {},
                userSessions: {},
                popularScripts: [],
                lastUpdated: new Date().toISOString(),
                statistics: {
                    totalViews: 0,
                    totalSessions: 0,
                    mostViewedScript: null,
                    dailyViews: {}
                }
            };
            this.saveDatabase(initialData);
            console.log('Database initialized');
        }
    }

    // Загрузка базы данных
    loadDatabase() {
        try {
            const data = fs.readFileSync(this.dbPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading database:', error);
            return this.getDefaultDatabase();
        }
    }

    // Сохранение базы данных
    saveDatabase(data) {
        try {
            data.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving database:', error);
            return false;
        }
    }

    // Получение дефолтной структуры БД
    getDefaultDatabase() {
        return {
            views: {},
            bookmarks: {},
            userSessions: {},
            popularScripts: [],
            lastUpdated: new Date().toISOString(),
            statistics: {
                totalViews: 0,
                totalSessions: 0,
                mostViewedScript: null,
                dailyViews: {}
            }
        };
    }

    // Увеличение счетчика просмотров
    incrementViews(scriptId) {
        const db = this.loadDatabase();
        
        if (!db.views[scriptId]) {
            db.views[scriptId] = 0;
        }
        
        db.views[scriptId]++;
        
        // Обновление общей статистики
        db.statistics.totalViews++;
        
        // Обновление ежедневной статистики
        const today = new Date().toDateString();
        if (!db.statistics.dailyViews[today]) {
            db.statistics.dailyViews[today] = 0;
        }
        db.statistics.dailyViews[today]++;
        
        // Обновление самого популярного скрипта
        this.updateMostViewedScript(db);
        
        // Обновление списка популярных скриптов
        this.updatePopularScripts(db);
        
        return this.saveDatabase(db) ? db.views[scriptId] : null;
    }

    // Обновление самого просматриваемого скрипта
    updateMostViewedScript(db) {
        let maxViews = 0;
        let mostViewed = null;
        
        for (const [scriptId, views] of Object.entries(db.views)) {
            if (views > maxViews) {
                maxViews = views;
                mostViewed = { scriptId: parseInt(scriptId), views };
            }
        }
        
        db.statistics.mostViewedScript = mostViewed;
    }

    // Обновление списка популярных скриптов
    updatePopularScripts(db) {
        const scripts = Object.entries(db.views)
            .map(([scriptId, views]) => ({
                scriptId: parseInt(scriptId),
                views: views
            }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 10); // Топ 10
        
        db.popularScripts = scripts;
    }

    // Добавление/удаление закладки
    toggleBookmark(userId, scriptId) {
        const db = this.loadDatabase();
        
        if (!db.bookmarks[userId]) {
            db.bookmarks[userId] = [];
        }
        
        const bookmarks = db.bookmarks[userId];
        const index = bookmarks.indexOf(scriptId);
        
        if (index > -1) {
            // Удаление из закладок
            bookmarks.splice(index, 1);
        } else {
            // Добавление в закладки
            bookmarks.push(scriptId);
        }
        
        return this.saveDatabase(db) ? db.bookmarks[userId] : null;
    }

    // Получение закладок пользователя
    getUserBookmarks(userId) {
        const db = this.loadDatabase();
        return db.bookmarks[userId] || [];
    }

    // Регистрация пользовательской сессии
    registerUserSession(sessionId, userData = {}) {
        const db = this.loadDatabase();
        
        db.userSessions[sessionId] = {
            ...userData,
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            viewCount: 0
        };
        
        db.statistics.totalSessions++;
        
        return this.saveDatabase(db);
    }

    // Обновление активности сессии
    updateSessionActivity(sessionId) {
        const db = this.loadDatabase();
        
        if (db.userSessions[sessionId]) {
            db.userSessions[sessionId].lastActivity = new Date().toISOString();
            db.userSessions[sessionId].viewCount++;
            return this.saveDatabase(db);
        }
        
        return false;
    }

    // Получение статистики по скрипту
    getScriptStats(scriptId) {
        const db = this.loadDatabase();
        
        return {
            views: db.views[scriptId] || 0,
            isPopular: db.popularScripts.some(s => s.scriptId === parseInt(scriptId))
        };
    }

    // Получение общей статистики
    getGlobalStats() {
        const db = this.loadDatabase();
        
        return {
            totalScripts: Object.keys(db.views).length,
            totalViews: db.statistics.totalViews,
            totalSessions: db.statistics.totalSessions,
            mostViewedScript: db.statistics.mostViewedScript,
            popularScripts: db.popularScripts,
            dailyViews: db.statistics.dailyViews
        };
    }

    // Очистка старых сессий (более 24 часов)
    cleanupOldSessions() {
        const db = this.loadDatabase();
        const now = new Date();
        const dayInMs = 24 * 60 * 60 * 1000;
        
        let cleanedCount = 0;
        
        for (const [sessionId, session] of Object.entries(db.userSessions)) {
            const lastActivity = new Date(session.lastActivity);
            if (now - lastActivity > dayInMs) {
                delete db.userSessions[sessionId];
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            this.saveDatabase(db);
            console.log(`Cleaned ${cleanedCount} old sessions`);
        }
        
        return cleanedCount;
    }

    // Резервное копирование базы данных
    backupDatabase() {
        const db = this.loadDatabase();
        const backupPath = path.join(__dirname, 'backups', `database_backup_${Date.now()}.json`);
        
        // Создаем папку backups если её нет
        const backupsDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
        }
        
        try {
            fs.writeFileSync(backupPath, JSON.stringify(db, null, 2));
            console.log(`Database backed up to: ${backupPath}`);
            return true;
        } catch (error) {
            console.error('Backup failed:', error);
            return false;
        }
    }

    // Восстановление из бэкапа
    restoreDatabase(backupFilePath) {
        try {
            const backupData = fs.readFileSync(backupFilePath, 'utf8');
            const parsedData = JSON.parse(backupData);
            
            if (this.isValidDatabase(parsedData)) {
                return this.saveDatabase(parsedData);
            } else {
                console.error('Invalid backup file format');
                return false;
            }
        } catch (error) {
            console.error('Restore failed:', error);
            return false;
        }
    }

    // Валидация структуры БД
    isValidDatabase(data) {
        return data && 
               typeof data.views === 'object' &&
               typeof data.bookmarks === 'object' &&
               typeof data.statistics === 'object';
    }
}

// Создаем HTTP сервер для обработки запросов
const http = require('http');
const url = require('url');
const querystring = require('querystring');

class StatsServer {
    constructor(port = 3001) {
        this.port = port;
        this.dbManager = new DatabaseManager();
        this.setupServer();
    }

    setupServer() {
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        // Запускаем периодические задачи
        this.startScheduledTasks();
    }

    handleRequest(req, res) {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const method = req.method;

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Маршрутизация
        if (pathname === '/api/increment-views' && method === 'POST') {
            this.handleIncrementViews(req, res);
        } else if (pathname === '/api/toggle-bookmark' && method === 'POST') {
            this.handleToggleBookmark(req, res);
        } else if (pathname === '/api/stats' && method === 'GET') {
            this.handleGetStats(req, res);
        } else if (pathname === '/api/script-stats' && method === 'GET') {
            this.handleGetScriptStats(req, res, parsedUrl.query);
        } else if (pathname === '/api/global-stats' && method === 'GET') {
            this.handleGetGlobalStats(req, res);
        } else if (pathname === '/api/backup' && method === 'POST') {
            this.handleBackup(req, res);
        } else {
            this.sendResponse(res, 404, { error: 'Endpoint not found' });
        }
    }

    handleIncrementViews(req, res) {
        this.getRequestBody(req).then(data => {
            const { scriptId, sessionId } = data;
            
            if (!scriptId) {
                return this.sendResponse(res, 400, { error: 'scriptId is required' });
            }

            // Увеличиваем счетчик просмотров
            const newViews = this.dbManager.incrementViews(scriptId);
            
            // Обновляем активность сессии если предоставлена
            if (sessionId) {
                this.dbManager.updateSessionActivity(sessionId);
            }

            this.sendResponse(res, 200, { 
                success: true, 
                views: newViews,
                scriptId: parseInt(scriptId)
            });
        }).catch(error => {
            this.sendResponse(res, 500, { error: 'Internal server error' });
        });
    }

    handleToggleBookmark(req, res) {
        this.getRequestBody(req).then(data => {
            const { userId, scriptId } = data;
            
            if (!userId || !scriptId) {
                return this.sendResponse(res, 400, { error: 'userId and scriptId are required' });
            }

            const bookmarks = this.dbManager.toggleBookmark(userId, scriptId);
            
            this.sendResponse(res, 200, { 
                success: true, 
                bookmarks: bookmarks,
                scriptId: parseInt(scriptId)
            });
        }).catch(error => {
            this.sendResponse(res, 500, { error: 'Internal server error' });
        });
    }

    handleGetStats(req, res) {
        const stats = this.dbManager.getGlobalStats();
        this.sendResponse(res, 200, stats);
    }

    handleGetScriptStats(req, res, query) {
        const { scriptId } = query;
        
        if (!scriptId) {
            return this.sendResponse(res, 400, { error: 'scriptId is required' });
        }

        const stats = this.dbManager.getScriptStats(scriptId);
        this.sendResponse(res, 200, stats);
    }

    handleGetGlobalStats(req, res) {
        const stats = this.dbManager.getGlobalStats();
        this.sendResponse(res, 200, stats);
    }

    handleBackup(req, res) {
        const success = this.dbManager.backupDatabase();
        this.sendResponse(res, success ? 200 : 500, { 
            success: success,
            message: success ? 'Backup created successfully' : 'Backup failed'
        });
    }

    getRequestBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(error);
                }
            });
            req.on('error', reject);
        });
    }

    sendResponse(res, statusCode, data) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }

    startScheduledTasks() {
        // Очистка старых сессий каждые 6 часов
        setInterval(() => {
            this.dbManager.cleanupOldSessions();
        }, 6 * 60 * 60 * 1000);

        // Бэкап каждые 24 часа
        setInterval(() => {
            this.dbManager.backupDatabase();
        }, 24 * 60 * 60 * 1000);

        console.log('Scheduled tasks started');
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`Stats server running on port ${this.port}`);
            console.log(`Database file: ${this.dbManager.dbPath}`);
        });
    }
}

// Запуск сервера если файл запущен напрямую
if (require.main === module) {
    const port = process.env.PORT || 3001;
    const server = new StatsServer(port);
    server.start();
}

module.exports = { DatabaseManager, StatsServer };
