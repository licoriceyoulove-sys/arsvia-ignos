<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;

// 指定ユーザーの投稿一覧
Route::get('/users/{id}/quizzes', function (int $id) {
    $rows = DB::table('quizzes')
        ->leftJoin('users', 'quizzes.author_id', '=', 'users.id')
        ->select(
            'quizzes.*',
            'users.display_name as author_display_name',
            'users.ignos_id as author_ignos_id'
        )
        ->where('quizzes.author_id', $id)
        ->orderBy('quizzes.created_at', 'desc')
        ->get();

    $rows = $rows->map(function ($r) {
        $r->choices  = $r->choices !== null ? json_decode($r->choices, true) : null;
        $r->hashtags = $r->hashtags !== null ? json_decode($r->hashtags, true) : [];
        return $r;
    });

    return response()->json($rows);
});

// ユーザー検索
Route::get('/users/search', function (Request $request) {
    $q = trim((string)$request->query('q', ''));
    if ($q === '') return response()->json(['users' => []]);

    $like = '%' . $q . '%';

    $users = DB::table('users')
        ->select('id', 'display_name', 'ignos_id')
        ->where(function ($query) use ($like) {
            $query->where('display_name', 'LIKE', $like)
                  ->orWhere('ignos_id', 'LIKE', $like);
        })
        ->orderBy('id')
        ->limit(50)
        ->get();

    return response()->json(['users' => $users]);
});

// follow-stats（プロフィール用）
Route::get('/users/{id}/follow-stats', function (Request $request, int $id) {
    $viewerId = (int)$request->query('viewer_id', 0);

    $followingCount = DB::table('follows')->where('user_id', $id)->count();
    $followerCount  = DB::table('follows')->where('target_user_id', $id)->count();

    $isFollowing = false;
    if ($viewerId > 0) {
        $isFollowing = DB::table('follows')
            ->where('user_id', $viewerId)
            ->where('target_user_id', $id)
            ->exists();
    }

    return response()->json([
        'user_id'          => $id,
        'following_count'  => $followingCount,
        'follower_count'   => $followerCount,
        'is_following'     => $isFollowing,
    ]);
});
