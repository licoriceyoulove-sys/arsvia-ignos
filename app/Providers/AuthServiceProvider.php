<?php

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * アプリケーションのポリシーマッピング
     *
     * @var array<class-string, class-string>
     */
    protected $policies = [
        // モデル => ポリシー クラス
        // Example::class => ExamplePolicy::class,
    ];

    /**
     * 認可サービスの登録
     */
    public function boot(): void
    {
        // 特に何もしなくてもOK（Gate定義がなければ空のままで良い）
    }
}
