<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiscussionVote extends Model
{
    protected $table = 'discussion_votes';

    protected $fillable = [
        'opinion_id',
        'user_id',
        'vote', // 'agree' | 'disagree' | 'pass'
    ];

    public function opinion(): BelongsTo
    {
        return $this->belongsTo(DiscussionOpinion::class, 'opinion_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
