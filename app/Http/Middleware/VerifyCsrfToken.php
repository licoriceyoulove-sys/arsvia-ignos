<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class VerifyCsrfToken extends Middleware
{
    /**
     * CSRF チェックを除外するパス
     *
     * ここでは /api/... を全部除外します。
     * 例）/api/quizzes, /api/quizzes/bulk, /api/feed など
     */
    protected $except = [
        'api/*',
    ];
}
