import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vite.dev/config/
export default defineConfig(function (_a) {
    var _b, _c;
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), '');
    var allowedHosts = ((_b = env.VITE_DEV_ALLOWED_HOSTS) !== null && _b !== void 0 ? _b : 'policy.nickelcy.com')
        .split(',')
        .map(function (host) { return host.trim(); })
        .filter(Boolean);
    var disableHmr = ((_c = env.VITE_DEV_HMR) !== null && _c !== void 0 ? _c : 'false').toLowerCase() === 'false';
    return {
        plugins: [react()],
        server: {
            host: true, // Listen on all addresses
            allowedHosts: allowedHosts,
            hmr: disableHmr ? false : undefined,
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
    };
});
