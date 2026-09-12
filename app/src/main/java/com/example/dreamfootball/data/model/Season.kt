package com.example.dreamfootball.data.model

import kotlinx.serialization.Serializable

@Serializable
enum class Phase {
    DRAFT, REGULAR, PLAYOFFS, COMPLETE, OFFSEASON
}

@Serializable
enum class GameScreen {
    TITLE, SETUP, DRAFT, HOME, ROSTER, MATCHUP, STANDINGS, OFFSEASON
}

@Serializable
data class Matchup(
    val homeId: String,
    val awayId: String
)

@Serializable
data class BoxScore(
    val teamId: String,
    val opponentId: String,
    val points: Float,
    val opponentPoints: Float,
    val won: Boolean,
    val playerPoints: Map<String, Float> = emptyMap()
)

@Serializable
data class PlayoffBracket(
    val semiA: Matchup,
    val semiB: Matchup,
    val finalMatchup: Matchup? = null,
    val championId: String? = null
)

@Serializable
data class SideBet(
    val id: String,
    val week: Int,
    val fromId: String,
    val toId: String,
    val stake: Int,
    val status: String, // "open", "live", "done", "dead"
    val winnerId: String? = null
)

@Serializable
data class CareerStats(
    val seasons: Int = 0,
    val titles: Int = 0,
    val bestFinish: Int? = null
)

@Serializable
data class StandingsRow(
    val teamId: String,
    val wins: Int,
    val losses: Int,
    val ties: Int,
    val pointsFor: Float,
    val pointsAgainst: Float
)
