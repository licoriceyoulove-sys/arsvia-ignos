<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Ignos では users テーブルは既に手動で作成済みのため、
        // このマイグレーションでは何もしません。
        return;
    }

    public function down(): void
    {
        // 既存の users テーブルを誤って消さないため、
        // down も何もしません。
        return;
    }
};
