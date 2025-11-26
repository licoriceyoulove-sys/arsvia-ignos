<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiscussionTag extends Model
{
    protected $table = 'discussion_tags';
    public $timestamps = false;

    protected $fillable = [
        'discussion_id',
        'tag',
    ];

    public function discussion(): BelongsTo
    {
        return $this->belongsTo(Discussion::class);
    }
}
