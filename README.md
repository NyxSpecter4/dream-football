# Dream Football (Android)

A fantasy football auction draft and franchise simulation app built for Android with Kotlin, Jetpack Compose, Material 3, and Room.

## Overview

Dream Football puts you at the helm of an 8-team franchise league with a $301.2M salary cap, real-time auction draft room, full PPR head-to-head match scoring, side bets, and multi-year dynasty roster management.

## Key Features

- **Franchise Builder**: Custom franchise name, short ticker, home city, stadium, and 10 jersey colorway schemes.
- **Real-Time Auction Draft Room**: $301.2M salary cap, minimum bids, intelligent CPU bidding AI with positional need models and hammer states (*Going Once, Going Twice, Sold!*).
- **Weekly Matchup Engine**: Full PPR scoring model (passing, rushing, receiving, field goals, defenses) with boom/bust variance curves and slot-by-slot box score breakdowns.
- **House Chips Side Bets**: Wager house bankroll against your weekly matchup opponent with automated CPU acceptance and payoff settlements.
- **Roster & Lineup Manager**: Active starters (QB, RB1, RB2, WR1, WR2, TE, FLEX, K, DST) plus bench with tap-to-swap lineup management and waiver wire free agent acquisitions.
- **Standings & Playoff Bracket**: 8-team league table with top-4 playoff cut line, semifinal matchups, and championship final.
- **Dynasty Offseason**: Retain key players, cut contracts to free salary cap space, and roll forward into next season's auction draft.

## Android Architecture

- **UI Framework**: Jetpack Compose with Material Design 3 (M3)
- **Architecture**: MVVM with unidirectional data flow (`GameViewModel`, `StateFlow`)
- **Persistence**: Room Database with Kotlin Symbol Processing (KSP) and `kotlinx.serialization`
- **Gradle**: Kotlin DSL with Version Catalog (`gradle/libs.versions.toml`)
- **Adaptive Icon**: Material You adaptive launcher icon with football helmet & goalpost emblem

