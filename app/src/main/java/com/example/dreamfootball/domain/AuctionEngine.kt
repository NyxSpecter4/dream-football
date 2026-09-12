package com.example.dreamfootball.domain

import com.example.dreamfootball.data.model.AuctionBlock
import com.example.dreamfootball.data.model.AuctionPlan
import com.example.dreamfootball.data.model.BidLog
import com.example.dreamfootball.data.model.Contract
import com.example.dreamfootball.data.model.LeagueTeam
import com.example.dreamfootball.data.model.Player
import com.example.dreamfootball.data.model.Position
import com.example.dreamfootball.data.model.Roster
import com.example.dreamfootball.data.model.Slot
import kotlin.math.max
import kotlin.math.min

object AuctionEngine {
    const val SALARY_CAP = 301_200 // $301.2M
    const val MIN_BID = 1_000      // $1K
    const val BID_STEP = 1_000
    const val ROSTER_SIZE = 10

    fun maxAffordable(budget: Int, spotsLeft: Int): Int {
        if (spotsLeft <= 0) return 0
        val reservedForRest = (spotsLeft - 1) * MIN_BID
        return max(0, budget - reservedForRest)
    }

    fun marketValue(playerId: String): Int {
        val player = PlayersData.getPlayer(playerId)
        val proj = ScoringEngine.calculateProjection(player)
        val base = when (player.pos) {
            Position.QB -> (player.ovr - 80) * 4_200 + 12_000
            Position.RB -> (player.ovr - 78) * 4_800 + 10_000
            Position.WR -> (player.ovr - 78) * 4_500 + 9_000
            Position.TE -> (player.ovr - 80) * 3_600 + 6_000
            Position.K -> (player.ovr - 82) * 800 + 2_000
            Position.DST -> (player.ovr - 82) * 1_000 + 3_000
        }
        val vorpMultiplier = max(0.5f, 1.0f + proj.vorp * 0.08f)
        val value = (base * vorpMultiplier).toInt()
        return max(MIN_BID, (value / 1_000) * 1_000)
    }

    fun nextRaise(currentBid: Int): Int {
        return currentBid + BID_STEP
    }

    fun nextNominatorIndex(teamCount: Int, currentIndex: Int, rosters: Map<String, Roster>, teams: List<LeagueTeam>): Int? {
        if (teams.isEmpty()) return null
        for (i in 0 until teamCount) {
            val idx = (currentIndex + i) % teamCount
            val team = teams[idx]
            val roster = rosters[team.id] ?: Roster()
            if (roster.spotsLeft() > 0) {
                return idx
            }
        }
        return null
    }

    fun cpuNominate(
        available: List<Player>,
        roster: Roster,
        budget: Int,
        aggression: Float
    ): Player {
        val spots = roster.spotsLeft()
        val cap = maxAffordable(budget, spots)

        // Find positions of highest need
        val hasQb = roster.lineup[Slot.QB] != null
        val rbCount = listOf(roster.lineup[Slot.RB1], roster.lineup[Slot.RB2]).count { it != null }
        val wrCount = listOf(roster.lineup[Slot.WR1], roster.lineup[Slot.WR2]).count { it != null }
        val hasTe = roster.lineup[Slot.TE] != null

        val candidates = available.filter { marketValue(it.id) <= cap }
        if (candidates.isEmpty()) return available.first()

        val priority = candidates.sortedByDescending { player ->
            var score = player.ovr.toFloat()
            if (!hasQb && player.pos == Position.QB) score += 20f
            if (rbCount < 2 && player.pos == Position.RB) score += 18f
            if (wrCount < 2 && player.pos == Position.WR) score += 18f
            if (!hasTe && player.pos == Position.TE) score += 14f
            score * aggression
        }
        return priority.firstOrNull() ?: available.first()
    }

    fun cpuMaxBid(
        playerId: String,
        roster: Roster,
        budget: Int,
        aggression: Float
    ): Int {
        val spots = roster.spotsLeft()
        if (spots <= 0) return 0
        val cap = maxAffordable(budget, spots)
        if (cap < MIN_BID) return 0

        val player = PlayersData.getPlayer(playerId)
        val mv = marketValue(playerId)

        // Position need multiplier
        var needMult = 1.0f
        when (player.pos) {
            Position.QB -> if (roster.lineup[Slot.QB] != null) needMult = 0.2f else needMult = 1.15f
            Position.RB -> {
                val rbs = listOf(roster.lineup[Slot.RB1], roster.lineup[Slot.RB2]).count { it != null }
                if (rbs == 0) needMult = 1.2f else if (rbs == 1) needMult = 1.05f else needMult = 0.5f
            }
            Position.WR -> {
                val wrs = listOf(roster.lineup[Slot.WR1], roster.lineup[Slot.WR2]).count { it != null }
                if (wrs == 0) needMult = 1.2f else if (wrs == 1) needMult = 1.05f else needMult = 0.5f
            }
            Position.TE -> if (roster.lineup[Slot.TE] != null) needMult = 0.25f else needMult = 1.1f
            Position.K, Position.DST -> needMult = 0.6f
        }

        val target = (mv * aggression * needMult).toInt()
        val stepTarget = (target / 1_000) * 1_000
        return min(cap, max(MIN_BID, stepTarget))
    }

