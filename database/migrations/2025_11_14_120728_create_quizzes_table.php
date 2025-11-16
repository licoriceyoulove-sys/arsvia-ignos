<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quizzes', function (Blueprint $table) {
            // 文字列ID（UUID など）を想定
            $table->string('id')->primary();

            // 投稿者（ログインユーザーの id）※null 許可
            $table->unsignedBigInteger('author_id')->nullable();

            // 問題文・種類
            $table->text('question');
            $table->string('type', 20); // "choice" or "text"

            // 選択肢系
            $table->json('choices')->nullable();      // ["A","B","C"] など
            $table->integer('correct_index')->nullable();

            // テキスト回答用
            $table->text('model_answer')->nullable();

            // 補足説明
            $table->text('note')->nullable();

            // ハッシュタグ配列 ["#英単語","#中1"] など
            $table->json('hashtags')->nullable();

            // created_at / updated_at
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quizzes');
    }
};
