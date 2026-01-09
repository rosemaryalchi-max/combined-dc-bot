const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const path = require('path');
const config = require('../config');

// Ensure client secret is available
const CLIENT_SECRET = process.env.CLIENT_SECRET;
if (!CLIENT_SECRET) {
    console.warn('⚠️  Dashboard disabled: CLIENT_SECRET is missing from .env');
}

module.exports = (client) => {
    if (!CLIENT_SECRET) {
        console.warn('⚠️  WEB DASHBOARD SKIPPED: CLIENT_SECRET is missing in .env');
        console.warn('   Add it to .env to enable the website: http://localhost:3000');
        return;
    }

    const app = express();
    const port = process.env.PORT || 3000;

    // Settings
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.static(path.join(__dirname, 'public')));

    // Middleware to pass bot info to views
    app.use((req, res, next) => {
        res.locals.bot = client.user;
        next();
    });

    const FileStore = require('session-file-store')(session);

    app.use(session({
        store: new FileStore({
            path: path.join(__dirname, '..', 'sessions'),
            ttl: 600, // 10 minutes (server-side cleanup)
            retries: 0
        }),
        secret: 'super-secret-key-change-this',
        resave: false,
        saveUninitialized: false,
        rolling: true, // Reset expiration on every response (activity)
        cookie: {
            maxAge: 10 * 60 * 1000, // 10 minutes
            secure: false // Set to true if using HTTPS
        }
    }));
    app.use(passport.initialize());
    app.use(passport.session());

    // Passport Setup
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((obj, done) => done(null, obj));

    if (!config.clientId || !CLIENT_SECRET) {
        console.error('❌ Dashboard Error: Missing CLIENT_ID or CLIENT_SECRET.');
        return;
    }

    passport.use(new Strategy({
        clientID: config.clientId,
        clientSecret: CLIENT_SECRET,
        callbackURL: 'http://localhost:3000/callback',
        scope: ['identify', 'guilds']
    }, (accessToken, refreshToken, profile, done) => {
        process.nextTick(() => done(null, profile));
    }));

    // Routes
    app.get('/health', (req, res) => {
        res.send(client.isReady() ? 'ok' : 'starting');
    });

    app.get('/', (req, res) => {
        res.render('index', { user: req.user });
    });

    app.get('/login', passport.authenticate('discord'));
    app.get('/callback', passport.authenticate('discord', {
        failureRedirect: '/'
    }), (req, res) => {
        res.redirect('/dashboard');
    });

    app.get('/logout', (req, res, next) => {
        req.logout((err) => {
            if (err) return next(err);
            res.redirect('/');
        });
    });

    app.get('/dashboard', (req, res) => {
        if (!req.isAuthenticated()) return res.redirect('/login');

        // Filter guilds where user has Manage Server (0x20)
        const guilds = req.user.guilds.filter(g => (g.permissions & 0x20) === 0x20);
        res.render('dashboard', { user: req.user, guilds });
    });

    app.get('/dashboard/:guildId', (req, res) => {
        if (!req.isAuthenticated()) return res.redirect('/login');

        const guildId = req.params.guildId;
        const guild = req.user.guilds.find(g => g.id === guildId);

        if (!guild || (guild.permissions & 0x20) !== 0x20) {
            return res.status(403).send('Unauthorized or Server not found');
        }

        // Fetch Guild Config
        const { getGuildConfig } = require('../utils/guildConfig');
        const config = getGuildConfig(guildId);

        // Fetch Guild Channels (Text = 0, Category = 4)
        const botGuild = client.guilds.cache.get(guildId);
        const channels = botGuild ? botGuild.channels.cache.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name })) : [];
        const categories = botGuild ? botGuild.channels.cache.filter(c => c.type === 4).map(c => ({ id: c.id, name: c.name })) : [];

        // Fetch Guild Roles (exclude @everyone and managed)
        const roles = botGuild ? botGuild.roles.cache
            .filter(r => r.name !== '@everyone' && !r.managed)
            .sort((a, b) => b.position - a.position)
            .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
            : [];

        res.render('settings', { user: req.user, guild, config, channels, categories, roles, active: 'overview' });
    });

    // Welcome Plugin Route
    app.get('/dashboard/:guildId/welcome', (req, res) => {
        if (!req.isAuthenticated()) return res.redirect('/login');
        const guildId = req.params.guildId;
        const guild = req.user.guilds.find(g => g.id === guildId);
        if (!guild || (guild.permissions & 0x20) !== 0x20) return res.status(403).send('Unauthorized');

        const { getGuildConfig } = require('../utils/guildConfig');
        const config = getGuildConfig(guildId);
        const botGuild = client.guilds.cache.get(guildId);
        const channels = botGuild ? botGuild.channels.cache.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name })) : [];

        res.render('welcome', { user: req.user, guild, config, channels, active: 'welcome' });
    });

    app.post('/dashboard/:guildId/welcome', require('body-parser').urlencoded({ extended: true }), (req, res) => {
        if (!req.isAuthenticated()) return res.redirect('/login');
        const guildId = req.params.guildId;
        const guild = req.user.guilds.find(g => g.id === guildId);
        if (!guild || (guild.permissions & 0x20) !== 0x20) return res.status(403).send('Unauthorized');

        const { updateGuildConfig } = require('../utils/guildConfig');
        updateGuildConfig(guildId, (cfg) => {
            return {
                ...cfg,
                welcomeChannelId: req.body.welcomeChannelId || null,
                welcome: {
                    ...cfg.welcome,
                    card: {
                        enabled: req.body.cardEnabled === 'on',
                        theme: req.body.cardTheme || 'gaming',
                        title: req.body.cardTitle || 'Welcome to {server}!',
                        text: req.body.cardText || 'Hey {user}, nice to see you!',
                    }
                }
            };
        });
        res.redirect(`/dashboard/${guildId}/welcome`);
    });

    // Security Route
    app.get('/dashboard/:guildId/security', (req, res) => {
        if (!req.isAuthenticated()) return res.redirect('/login');
        const guildId = req.params.guildId;
        const guild = req.user.guilds.find(g => g.id === guildId);
        if (!guild || (guild.permissions & 0x20) !== 0x20) return res.status(403).send('Unauthorized');

        const { getGuildConfig } = require('../utils/guildConfig');
        const config = getGuildConfig(guildId);

        res.render('security', { user: req.user, guild, config, active: 'security' });
    });

    app.post('/dashboard/:guildId/security', require('body-parser').urlencoded({ extended: true }), (req, res) => {
        if (!req.isAuthenticated()) return res.redirect('/login');
        const guildId = req.params.guildId;
        const guild = req.user.guilds.find(g => g.id === guildId);
        if (!guild || (guild.permissions & 0x20) !== 0x20) return res.status(403).send('Unauthorized');

        const { updateGuildConfig } = require('../utils/guildConfig');
        updateGuildConfig(guildId, (cfg) => {
            return {
                ...cfg,
                panic: {
                    enabled: req.body.panicEnabled === 'on',
                    message: req.body.panicMessage || cfg.panic?.message
                }
            };
        });
        res.redirect(`/dashboard/${guildId}/security`);
    });

    // Tickets Route
    app.get('/dashboard/:guildId/tickets', (req, res) => {
        if (!req.isAuthenticated()) return res.redirect('/login');
        const guildId = req.params.guildId;
        const guild = req.user.guilds.find(g => g.id === guildId);
        if (!guild || (guild.permissions & 0x20) !== 0x20) return res.status(403).send('Unauthorized');

        const { getGuildConfig } = require('../utils/guildConfig');
        const config = getGuildConfig(guildId);
        const botGuild = client.guilds.cache.get(guildId);
        const channels = botGuild ? botGuild.channels.cache.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name })) : [];
        const categories = botGuild ? botGuild.channels.cache.filter(c => c.type === 4).map(c => ({ id: c.id, name: c.name })) : [];
        const roles = botGuild ? botGuild.roles.cache.filter(r => r.name !== '@everyone').map(r => ({ id: r.id, name: r.name, color: r.hexColor })) : [];

        res.render('tickets', { user: req.user, guild, config, channels, categories, roles, active: 'tickets' });
    });

    app.post('/dashboard/:guildId/tickets', require('body-parser').urlencoded({ extended: true }), (req, res) => {
        if (!req.isAuthenticated()) return res.redirect('/login');
        const guildId = req.params.guildId;
        const guild = req.user.guilds.find(g => g.id === guildId);
        if (!guild || (guild.permissions & 0x20) !== 0x20) return res.status(403).send('Unauthorized');

        const { updateGuildConfig } = require('../utils/guildConfig');
        updateGuildConfig(guildId, (cfg) => {
            return {
                ...cfg,
                ticket: {
                    supportRoleId: req.body.ticketSupportRoleId || null,
                    channelName: req.body.ticketChannelName || 'ticket-{username}',
                    welcomeMessage: req.body.ticketWelcomeMessage || 'Hello {user}, staff will be with you shortly.',
                    transcriptChannelId: req.body.ticketTranscriptChannelId || null,
                    categoryOpenId: req.body.ticketCategoryOpenId || null,
                    categoryClosedId: req.body.ticketCategoryClosedId || null,
                    count: cfg.ticket?.count || 0
                }
            };
        });
        res.redirect(`/dashboard/${guildId}/tickets`);
    });

    // Levels Route (MEE6)
    app.get('/dashboard/:guildId/levels', async (req, res) => {
        if (!req.isAuthenticated()) return res.redirect('/login');
        const guildId = req.params.guildId;
        const guild = req.user.guilds.find(g => g.id === guildId);
        if (!guild || (guild.permissions & 0x20) !== 0x20) return res.status(403).send('Unauthorized');

        try {
            const { fetchLeaderboard } = require('../utils/mee6');
            const leaderboard = await fetchLeaderboard(guildId);
            res.render('levels', { user: req.user, guild, leaderboard, active: 'levels' });
        } catch (e) {
            console.error('Leaderboard Fetch Error:', e);
            res.render('levels', { user: req.user, guild, leaderboard: null, active: 'levels' });
        }
    });

    // Overview Route (Updated to remove Welcome/Security specifics that are now separate)
    app.post('/dashboard/:guildId', require('body-parser').urlencoded({ extended: true }), (req, res) => {
        if (!req.isAuthenticated()) return res.redirect('/login');

        const guildId = req.params.guildId;
        const guild = req.user.guilds.find(g => g.id === guildId);
        if (!guild || (guild.permissions & 0x20) !== 0x20) return res.status(403).send('Unauthorized');

        const { updateGuildConfig } = require('../utils/guildConfig');
        updateGuildConfig(guildId, (cfg) => {
            return {
                ...cfg,
                logChannelId: req.body.logChannelId || null,
                // We keep welcomeChannelId here as it's a "General Channel" setting, or we can remove it. Keeping for legacy/convenience.
                welcomeChannelId: req.body.welcomeChannelId || null,
                ticket: {
                    supportRoleId: req.body.ticketSupportRoleId || null,
                    channelName: req.body.ticketChannelName || 'ticket-{username}',
                    welcomeMessage: req.body.ticketWelcomeMessage || 'Hello {user}, staff will be with you shortly.',
                    transcriptChannelId: req.body.ticketTranscriptChannelId || null,
                    categoryOpenId: req.body.ticketCategoryOpenId || null,
                    categoryClosedId: req.body.ticketCategoryClosedId || null,
                    count: cfg.ticket?.count || 0
                }
            };
        });

        res.redirect(`/dashboard/${guildId}`);
    });

    // Start Server
    app.listen(port, () => {
        console.log(`🌐 Dashboard is online at http://localhost:${port}`);
    });
};
