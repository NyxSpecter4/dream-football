package com.example.dreamfootball.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.dreamfootball.data.local.AppDatabase
import com.example.dreamfootball.data.model.AuctionBlock
import com.example.dreamfootball.data.model.AuctionPlan
import com.example.dreamfootball.data.model.BidLog
import com.example.dreamfootball.data.model.BoxScore
import com.example.dreamfootball.data.model.CareerStats
import com.example.dreamfootball.data.model.Contract
import com.example.dreamfootball.data.model.GameScreen
import com.example.dreamfootball.data.model.GameState
import com.example.dreamfootball.data.model.JerseyTheme
import com.example.dreamfootball.data.model.Matchup
import com.example.dreamfootball.data.model.Phase
import com.example.dreamfootball.data.model.PlayoffBracket
import com.example.dreamfootball.data.model.Roster
import com.example.dreamfootball.data.model.SideBet
import com.example.dreamfootball.data.model.Slot
import com.example.dreamfootball.data.repository.GameRepository
import com.example.dreamfootball.domain.AuctionEngine
import com.example.dreamfootball.domain.LeagueEngine
import com.example.dreamfootball.domain.PlayersData
import com.example.dreamfootball.domain.ScoringEngine
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.random.Random

class GameViewModel(application: Application) : AndroidViewModel(application) {

    private val repository: GameRepository
    private val _state = MutableStateFlow(GameState())
    val state: StateFlow<GameState> = _state.asStateFlow()

    init {
        val db = AppDatabase.getInstance(application)
        repository = GameRepository(db.gameDao())
        loadPersistedState()
    }

    private fun loadPersistedState() {
        viewModelScope.launch {
            val career = repository.loadCareer()
            val saved = repository.loadState()
            if (saved != null) {
                _state.value = saved.copy(career = career)
            } else {
                _state.update { it.copy(career = career) }
            }
        }
    }

    private fun persistState() {
        viewModelScope.launch {
            val curr = _state.value
            repository.saveState(curr)
            repository.saveCareer(curr.career)
        }
    }

    fun setScreen(screen: GameScreen) {
        _state.update { it.copy(screen = screen) }
        persistState()
    }

    fun startNewSeason(
        teamName: String,
        shortTag: String,
        jersey: JerseyTheme,
        city: String,
        stadium: String
    ) {
        val teams = LeagueEngine.buildLeague(teamName, shortTag, jersey, city, stadium)
        val seed = System.currentTimeMillis()
        val schedule = LeagueEngine.generateSchedule(teams.map { it.id })

        val initialBudgets = teams.associate { it.id to AuctionEngine.SALARY_CAP }
        val initialCash = teams.associate { it.id to LeagueEngine.HOUSE_CASH }
        val initialRosters = teams.associate { it.id to Roster() }

        _state.update {
            it.copy(
                seasonSeed = seed,
                week = 1,
                phase = Phase.DRAFT,
                screen = GameScreen.DRAFT,
                playerTeamId = "you",
                teams = teams,
                nominateIndex = 0,
                contracts = emptyList(),
                budgets = initialBudgets,
                cash = initialCash,
                rosters = initialRosters,
                schedule = schedule,
                results = emptyMap(),
                block = null,
                nominating = true,
                autoFill = false,
                playoffBracket = null,
                bets = emptyList(),
                waiverClaims = emptyList()
            )
        }
        persistState()
    }

    fun resetToTitle() {
        viewModelScope.launch {
            repository.clearSave()
            val career = repository.loadCareer()
            _state.value = GameState(career = career)
        }
    }

    fun nominate(playerId: String, openingBid: Int = AuctionEngine.MIN_BID) {
        val curr = _state.value
        val nominator = curr.teams[curr.nominateIndex]
        val safeBid = max(AuctionEngine.MIN_BID, openingBid)

        val newBlock = AuctionBlock(
            playerId = playerId,
            nominatorId = nominator.id,
            highBid = safeBid,
            highBidderId = nominator.id,
            going = 0,
            waitingForHuman = true,
            passedTeamIds = emptyList(),
            log = listOf(BidLog(nominator.id, safeBid))
        )

        _state.update {
            it.copy(
                block = newBlock,
                nominating = false
            )
        }
        persistState()
    }

    fun humanBid(amount: Int) {
        val curr = _state.value
        val b = curr.block ?: return
        val budget = curr.budgets["you"] ?: 0
        val roster = curr.rosters["you"] ?: Roster()
        val cap = AuctionEngine.maxAffordable(budget, roster.spotsLeft())

        if (amount <= b.highBid || amount > cap) return

        val updatedBlock = b.copy(
            highBid = amount,
            highBidderId = "you",
            going = 0,
            waitingForHuman = false,
            passedTeamIds = b.passedTeamIds.filter { it != "you" },
            log = b.log + BidLog("you", amount)
        )

        _state.update { it.copy(block = updatedBlock) }
        persistState()
    }

