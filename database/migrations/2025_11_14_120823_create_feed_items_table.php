<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feed_items', function (Blueprint $table) {
            $table->string('id')->primary();   // 文字列ID（UUID）

            $table->string('kind', 20);        // "quiz" | "quizBundle" | "share" など

            // React側の toFeedRow() で作った data を丸ごとJSONで保存
            $table->json('data');

            // カウンタ
            $table->unsignedInteger('likes')->default(0);
            $table->unsignedInteger('retweets')->default(0);
            $table->unsignedInteger('answers')->default(0);

            // 投稿者（任意）
            $table->unsignedBigInteger('author_id')->nullable();

            $table->timestamps();              // created_at / updated_at
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feed_items');
    }
};
