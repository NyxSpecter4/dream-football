package com.example.dreamfootball.data.model

import kotlinx.serialization.Serializable

@Serializable
data class GameState(
    val seasonSeed: Long = 1L,
    val week: Int = 1,
    val seasonNo: Int = 1,
    val phase: Phase = Phase.DRAFT,
    val screen: GameScreen = GameScreen.TITLE,
    val playerTeamId: String = "you",
    val teams: List<LeagueTeam> = emptyList(),
    val nominateIndex: Int = 0,
    val contracts: List<Contract> = emptyList(),
    val budgets: Map<String, Int> = emptyMap(),
    val cash: Map<String, Int> = emptyMap(),
    val rosters: Map<String, Roster> = emptyMap(),
    val schedule: List<List<Matchup>> = emptyList(),
    val results: Map<Int, Map<String, BoxScore>> = emptyMap(),
    val block: AuctionBlock? = null,
    val nominating: Boolean = false,
    val autoFill: Boolean = false,
    val pauseEvery: Boolean = false,
    val playoffBracket: PlayoffBracket? = null,
    val bets: List<SideBet> = emptyList(),
    val waiverClaims: List<String> = emptyList(),
    val lastSoldPlayerId: String? = null,
    val lastSoldTeamId: String? = null,
    val lastSoldPrice: Int = 0,
    val career: CareerStats = CareerStats()
)
