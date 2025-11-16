<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        // 画面系ルート（ログイン /home など）
        web: __DIR__.'/../routes/web.php',

        // ★ ここを追加：API ルートを routes/api.php から読み込む
        api: __DIR__.'/../routes/api.php',

        // Artisan コマンド用
        commands: __DIR__.'/../routes/console.php',

        // /up 用（ヘルスチェック）
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        //
        // 必要ならここにミドルウェアの追加設定を書く
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
        // 例外ハンドリングのカスタマイズがあればここに書く
    })
    ->create();