    fun humanPass() {
        val curr = _state.value
        val b = curr.block ?: return
        if (b.passedTeamIds.contains("you")) return

        val nextPassed = b.passedTeamIds + "you"
        val updatedBlock = b.copy(
            passedTeamIds = nextPassed,
            waitingForHuman = false
        )
        _state.update { it.copy(block = updatedBlock) }
        persistState()
    }

    fun cpuStep() {
        val curr = _state.value
        val b = curr.block

        if (b == null) {
            // Check if nomination needed
            if (curr.nominating) {
                val nominator = curr.teams[curr.nominateIndex]
                if (!nominator.human) {
                    // CPU nominates
                    val taken = curr.contracts.map { it.playerId }.toSet()
                    val available = PlayersData.ALL_PLAYERS.filter { !taken.contains(it.id) }
                    if (available.isNotEmpty()) {
                        val roster = curr.rosters[nominator.id] ?: Roster()
                        val budget = curr.budgets[nominator.id] ?: 0
                        val chosen = AuctionEngine.cpuNominate(available, roster, budget, 1.0f)
                        nominate(chosen.id, AuctionEngine.MIN_BID)
                    }
                }
            }
            return
        }

        // Active block resolution
        val activeTeams = curr.teams.filter { team ->
            val r = curr.rosters[team.id] ?: Roster()
            r.spotsLeft() > 0 && !b.passedTeamIds.contains(team.id) && team.id != b.highBidderId
        }

        // Check if CPU wants to raise
        var raised = false
        var nextBlock = b!!

        for (cpu in activeTeams.shuffled(Random(System.currentTimeMillis()))) {
            if (cpu.human) continue
            val r = curr.rosters[cpu.id] ?: Roster()
            val budget = curr.budgets[cpu.id] ?: 0
            val maxBid = AuctionEngine.cpuMaxBid(b.playerId, r, budget, 0.95f + (Random.nextFloat() * 0.1f))
            val raiseAmount = AuctionEngine.nextRaise(b.highBid)

            if (maxBid >= raiseAmount) {
                nextBlock = b.copy(
                    highBid = raiseAmount,
                    highBidderId = cpu.id,
                    going = 0,
                    waitingForHuman = true,
                    log = b.log + BidLog(cpu.id, raiseAmount)
                )
                raised = true
                break
            } else {
                nextBlock = nextBlock.copy(passedTeamIds = nextBlock.passedTeamIds + cpu.id)
            }
        }

        if (raised) {
            _state.update { it.copy(block = nextBlock) }
            persistState()
            return
        }

        // If no raise, advance hammer or sell
        if (nextBlock.going < 2) {
            val updated = nextBlock.copy(
                going = nextBlock.going + 1,
                waitingForHuman = !nextBlock.passedTeamIds.contains("you") && nextBlock.highBidderId != "you"
            )
            _state.update { it.copy(block = updated) }
            persistState()
        } else {
            // Sold!
            sellBlockPlayer(nextBlock)
        }
    }

    private fun sellBlockPlayer(block: AuctionBlock) {
        val curr = _state.value
        val buyerId = block.highBidderId
        val player = PlayersData.getPlayer(block.playerId)

        val nextBudgets = curr.budgets.toMutableMap()
        nextBudgets[buyerId] = max(0, (nextBudgets[buyerId] ?: 0) - block.highBid)

        val nextRosters = curr.rosters.toMutableMap()
        val buyerRoster = nextRosters[buyerId] ?: Roster()
        nextRosters[buyerId] = AuctionEngine.placePlayerInRoster(buyerRoster, block.playerId)

        val nextContracts = curr.contracts + Contract(block.playerId, buyerId, block.highBid)

        // Find next nominator
        val nextNomIdx = AuctionEngine.nextNominatorIndex(
            teamCount = curr.teams.size,
            currentIndex = (curr.nominateIndex + 1) % curr.teams.size,
            rosters = nextRosters,
            teams = curr.teams
        )

        val draftFinished = nextNomIdx == null || nextRosters.values.all { it.spotsLeft() == 0 }

        _state.update {
            it.copy(
                block = null,
                budgets = nextBudgets,
                rosters = nextRosters,
                contracts = nextContracts,
                lastSoldPlayerId = player.id,
                lastSoldTeamId = buyerId,
                lastSoldPrice = block.highBid,
                nominateIndex = nextNomIdx ?: 0,
                nominating = !draftFinished,
                phase = if (draftFinished) Phase.REGULAR else Phase.DRAFT,
                screen = if (draftFinished) GameScreen.HOME else GameScreen.DRAFT
            )
        }
        persistState()
    }

