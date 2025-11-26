<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Discussion extends Model
{
    protected $table = 'discussions';

    protected $fillable = [
        'user_id',
        'title',
        'agenda',
    ];

    // 作成者
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // タグ
    public function tags(): HasMany
    {
        return $this->hasMany(DiscussionTag::class);
    }

    // 意見一覧
    public function opinions(): HasMany
    {
        return $this->hasMany(DiscussionOpinion::class);
    }
}
