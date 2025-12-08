<?php

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    /**
     * アプリケーションでリッスンするイベントのマッピング
     *
     * @var array<class-string, array<int, class-string>>
     */
    protected $listen = [
        // ここにイベント => リスナー を書く（必要になったら）
        // ExampleEvent::class => [
        //     ExampleListener::class,
        // ],
    ];

    /**
     * イベントサービスの登録
     */
    public function boot(): void
    {
        //
    }
}