    fun autoFillRemainingDraft() {
        val curr = _state.value
        val (nextRosters, nextBudgets, nextContracts) = AuctionEngine.fillUnfinishedRosters(
            teams = curr.teams,
            rosters = curr.rosters,
            budgets = curr.budgets,
            contracts = curr.contracts
        )

        _state.update {
            it.copy(
                block = null,
                rosters = nextRosters,
                budgets = nextBudgets,
                contracts = nextContracts,
                phase = Phase.REGULAR,
                screen = GameScreen.HOME,
                nominating = false
            )
        }
        persistState()
    }

    fun swapLineup(slot: Slot, benchPlayerId: String) {
        val curr = _state.value
        val userRoster = curr.rosters["you"] ?: return
        val updated = LeagueEngine.swapLineup(userRoster, slot, benchPlayerId)
        val nextRosters = curr.rosters + ("you" to updated)
        _state.update { it.copy(rosters = nextRosters) }
        persistState()
    }

    fun placeSideBet(stake: Int) {
        val curr = _state.value
        val weekMatchups = if (curr.week <= LeagueEngine.REGULAR_WEEKS) {
            curr.schedule.getOrNull(curr.week - 1) ?: emptyList()
        } else {
            emptyList()
        }
        val yourMatch = weekMatchups.find { it.homeId == "you" || it.awayId == "you" } ?: return
        val oppId = if (yourMatch.homeId == "you") yourMatch.awayId else yourMatch.homeId

        val userCash = curr.cash["you"] ?: 0
        if (userCash < stake) return

        val newBet = SideBet(
            id = "bet-${curr.week}-${System.currentTimeMillis()}",
            week = curr.week,
            fromId = "you",
            toId = oppId,
            stake = stake,
            status = "open"
        )

        val nextCash = curr.cash + ("you" to userCash - stake)
        val (acceptedBets, autoCash) = LeagueEngine.autoAcceptCpuBets(curr.bets + newBet, nextCash, curr.teams)

        _state.update {
            it.copy(
                bets = acceptedBets,
                cash = autoCash
            )
        }
        persistState()
    }

    fun claimWaiver(dropPlayerId: String, addPlayerId: String) {
        val curr = _state.value
        val userRoster = curr.rosters["you"] ?: return
        if (!userRoster.bench.contains(dropPlayerId)) return

        val nextBench = userRoster.bench.toMutableList()
        nextBench.remove(dropPlayerId)
        nextBench.add(addPlayerId)

        val updatedRoster = userRoster.copy(bench = nextBench)
        val nextContracts = curr.contracts.filter { it.playerId != dropPlayerId } +
                Contract(addPlayerId, "you", AuctionEngine.MIN_BID)

        _state.update {
            it.copy(
                rosters = curr.rosters + ("you" to updatedRoster),
                contracts = nextContracts
            )
        }
        persistState()
    }