    fun planMaxBid(
        plan: AuctionPlan,
        playerId: String,
        budget: Int,
        roster: Roster
    ): Int {
        val spots = roster.spotsLeft()
        val cap = maxAffordable(budget, spots)
        val player = PlayersData.getPlayer(playerId)
        val mv = marketValue(playerId)

        val multiplier = when (plan) {
            AuctionPlan.BALANCED -> 1.0f
            AuctionPlan.HERO_RB -> if (player.pos == Position.RB && player.ovr >= 92) 1.25f else if (player.pos == Position.RB) 0.85f else 0.95f
            AuctionPlan.DUAL_ACE_WR -> if (player.pos == Position.WR && player.ovr >= 92) 1.22f else 0.92f
            AuctionPlan.BUDGET_QB -> if (player.pos == Position.QB) 0.65f else 1.08f
            AuctionPlan.VALUE_HOUND -> 0.88f
        }

        val target = (mv * multiplier).toInt()
        return min(cap, max(MIN_BID, (target / 1_000) * 1_000))
    }

    fun placePlayerInRoster(roster: Roster, playerId: String): Roster {
        val player = PlayersData.getPlayer(playerId)
        val lineup = roster.lineup.toMutableMap()
        val bench = roster.bench.toMutableList()

        when (player.pos) {
            Position.QB -> if (lineup[Slot.QB] == null) lineup[Slot.QB] = playerId else bench.add(playerId)
            Position.RB -> {
                if (lineup[Slot.RB1] == null) lineup[Slot.RB1] = playerId
                else if (lineup[Slot.RB2] == null) lineup[Slot.RB2] = playerId
                else if (lineup[Slot.FLEX] == null) lineup[Slot.FLEX] = playerId
                else bench.add(playerId)
            }
            Position.WR -> {
                if (lineup[Slot.WR1] == null) lineup[Slot.WR1] = playerId
                else if (lineup[Slot.WR2] == null) lineup[Slot.WR2] = playerId
                else if (lineup[Slot.FLEX] == null) lineup[Slot.FLEX] = playerId
                else bench.add(playerId)
            }
            Position.TE -> {
                if (lineup[Slot.TE] == null) lineup[Slot.TE] = playerId
                else if (lineup[Slot.FLEX] == null) lineup[Slot.FLEX] = playerId
                else bench.add(playerId)
            }
            Position.K -> if (lineup[Slot.K] == null) lineup[Slot.K] = playerId else bench.add(playerId)
            Position.DST -> if (lineup[Slot.DST] == null) lineup[Slot.DST] = playerId else bench.add(playerId)
        }

        return Roster(lineup = lineup, bench = bench)
    }

    fun fillUnfinishedRosters(
        teams: List<LeagueTeam>,
        rosters: Map<String, Roster>,
        budgets: Map<String, Int>,
        contracts: List<Contract>
    ): Triple<Map<String, Roster>, Map<String, Int>, List<Contract>> {
        val nextRosters = rosters.toMutableMap()
        val nextBudgets = budgets.toMutableMap()
        val nextContracts = contracts.toMutableList()

        val taken = nextContracts.map { it.playerId }.toMutableSet()
        val pool = PlayersData.ALL_PLAYERS.sortedBy { it.ovr } // take cheaper for filling

        for (team in teams) {
            var r = nextRosters[team.id] ?: Roster()
            var b = nextBudgets[team.id] ?: 0
            while (r.spotsLeft() > 0) {
                val available = pool.firstOrNull { !taken.contains(it.id) } ?: break
                taken.add(available.id)
                r = placePlayerInRoster(r, available.id)
                b = max(0, b - MIN_BID)
                nextContracts.add(Contract(available.id, team.id, MIN_BID))
            }
            nextRosters[team.id] = r
            nextBudgets[team.id] = b
        }

        return Triple(nextRosters, nextBudgets, nextContracts)
    }
}
