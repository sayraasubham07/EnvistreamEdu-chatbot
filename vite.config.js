import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import chatHandler from './api/chat.js';
import sttHandler from './api/stt.js';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || env.REACT_APP_GEMINI_API_KEY || '';

    return {
        plugins: [
            react(),
            tailwindcss(),
            {
                name: 'local-api-middleware',
                configureServer(server) {
                    server.middlewares.use((req, res, next) => {
                        const pathname = req.url ? req.url.split('?')[0] : '';
                        if (pathname !== '/api/chat' && pathname !== '/api/stt') {
                            return next();
                        }

                        let rawBody = '';
                        req.on('data', (chunk) => { rawBody += chunk; });
                        req.on('end', async () => {
                            try {
                                req.body = rawBody ? JSON.parse(rawBody) : {};
                            } catch (_) {
                                req.body = {};
                            }

                            res.status = (code) => {
                                res.statusCode = code;
                                return res;
                            };
                            res.json = (data) => {
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify(data));
                            };

                            if (pathname === '/api/chat') {
                                return chatHandler(req, res);
                            }
                            if (pathname === '/api/stt') {
                                return sttHandler(req, res);
                            }
                        });
                    });
                },
            },
        ],
        server: {
            port: 4000,
            open: true,
            headers: {
                'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
            },
        },
        build: {
            outDir: 'dist',
            sourcemap: false,
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes('node_modules')) {
                            if (id.includes('firebase')) {
                                return 'vendor-firebase';
                            }
                            if (id.includes('framer-motion')) {
                                return 'vendor-framer';
                            }
                            if (id.includes('bootstrap') || id.includes('react-bootstrap')) {
                                return 'vendor-bootstrap';
                            }
                            if (id.includes('emoji-picker-react')) {
                                return 'vendor-emoji';
                            }
                            if (id.includes('@elevenlabs')) {
                                return 'vendor-elevenlabs';
                            }
                            if (id.includes('@google') || id.includes('groq-sdk') || id.includes('axios')) {
                                return 'vendor-core-libs';
                            }
                            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router') || id.includes('react-router-dom')) {
                                return 'vendor-react';
                            }
                            return 'vendor-others';
                        }
                    },
                },
            },
        },
        // Optimize dependencies
        optimizeDeps: {
            include: ['react', 'react-dom', 'react-router-dom', 'firebase'],
        },
    };
});
