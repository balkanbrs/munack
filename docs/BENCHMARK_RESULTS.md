# Munack Benchmark Results

## Adversarial polyglot suite

Command:

```powershell
munack scan .\samples\adversarial-polyglot-suite --format json
```

Observed summary:

- files scanned: `9`
- candidates scanned: `22`
- exists: `14`
- suspicious: `8`
- unknown: `0`
- not_found: `0`

Representative suspicious findings:

- `@vercel/kv-runtime`
- `@workflowkit/agents`
- `acme/llm-orchestrator`
- `agentmesh-runtime`
- `ghostsync-runtime`
- `litellm-proxy-sdk`
- `phantom-executor`
- `vendor/ghost-sync`

Representative existing findings:

- `openai`
- `@aws-sdk/client-s3`
- `PyYAML`
- `Pillow`
- `scikit-learn`
- `reqwest`
- `serde`
- `symfony/http-client`
- `monolog/monolog`

## Adversarial namespace suite

Command:

```powershell
munack scan .\samples\adversarial-namespace-suite --format json
```

Observed summary:

- files scanned: `4`
- candidates scanned: `6`
- exists: `4`
- suspicious: `2`
- unknown: `0`
- not_found: `0`

Representative suspicious findings:

- `ghostsync-runtime`
- `vendor/ghost-sync`

Representative existing findings:

- `beautifulsoup4`
- `PyMuPDF`
- `symfony/http-client`
- `monolog/monolog`

## Why this matters

These results make Munack easier to evaluate quickly:

- the scanner catches hallucinated dependency references across ecosystems
- real dependencies still resolve correctly
- the proof is reproducible from the public repository
