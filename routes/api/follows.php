<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;

// GET /follows?viewer_id=1
Route::get('/follows', function (Request $request) {
    $viewerId = $request->query('viewer_id');
    if (empty($viewerId)) return response()->json(['ids' => []]);

    $ids = DB::table('follows')
        ->where('user_id', $viewerId)
        ->pluck('target_user_id')
        ->values()
        ->all();

    return response()->json(['ids' => $ids]);
});

Route::post('/follows/toggle', function (Request $request) {
    $userId   = (int)$request->input('user_id');
    $targetId = (int)$request->input('target_user_id');

    if ($userId <= 0 || $targetId <= 0) {
        return response()->json(['ok' => false, 'message' => 'user_id と target_user_id は必須です'], 422);
    }
    if ($userId === $targetId) {
        return response()->json(['ok' => false, 'message' => '自分自身はフォローできません'], 400);
    }

    $exists = DB::table('follows')
        ->where('user_id', $userId)
        ->where('target_user_id', $targetId)
        ->exists();

    if ($exists) {
        DB::table('follows')
            ->where('user_id', $userId)
            ->where('target_user_id', $targetId)
            ->delete();

        return response()->json(['ok' => true, 'following' => false]);
    }

    DB::table('follows')->insert([
        'user_id'        => $userId,
        'target_user_id' => $targetId,
    ]);

    return response()->json(['ok' => true, 'following' => true]);
});
