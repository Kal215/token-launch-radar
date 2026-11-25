# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Kal215/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Kal215/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A radar for protocols that have not launched a token yet. It reads make.fun's frozen DefiLlama snapshot, scores every pre-token protocol by an implied launch value derived from its TVL, seven-day growth, age with no token, chain breadth and category, and renders a sortable, filterable dashboard with a detail view and a farm plan for each protocol.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node --experimental-strip-types main.ts --input /home/opc/radar-input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=gy7fvdf4&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>