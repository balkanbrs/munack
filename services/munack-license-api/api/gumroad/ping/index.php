<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/_lib/common.php';

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    munack_json_response([
        'ok' => false,
        'accepted' => false,
        'detail' => 'Method not allowed.',
    ], 405);
}

$config = munack_api_config();
$expectedToken = trim((string)($config['ping_token'] ?? ''));
$receivedToken = trim((string)($_GET['token'] ?? ''));

if ($expectedToken !== '' && !hash_equals($expectedToken, $receivedToken)) {
    munack_json_response([
        'ok' => false,
        'accepted' => false,
        'detail' => 'Invalid ping token.',
    ], 401);
}

$payload = munack_parse_ping_form();
$expectedSellerId = trim((string)($config['seller_id'] ?? ''));
$receivedSellerId = trim((string)($payload['seller_id'] ?? ''));
$expectedProductId = trim((string)($config['product_id'] ?? ''));
$receivedProductId = trim((string)($payload['product_id'] ?? ''));

if ($expectedSellerId !== '' && $receivedSellerId !== $expectedSellerId) {
    munack_append_ping_event($payload, 'ignored_seller');
    munack_json_response([
        'ok' => true,
        'accepted' => false,
        'detail' => 'Ignoring ping for another seller.',
    ]);
}

if ($expectedProductId !== '' && $receivedProductId !== '' && $receivedProductId !== $expectedProductId) {
    munack_append_ping_event($payload, 'ignored_product');
    munack_json_response([
        'ok' => true,
        'accepted' => false,
        'detail' => 'Ignoring ping for another product.',
    ]);
}

munack_append_ping_event($payload, 'accepted');

munack_json_response([
    'ok' => true,
    'accepted' => true,
    'detail' => 'Ping recorded for Munack.',
    'productId' => $receivedProductId,
    'orderId' => $payload['order_number'] ?? $payload['sale_id'] ?? null,
]);
