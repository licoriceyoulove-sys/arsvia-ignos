<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Follow extends Model
{
    use HasFactory;

    /**
     * このモデルが対応するテーブル名
     *（Laravel の規約通り "follows" になるので省略可能）
     */
    protected $table = 'follows';

    /**
     * 一括代入を許可するカラム
     */
    protected $fillable = [
        'follower_id',  // フォローする側のユーザーID
        'followee_id',  // フォローされる側のユーザーID
    ];

    /**
     * follower（フォローする側）ユーザーとのリレーション
     */
    public function follower()
    {
        return $this->belongsTo(User::class, 'follower_id');
    }

    /**
     * followee（フォローされる側）ユーザーとのリレーション
     */
    public function followee()
    {
        return $this->belongsTo(User::class, 'followee_id');
    }
}
