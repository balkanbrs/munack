<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_lib/common.php';

$config = munack_api_config();
munack_json_response([
    'ok' => true,
    'service' => 'munack-license-api',
    'productName' => $config['product_name'] ?? 'Munack',
    'hasProductId' => trim((string)($config['product_id'] ?? '')) !== '',
    'hasSellerId' => trim((string)($config['seller_id'] ?? '')) !== '',
    'timestamp' => gmdate(DATE_ATOM),
]);
