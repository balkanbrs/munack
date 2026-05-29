<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/_lib/common.php';

munack_handle_preflight();

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    munack_json_response([
        'ok' => false,
        'active' => false,
        'detail' => 'Method not allowed.',
    ], 405);
}

munack_verify_bearer_if_configured();

$config = munack_api_config();
$payload = munack_request_json();
$licenseKey = trim((string)($payload['licenseKey'] ?? $payload['license_key'] ?? ''));
$productId = trim((string)($payload['productId'] ?? $payload['product_id'] ?? $config['product_id'] ?? ''));
$product = trim((string)($payload['product'] ?? 'munack'));
$incrementUsesCount = (bool)($payload['incrementUsesCount'] ?? false);

if ($licenseKey === '') {
    munack_json_response([
        'ok' => false,
        'active' => false,
        'detail' => 'License key is required.',
    ], 400);
}

if ($productId === '') {
    munack_json_response([
        'ok' => false,
        'active' => false,
        'detail' => 'Gumroad product ID is not configured.',
    ], 500);
}

$result = munack_call_gumroad_verify($productId, $licenseKey, $incrementUsesCount);
$verifyPayload = $result['payload'];
$purchase = is_array($verifyPayload['purchase'] ?? null) ? $verifyPayload['purchase'] : [];
$active = (bool)($verifyPayload['success'] ?? false)
    && !($purchase['refunded'] ?? false)
    && !($purchase['disputed'] ?? false);

$plan = $active ? munack_detect_plan($purchase) : 'free';
$detail = $active
    ? 'Verified with Gumroad.'
    : 'Gumroad rejected the license or marked the purchase as refunded/disputed.';

munack_append_verify_event([
    'checked_at' => gmdate(DATE_ATOM),
    'product' => $product,
    'product_id' => $productId,
    'status_code' => $result['status_code'],
    'active' => $active,
    'plan' => $plan,
    'license_key_last4' => munack_mask_license_key($licenseKey),
    'product_name' => $purchase['product_name'] ?? null,
]);

munack_json_response([
    'ok' => $active,
    'active' => $active,
    'plan' => $plan,
    'productName' => $purchase['product_name'] ?? ($config['product_name'] ?? 'Munack'),
    'detail' => $detail,
    'provider' => 'gumroad',
    'statusCode' => $result['status_code'],
], 200);
