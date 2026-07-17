# RFD Artifact progress

## Status

`not-started`

## Checklist

- [ ] Add Artifacts namespace binding through Alchemy / Worker config.
- [ ] Generate and inspect binding types.
- [ ] Implement `RfdCatalog` backed by D1 (replace fixture list).
- [ ] Implement `RfdRepository` create with isomorphic-git seed commit.
- [ ] Implement read and history.
- [ ] Implement checkpoint.
- [ ] Implement fork via binding `fork`.
- [ ] Implement short-lived clone tokens.
- [ ] Wire home page to real catalog.
- [ ] Contract tests + confirmed live integration tests.

## Blockers

- Cloudflare Artifacts closed beta access for the account.
- Confirm Alchemy support or raw wrangler config for `artifacts` binding.

## Implementation notes

Record binding type quirks, token format (`?expires=`), and MemoryFS decisions here.
