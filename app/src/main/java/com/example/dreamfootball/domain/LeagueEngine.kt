package com.example.dreamfootball.domain

import com.example.dreamfootball.data.model.BoxScore
import com.example.dreamfootball.data.model.Contract
import com.example.dreamfootball.data.model.JerseyTheme
import com.example.dreamfootball.data.model.LeagueTeam
import com.example.dreamfootball.data.model.Matchup
import com.example.dreamfootball.data.model.PlayoffBracket
import com.example.dreamfootball.data.model.Roster
import com.example.dreamfootball.data.model.SideBet
import com.example.dreamfootball.data.model.Slot
import com.example.dreamfootball.data.model.StandingsRow
import kotlin.random.Random

object LeagueEngine {
    const val REGULAR_WEEKS = 7
    const val PLAYOFF_WEEK = 8
    const val CHAMPIONSHIP_WEEK = 9
    const val HOUSE_CASH = 100_000 // $100K starting house cash
    val STAKES = listOf(5_000, 10_000, 20_000, 40_000)

    private val CPU_CLUBS = listOf(
        Triple("Lone Star Outlaws", "DAL", JerseyTheme.MIDNIGHT),
        Triple("Arrowhead Reign", "KC", JerseyTheme.CRIMSON),
        Triple("Bay Fog Armada", "SF", JerseyTheme.SUNSET),
        Triple("Broad Street Blitz", "PHI", JerseyTheme.EMERALD),
        Triple("Frozen Tundra Titans", "GB", JerseyTheme.PINE),
        Triple("Motor City Muscle", "DET", JerseyTheme.STEEL),
        Triple("Harbor Ravens Club", "BAL", JerseyTheme.ROYAL)
    )

    fun buildLeague(
        humanName: String,
        humanShort: String,
        humanJersey: JerseyTheme,
        humanCity: String,
        humanStadium: String
    ): List<LeagueTeam> {
        val list = mutableListOf<LeagueTeam>()
        val you = LeagueTeam(
            id = "you",
            name = humanName.ifBlank { "Dream Football" },
            short = humanShort.ifBlank { "DRM" },
            jersey = humanJersey,
            city = humanCity.ifBlank { "Dallas" },
            stadium = humanStadium.ifBlank { "Trinity Field" },
            human = true
        )
        list.add(you)

        val cities = CitiesData.CITIES.shuffled(Random(42))
        for (i in 0 until 7) {
            val cpu = CPU_CLUBS[i]
            val city = cities[i % cities.size]
            list.add(
                LeagueTeam(
                    id = "cpu-$i",
                    name = cpu.first,
                    short = cpu.second,
                    jersey = cpu.third,
                    city = city.city,
                    stadium = city.stadium,
                    human = false,
                    nfl = city.nfl
                )
            )
        }
        return list
    }

    /**
     * Standard round-robin 7-week schedule for 8 teams.
     */
    fun generateSchedule(teamIds: List<String>): List<List<Matchup>> {
        if (teamIds.size < 8) return emptyList()
        val n = teamIds.size
        val rounds = mutableListOf<List<Matchup>>()
        val teams = teamIds.toMutableList()

        for (round in 0 until (n - 1)) {
            val weekMatchups = mutableListOf<Matchup>()
            for (i in 0 until (n / 2)) {
                val home = teams[i]
                val away = teams[n - 1 - i]
                // Alternate home and away each round for balance
                if ((round + i) % 2 == 0) {
                    weekMatchups.add(Matchup(home, away))
                } else {
                    weekMatchups.add(Matchup(away, home))
                }
            }
            rounds.add(weekMatchups)

            // Rotate round-robin preserving index 0
            val last = teams.removeAt(teams.size - 1)
            teams.add(1, last)
        }
        return rounds
    }

    fun calculateStandings(
        teams: List<LeagueTeam>,
        resultsByWeek: Map<Int, Map<String, BoxScore>>,
        upToWeek: Int
    ): List<StandingsRow> {
        val stats = teams.associate { it.id to MutableList(5) { 0.0f } } // wins, losses, ties, PF, PA

        for (w in 1..upToWeek) {
            val weekResults = resultsByWeek[w] ?: continue
            for (team in teams) {
                val box = weekResults[team.id] ?: continue
                val row = stats[team.id] ?: continue
                if (box.won) row[0] += 1.0f else row[1] += 1.0f
                row[3] += box.points
                row[4] += box.opponentPoints
            }
        }

        return teams.map { team ->
            val row = stats[team.id]!!
            StandingsRow(
                teamId = team.id,
                wins = row[0].toInt(),
                losses = row[1].toInt(),
                ties = row[2].toInt(),
                pointsFor = row[3],
                pointsAgainst = row[4]
            )
        }.sortedWith(
            compareByDescending<StandingsRow> { it.wins }
                .thenByDescending { it.pointsFor }
                .thenBy { it.pointsAgainst }
        )
    }

    fun swapLineup(roster: Roster, slot: Slot, benchPlayerId: String): Roster {
        val currentStarter = roster.lineup[slot]
        val benchIndex = roster.bench.indexOf(benchPlayerId)
        if (benchIndex == -1) return roster

        val nextBench = roster.bench.toMutableList()
        nextBench.removeAt(benchIndex)
        if (currentStarter != null) {
            nextBench.add(currentStarter)
        }

        val nextLineup = roster.lineup.toMutableMap()
        nextLineup[slot] = benchPlayerId

        return Roster(lineup = nextLineup, bench = nextBench)
    }

    fun settleSideBets(
        bets: List<SideBet>,
        cash: Map<String, Int>,
        results: Map<String, BoxScore>,
        week: Int
    ): Pair<List<SideBet>, Map<String, Int>> {
        val nextCash = cash.toMutableMap()
        val nextBets = bets.map { bet ->
            if (bet.week != week || bet.status != "live") return@map bet
            val a = results[bet.fromId]?.points ?: 0.0f
            val b = results[bet.toId]?.points ?: 0.0f

            if (a == b) {
                nextCash[bet.fromId] = (nextCash[bet.fromId] ?: 0) + bet.stake
                nextCash[bet.toId] = (nextCash[bet.toId] ?: 0) + bet.stake
                bet.copy(status = "done", winnerId = null)
            } else {
                val winnerId = if (a > b) bet.fromId else bet.toId
                nextCash[winnerId] = (nextCash[winnerId] ?: 0) + bet.stake * 2
                bet.copy(status = "done", winnerId = winnerId)
            }
        }
        return Pair(nextBets, nextCash)
    }

    fun autoAcceptCpuBets(
        bets: List<SideBet>,
        cash: Map<String, Int>,
        teams: List<LeagueTeam>
    ): Pair<List<SideBet>, Map<String, Int>> {
        val nextCash = cash.toMutableMap()
        val nextBets = bets.map { bet ->
            if (bet.status != "open") return@map bet
            val to = teams.find { it.id == bet.toId }
            if (to == null || to.human) return@map bet
            val toCash = nextCash[to.id] ?: 0
            if (toCash < bet.stake) {
                bet.copy(status = "dead")
            } else {
                nextCash[to.id] = toCash - bet.stake
                bet.copy(status = "live")
            }
        }
        return Pair(nextBets, nextCash)
    }
}
