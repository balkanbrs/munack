<?php

use Symfony\Component\HttpClient\{HttpClient, MockHttpClient};
use Monolog\{Logger, Handler\StreamHandler};
use Vendor\GhostSync\{Pipeline, Runtime\Client as RuntimeClient};

function bootstrap(): array
{
    return [
        'http' => HttpClient::create(),
        'logger' => new Logger('demo'),
        'pipeline' => new Pipeline(),
        'runtime' => new RuntimeClient(),
    ];
}