    fun playWeek() {
        val curr = _state.value
        if (curr.week > LeagueEngine.CHAMPIONSHIP_WEEK) return

        val currentMatchups = if (curr.week <= LeagueEngine.REGULAR_WEEKS) {
            curr.schedule.getOrNull(curr.week - 1) ?: emptyList()
        } else if (curr.week == LeagueEngine.PLAYOFF_WEEK) {
            val bracket = curr.playoffBracket ?: return
            listOf(bracket.semiA, bracket.semiB)
        } else {
            val bracket = curr.playoffBracket ?: return
            listOfNotNull(bracket.finalMatchup)
        }

        val weekResults = mutableMapOf<String, BoxScore>()
        for (m in currentMatchups) {
            val homeRoster = curr.rosters[m.homeId] ?: Roster()
            val awayRoster = curr.rosters[m.awayId] ?: Roster()
            val (homeBox, awayBox) = ScoringEngine.simulateMatchup(
                matchup = m,
                homeRoster = homeRoster,
                awayRoster = awayRoster,
                week = curr.week,
                seasonSeed = curr.seasonSeed
            )
            weekResults[m.homeId] = homeBox
            weekResults[m.awayId] = awayBox
        }

        val nextResults = curr.results + (curr.week to weekResults)

        // Settle side bets
        val (settledBets, settledCash) = LeagueEngine.settleSideBets(
            bets = curr.bets,
            cash = curr.cash,
            results = weekResults,
            week = curr.week
        )

        var nextBracket = curr.playoffBracket
        var nextPhase = curr.phase
        var career = curr.career

        if (curr.week == LeagueEngine.REGULAR_WEEKS) {
            // End of regular season -> compute top 4 seeds for playoffs
            val standings = LeagueEngine.calculateStandings(curr.teams, nextResults, curr.week)
            val top4 = standings.take(4).map { it.teamId }
            nextBracket = PlayoffBracket(
                semiA = Matchup(top4[0], top4[3]),
                semiB = Matchup(top4[1], top4[2])
            )
            nextPhase = Phase.PLAYOFFS
        } else if (curr.week == LeagueEngine.PLAYOFF_WEEK) {
            // Semifinals resolved -> final
            val semiABox = weekResults[curr.playoffBracket?.semiA?.homeId]
            val semiBBox = weekResults[curr.playoffBracket?.semiB?.homeId]

            val winnerA = if (semiABox?.won == true) curr.playoffBracket!!.semiA.homeId else curr.playoffBracket!!.semiA.awayId
            val winnerB = if (semiBBox?.won == true) curr.playoffBracket!!.semiB.homeId else curr.playoffBracket!!.semiB.awayId

            nextBracket = curr.playoffBracket?.copy(
                finalMatchup = Matchup(winnerA, winnerB)
            )
        } else if (curr.week == LeagueEngine.CHAMPIONSHIP_WEEK) {
            // Championship resolved!
            val finalM = curr.playoffBracket?.finalMatchup
            val champId = if (finalM != null) {
                val box = weekResults[finalM.homeId]
                if (box?.won == true) finalM.homeId else finalM.awayId
            } else "you"

            nextBracket = curr.playoffBracket?.copy(championId = champId)
            nextPhase = Phase.COMPLETE

            // Update career stats
            val wonTitle = champId == "you"
            val finish = if (wonTitle) 1 else 2
            val newBest = if (career.bestFinish == null) finish else minOf(career.bestFinish, finish)
            career = CareerStats(
                seasons = career.seasons + 1,
                titles = if (wonTitle) career.titles + 1 else career.titles,
                bestFinish = newBest
            )
        }

        _state.update {
            it.copy(
                results = nextResults,
                bets = settledBets,
                cash = settledCash,
                playoffBracket = nextBracket,
                phase = nextPhase,
                career = career,
                screen = GameScreen.MATCHUP
            )
        }
        persistState()
    }

    fun nextWeek() {
        val curr = _state.value
        if (curr.week >= LeagueEngine.CHAMPIONSHIP_WEEK) {
            // Offseason transition
            _state.update {
                it.copy(
                    phase = Phase.OFFSEASON,
                    screen = GameScreen.OFFSEASON
                )
            }
        } else {
            _state.update {
                it.copy(
                    week = curr.week + 1,
                    screen = GameScreen.HOME
                )
            }
        }
        persistState()
    }

    fun cutPlayerOffseason(playerId: String) {
        val curr = _state.value
        val userRoster = curr.rosters["you"] ?: return
        val nextContracts = curr.contracts.filter { !(it.playerId == playerId && it.teamId == "you") }
        val contract = curr.contracts.find { it.playerId == playerId && it.teamId == "you" }
        val refund = contract?.price ?: 0

        val nextLineup = userRoster.lineup.mapValues { if (it.value == playerId) null else it.value }
        val nextBench = userRoster.bench.filter { it != playerId }
        val updatedRoster = Roster(lineup = nextLineup, bench = nextBench)

        val nextBudgets = curr.budgets + ("you" to (curr.budgets["you"] ?: 0) + refund)
        val nextRosters = curr.rosters + ("you" to updatedRoster)

        _state.update {
            it.copy(
                contracts = nextContracts,
                rosters = nextRosters,
                budgets = nextBudgets
            )
        }
        persistState()
    }

    fun startNextDynastySeason() {
        val curr = _state.value
        val nextSeasonNo = curr.seasonNo + 1
        val seed = System.currentTimeMillis()
        val schedule = LeagueEngine.generateSchedule(curr.teams.map { it.id })

        _state.update {
            it.copy(
                seasonNo = nextSeasonNo,
                seasonSeed = seed,
                week = 1,
                phase = Phase.DRAFT,
                screen = GameScreen.DRAFT,
                schedule = schedule,
                results = emptyMap(),
                block = null,
                nominating = true,
                playoffBracket = null,
                bets = emptyList()
            )
        }
        persistState()
    }
}
