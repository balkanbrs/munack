<?php
declare(strict_types=1);

const MUNACK_GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';

function munack_api_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $defaults = [
        'product_name' => 'Munack',
        'product_id' => '',
        'seller_id' => '',
        'ping_token' => '',
        'verify_bearer_token' => '',
        'support_email' => 'support@example.com',
        'allowed_origin' => '*',
        'default_plan' => 'pro',
        'team_keywords' => ['team'],
        'pro_keywords' => ['pro'],
    ];

    $path = dirname(__DIR__) . '/storage/config.json';
    if (is_file($path)) {
        $raw = file_get_contents($path);
        $decoded = json_decode($raw ?: '', true);
        if (is_array($decoded)) {
            $defaults = array_replace($defaults, array_filter(
                $decoded,
                static fn($value) => $value !== null && $value !== ''
            ));
        }
    }

    $config = $defaults;
    return $config;
}

function munack_storage_path(string $name): string
{
    $dir = dirname(__DIR__) . '/storage';
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    return $dir . DIRECTORY_SEPARATOR . $name;
}

function munack_load_json(string $name, array $fallback): array
{
    $path = munack_storage_path($name);
    if (!is_file($path)) {
        return $fallback;
    }

    $raw = file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        return $fallback;
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $fallback;
}

function munack_save_json(string $name, array $payload): void
{
    $path = munack_storage_path($name);
    file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

function munack_json_response(array $payload, int $status = 200): void
{
    $config = munack_api_config();
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Access-Control-Allow-Origin: ' . (string)($config['allowed_origin'] ?? '*'));
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

function munack_handle_preflight(): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        munack_json_response([
            'ok' => true,
            'preflight' => true,
        ]);
    }
}

function munack_request_json(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function munack_parse_ping_form(): array
{
    $payload = $_POST;
    foreach (['url_params', 'variants', 'custom_fields', 'shipping_information', 'card'] as $key) {
        if (!isset($payload[$key])) {
            continue;
        }
        $payload[$key] = munack_decode_nested_value($payload[$key]);
    }
    return $payload;
}

function munack_decode_nested_value(mixed $value): mixed
{
    if (is_array($value)) {
        $decoded = [];
        foreach ($value as $key => $item) {
            $decoded[$key] = munack_decode_nested_value($item);
        }
        return $decoded;
    }

    if (!is_string($value)) {
        return $value;
    }

    $trimmed = trim($value);
    if ($trimmed === '') {
        return $value;
    }

    if (($trimmed[0] === '{' && str_ends_with($trimmed, '}')) || ($trimmed[0] === '[' && str_ends_with($trimmed, ']'))) {
        $decoded = json_decode($trimmed, true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }

    if (str_contains($trimmed, '=') && str_contains($trimmed, '&')) {
        parse_str($trimmed, $decoded);
        if (is_array($decoded) && $decoded !== []) {
            return $decoded;
        }
    }

    return $value;
}

function munack_verify_bearer_if_configured(): void
{
    $config = munack_api_config();
    $expected = trim((string)($config['verify_bearer_token'] ?? ''));
    if ($expected === '') {
        return;
    }

    $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
        munack_json_response([
            'ok' => false,
            'active' => false,
            'detail' => 'Missing bearer token.',
        ], 401);
    }

    if (!hash_equals($expected, trim((string)$matches[1]))) {
        munack_json_response([
            'ok' => false,
            'active' => false,
            'detail' => 'Invalid bearer token.',
        ], 403);
    }
}

function munack_detect_plan(array $purchase): string
{
    $config = munack_api_config();
    $candidates = [];

    foreach (['variants_and_quantity', 'variants', 'product_name', 'product_permalink'] as $key) {
        $value = $purchase[$key] ?? null;
        if (is_string($value) && trim($value) !== '') {
            $candidates[] = $value;
        }
    }

    foreach ($candidates as $candidate) {
        $normalized = strtolower($candidate);
        foreach ((array)($config['team_keywords'] ?? ['team']) as $keyword) {
            if ($keyword !== '' && str_contains($normalized, strtolower((string)$keyword))) {
                return 'team';
            }
        }
        foreach ((array)($config['pro_keywords'] ?? ['pro']) as $keyword) {
            if ($keyword !== '' && str_contains($normalized, strtolower((string)$keyword))) {
                return 'pro';
            }
        }
    }

    return strtolower((string)($config['default_plan'] ?? 'pro')) === 'team' ? 'team' : 'pro';
}

function munack_mask_license_key(string $licenseKey): string
{
    $trimmed = trim($licenseKey);
    if (strlen($trimmed) < 4) {
        return '****';
    }
    return '***' . substr($trimmed, -4);
}

function munack_append_ping_event(array $payload, string $status): void
{
    $events = munack_load_json('gumroad_pings.json', ['events' => []]);
    $events['events'][] = [
        'received_at' => gmdate(DATE_ATOM),
        'status' => $status,
        'seller_id' => $payload['seller_id'] ?? null,
        'product_id' => $payload['product_id'] ?? null,
        'product_name' => $payload['product_name'] ?? null,
        'order_number' => $payload['order_number'] ?? null,
        'sale_id' => $payload['sale_id'] ?? null,
        'email' => $payload['email'] ?? null,
        'test' => $payload['test'] ?? null,
    ];
    $events['events'] = array_slice($events['events'], -500);
    munack_save_json('gumroad_pings.json', $events);
}

function munack_append_verify_event(array $payload): void
{
    $events = munack_load_json('verify_log.json', ['events' => []]);
    $events['events'][] = $payload;
    $events['events'] = array_slice($events['events'], -500);
    munack_save_json('verify_log.json', $events);
}

function munack_call_gumroad_verify(string $productId, string $licenseKey, bool $incrementUsesCount = false): array
{
    $body = http_build_query([
        'product_id' => $productId,
        'license_key' => $licenseKey,
        'increment_uses_count' => $incrementUsesCount ? 'true' : 'false',
    ]);

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => $body,
            'ignore_errors' => true,
            'timeout' => 15,
        ],
    ]);

    $response = @file_get_contents(MUNACK_GUMROAD_VERIFY_URL, false, $context);
    $statusLine = $http_response_header[0] ?? 'HTTP/1.1 500';
    preg_match('/\s(\d{3})\s/', $statusLine, $matches);
    $statusCode = isset($matches[1]) ? (int)$matches[1] : 500;
    $decoded = json_decode($response ?: '', true);

    return [
        'status_code' => $statusCode,
        'payload' => is_array($decoded) ? $decoded : [],
        'raw' => $response,
    ];
}
