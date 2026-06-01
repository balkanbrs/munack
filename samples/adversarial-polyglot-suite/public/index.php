<?php

use Symfony\Component\HttpClient\HttpClient;
use Monolog\Logger;
use Acme\LlmOrchestrator\Client;
use Vendor\GhostSync\Runtime\Pipeline;

function bootstrap(): array
{
    return [
        'http' => HttpClient::create(),
        'logger' => new Logger('demo'),
        'client' => new Client(),
        'pipeline' => new Pipeline(),
    ];
}
