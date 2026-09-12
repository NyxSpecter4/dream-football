package com.example.dreamfootball.domain

import com.example.dreamfootball.data.model.BoxScore
import com.example.dreamfootball.data.model.DreamProj
import com.example.dreamfootball.data.model.Matchup
import com.example.dreamfootball.data.model.Player
import com.example.dreamfootball.data.model.Position
import com.example.dreamfootball.data.model.Roster
import com.example.dreamfootball.data.model.Slot
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.random.Random

object ScoringEngine {
    val PPR_RULES = listOf(
        "Passing TD" to "+4.0 pts",
        "Pass Yds" to "1 pt / 25 yds",
        "Interception" to "-2.0 pts",
        "Rush / Rec TD" to "+6.0 pts",
        "Rush / Rec Yds" to "1 pt / 10 yds",
        "Reception (PPR)" to "+1.0 pt",
        "Fumble Lost" to "-2.0 pts",
        "Field Goal" to "+3.0 to +5.0 pts",
        "Defensive Sack / Turnover" to "+1.0 to +2.0 pts"
    )

    private val PRIOR_BY_POS = mapOf(
        Position.QB to 14.0f,
        Position.RB to 10.0f,
        Position.WR to 9.5f,
        Position.TE to 7.0f,
        Position.K to 7.5f,
        Position.DST to 8.0f
    )

    private val REPLACEMENT_BY_POS = mapOf(
        Position.QB to 13.0f,
        Position.RB to 8.5f,
        Position.WR to 8.8f,
        Position.TE to 6.2f,
        Position.K to 7.2f,
        Position.DST to 6.5f
    )

    fun calculateProjection(player: Player, isHome: Boolean? = null): DreamProj {
        val base = (PRIOR_BY_POS[player.pos] ?: 8.0f) + (player.ovr - 70) * 0.42f
        var mid = base * (0.82f + player.durability * 0.2f)
        if (isHome == true) mid += 0.35f
        if (isHome == false) mid -= 0.15f
        mid = max(1.0f, mid)

        val spread = 0.2f + player.boom * 0.5f
        val floor = max(0.5f, mid * (1.0f - spread))
        val ceil = mid * (1.0f + spread)
        val rep = REPLACEMENT_BY_POS[player.pos] ?: 7.0f
        val vorp = mid - rep

        return DreamProj(
            mid = round1(mid),
            floor = round1(floor),
            ceil = round1(ceil),
            vorp = round1(vorp)
        )
    }

    fun scorePlayerForWeek(player: Player, week: Int, seed: Long, isHome: Boolean): Float {
        // Deterministic pseudo-randomness for this player & week & seed
        val rand = Random(seed + player.id.hashCode() * 31L + week * 101L)
        val proj = calculateProjection(player, isHome)

        // Gaussian-like curve with boom potential
        val r1 = rand.nextFloat()
        val r2 = rand.nextFloat()
        val norm = (r1 + r2) / 2.0f // centered at 0.5

        // Check boom / bust
        val score = when {
            rand.nextFloat() < (player.boom * 0.25f) -> {
                // Boom week!
                proj.mid + (proj.ceil - proj.mid) * (0.6f + rand.nextFloat() * 0.4f)
            }
            rand.nextFloat() < 0.12f -> {
                // Bust / off-game
                proj.floor + (proj.mid - proj.floor) * rand.nextFloat() * 0.5f
            }
            else -> {
                proj.floor + (proj.ceil - proj.floor) * norm
            }
        }
        return round1(max(0.0f, score))
    }

    fun simulateMatchup(
        matchup: Matchup,
        homeRoster: Roster,
        awayRoster: Roster,
        week: Int,
        seasonSeed: Long
    ): Pair<BoxScore, BoxScore> {
        val homePlayerPoints = mutableMapOf<String, Float>()
        val awayPlayerPoints = mutableMapOf<String, Float>()

        var homeTotal = 0.0f
        var awayTotal = 0.0f

        for ((_, playerId) in homeRoster.lineup) {
            if (playerId != null) {
                val player = PlayersData.getPlayer(playerId)
                val pts = if (player.bye == week) 0.0f else scorePlayerForWeek(player, week, seasonSeed, true)
                homePlayerPoints[playerId] = pts
                homeTotal += pts
            }
        }

        for ((_, playerId) in awayRoster.lineup) {
            if (playerId != null) {
                val player = PlayersData.getPlayer(playerId)
                val pts = if (player.bye == week) 0.0f else scorePlayerForWeek(player, week, seasonSeed, false)
                awayPlayerPoints[playerId] = pts
                awayTotal += pts
            }
        }

        homeTotal = round1(homeTotal)
        awayTotal = round1(awayTotal)

        // Break exact ties slightly in favor of home
        val homeWon = if (homeTotal == awayTotal) true else homeTotal > awayTotal

        val homeBox = BoxScore(
            teamId = matchup.homeId,
            opponentId = matchup.awayId,
            points = homeTotal,
            opponentPoints = awayTotal,
            won = homeWon,
            playerPoints = homePlayerPoints
        )

        val awayBox = BoxScore(
            teamId = matchup.awayId,
            opponentId = matchup.homeId,
            points = awayTotal,
            opponentPoints = homeTotal,
            won = !homeWon,
            playerPoints = awayPlayerPoints
        )

        return Pair(homeBox, awayBox)
    }

    private fun round1(v: Float): Float {
        return (v * 10f).roundToInt() / 10f
    }
}
