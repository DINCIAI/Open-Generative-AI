import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    server: {
        host: '127.0.0.1',
        proxy: {
            '/api': {
                target: 'https://api.muapi.ai',
                changeOrigin: true,
                secure: false
            }
        }
    }
});
