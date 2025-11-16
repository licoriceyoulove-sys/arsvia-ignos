import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [
    laravel({
      // Vite に「どのファイルをビルド対象にするか」を教える場所
      input: [
        'resources/css/app.css',   // Tailwind を読み込むCSS
        'resources/js/main.tsx',   // React アプリのエントリポイント
      ],
      // 開発中にファイル変更を監視して、自動リロードしてくれる対象
      refresh: [
        'resources/views/**',
        'resources/js/**',
        'routes/**',
      ],
    }),
    // React + SWC（高速コンパイル）
    react(),
  ],
  resolve: {
    alias: {
      // たとえば "@/api/client" で "resources/js/api/client" を指せるようにする
      '@': '/resources/js',
    },
  },
});
